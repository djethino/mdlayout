// ── markdown-it Plugin Adapter ────────────────────────────────────────
// Adapter for markdown-it 13+ (the parser of VS Code's Markdown preview, of
// VitePress, Docusaurus and many others). The whole mdlayout syntax:
//   - ::::canvas{hints} ... ::::   → spatial canvas blocks
//   - ::::page{hints} ... ::::     → free pages (frames, shapes, layers)
//   - ![alt](url){hints}           → images with layout hints
//   - !video(url){hints}           → video embeds
//   - !audio(url){hints}           → audio embeds
//   - [text]{hints}                → inline styled spans
//   - a paragraph or heading ending with {align:center} (left, right, justify)
//   - GFM tables with merged cells (`>`, `^`) and cell styles (`{bg:…}`)
//
// Usage:
//   import MarkdownIt from 'markdown-it';
//   import { markdownItMdLayout } from '@asymptomatik/mdlayout/markdown-it';
//   const md = new MarkdownIt().use(markdownItMdLayout);
// and add the stylesheets once to the page: generateBaseCSS() and generatePageCSS().
//
// Zero external dependencies (markdown-it is the host, never imported here).
// Hint values are made safe by the resolver (`safeCssValue`), as in every
// other renderer of mdlayout; block bodies are rendered by the host markdown-it
// instance, so its own `html` option still governs raw HTML.

import { parseCanvas } from '../parser/canvas-parser.js';
import { parseMedia } from '../parser/media-parser.js';
import { parseInlineStyled } from '../parser/inline-parser.js';
import { renderToHTML } from '../renderer/html-renderer.js';
import { parsePages } from '../page/page.js';
import { renderPage } from '../page/render.js';
import { cellHint, markOf, spansOf } from '../table/table.js';

const CANVAS_OPEN = /^::::canvas(\{[^}]*\})?/;
const PAGE_OPEN = /^::::page(?:\{[^\n]*\})?[ \t]*$/;
const BLOCK_CLOSE = /^::::\s*$/;
const MEDIA = [/^!\[([^\]]*)\]\(([^)]+)\)\{([^}]*)\}/, /^!video\(([^)]+)\)(?:\{([^}]*)\})?/, /^!audio\(([^)]+)\)(?:\{([^}]*)\})?/];
const STYLED = /^\[([^\]]+)\]\{([^}]*)\}/;
const ALIGN = /[ \t]*\{align:(left|center|right|justify)\}[ \t]*$/;

/**
 * The markdown-it plugin.
 *
 * @param {object} md - The markdown-it instance (`md.use(markdownItMdLayout, options)`).
 * @param {{ includeLabels?: boolean, blockHeights?: Object.<string, number>, embeds?: boolean }} [options]
 *   `embeds: false` : a video page (YouTube, Vimeo, Dailymotion) becomes a link instead of a frame, where frames are
 *   blocked (VS Code's preview).
 */
export function markdownItMdLayout(md, options = {}) {
  const includeLabels = options.includeLabels !== false;
  const embeds = options.embeds !== false;

  /** The lines `start` … the first `::::` alone after it, or `-1` if the block is never closed. */
  function closingLine(state, start, end) {
    const lineText = (line) => state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
    let close = start + 1;
    let fence = false;
    while (close < end) {
      const text = lineText(close);
      // A fence inside a frame may show `::::` as code: not the end of the block.
      if (/^(```|~~~)/.test(text)) fence = !fence;
      if (!fence && BLOCK_CLOSE.test(text)) return close;
      close++;
    }
    return -1;
  }

  /** A `::::canvas` or `::::page` block: its raw text, given to `read` ; `null` leaves the lines to the other rules. */
  function layoutBlock(open, type, read) {
    return function rule(state, startLine, endLine, silent) {
      // Indented four spaces or more: code, not a layout block.
      if (state.sCount[startLine] - state.blkIndent >= 4) return false;
      const first = state.src.slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine]);
      if (!open.test(first)) return false;
      const close = closingLine(state, startLine, endLine);
      // Never closed: left to the other rules (it shows as text).
      if (close < 0) return false;
      if (silent) return true;
      let meta;
      try {
        meta = read(state.getLines(startLine, close + 1, 0, false));
      } catch (err) {
        console.error(`[mdlayout:markdown-it] ${type} parse error:`, err && err.message);
        return false;
      }
      if (!meta) return false;
      const token = state.push(type, 'div', 0);
      token.block = true;
      token.map = [startLine, close + 1];
      token.meta = meta;
      state.line = close + 1;
      return true;
    };
  }

  const canvasRule = layoutBlock(CANVAS_OPEN, 'mdlayout_canvas', (raw) => {
    const canvas = parseCanvas(raw)[0];
    return canvas ? { canvas } : null;
  });
  const pageRule = layoutBlock(PAGE_OPEN, 'mdlayout_page', (raw) => {
    const page = parsePages(raw.endsWith('\n') ? raw : `${raw}\n`)[0];
    return page ? { page } : null;
  });

  // ── Media with hints ──────────────────────────────────────────
  function mediaRule(state, silent) {
    if (state.src.charCodeAt(state.pos) !== 0x21 /* ! */) return false;
    const rest = state.src.slice(state.pos);
    for (const re of MEDIA) {
      const match = rest.match(re);
      if (!match) continue;
      const media = parseMedia(match[0]);
      if (!media) continue;
      if (!silent) state.push('mdlayout_media', '', 0).meta = { media };
      state.pos += match[0].length;
      return true;
    }
    return false;
  }

  // ── Inline styled spans ───────────────────────────────────────
  function styledRule(state, silent) {
    if (state.src.charCodeAt(state.pos) !== 0x5b /* [ */) return false;
    const match = state.src.slice(state.pos).match(STYLED);
    if (!match) return false;
    const { nodes } = parseInlineStyled(match[0]);
    if (!nodes.length) return false;
    if (!silent) state.push('mdlayout_styled', 'span', 0).meta = { node: nodes[0] };
    state.pos += match[0].length;
    return true;
  }

  /** Adds `declaration` to a token's `style` attribute (the table rule already writes `text-align` there). */
  function addStyle(token, declaration) {
    const before = token.attrGet('style');
    token.attrSet('style', before ? `${before.replace(/;?\s*$/, '')};${declaration}` : declaration);
  }

  // ── Paragraph and heading alignment ───────────────────────────
  // Before the inline phase: the hint leaves the text, the alignment goes on the block.
  function alignRule(state) {
    const tokens = state.tokens;
    for (let i = 1; i < tokens.length; i++) {
      const inline = tokens[i];
      const open = tokens[i - 1];
      if (inline.type !== 'inline' || (open.type !== 'paragraph_open' && open.type !== 'heading_open')) continue;
      const match = inline.content.match(ALIGN);
      if (!match) continue;
      inline.content = inline.content.slice(0, match.index);
      addStyle(open, `text-align:${match[1]}`);
    }
  }

  // ── Tables: merged cells and cell styles ──────────────────────
  // Before the inline phase too: a cell's hint leaves its text, `>` and `^` merge cells (`table/table.js`). A grid that
  // does not form rectangles is read without merges, as everywhere else.
  function tableRule(state) {
    const tokens = state.tokens;
    for (let start = 0; start < tokens.length; start++) {
      if (tokens[start].type !== 'table_open') continue;
      let end = start;
      while (end < tokens.length && tokens[end].type !== 'table_close') end++;
      /** The rows of the table: for each cell, the index of its opening token and of its inline token. */
      const rows = [];
      let row = null;
      for (let k = start; k < end; k++) {
        const token = tokens[k];
        if (token.type === 'tr_open') rows.push((row = []));
        else if ((token.type === 'th_open' || token.type === 'td_open') && row && tokens[k + 1]?.type === 'inline') row.push({ open: k, inline: k + 1 });
      }
      // Styles first: a hint leaves the cell's text.
      for (const cell of rows.flat()) {
        const inline = tokens[cell.inline];
        const hint = cellHint(inline.content);
        if (!hint) continue;
        inline.content = hint.before;
        const s = hint.style;
        const open = tokens[cell.open];
        if (s.bg) addStyle(open, `background:${s.bg}`);
        if (s.color) addStyle(open, `color:${s.color}`);
        if (s.align) addStyle(open, `text-align:${s.align}`);
        if (s.valign) addStyle(open, `vertical-align:${s.valign}`);
        if (s.width) addStyle(open, `width:${s.width}`);
        if (s.height) addStyle(open, `height:${s.height}`);
      }
      const spans = spansOf(rows.map((cells) => cells.map((cell) => markOf(tokens[cell.inline].content))));
      if (!spans || spans.length === rows.flat().length) continue;
      const starts = new Map(spans.map((span) => [`${span.row}:${span.column}`, span]));
      const drop = new Set();
      rows.forEach((cells, r) =>
        cells.forEach((cell, c) => {
          const span = starts.get(`${r}:${c}`);
          if (!span) {
            // A covered cell: its opening, its text and its closing go.
            drop.add(cell.open).add(cell.inline).add(cell.inline + 1);
            return;
          }
          if (span.colspan > 1) tokens[cell.open].attrSet('colspan', String(span.colspan));
          if (span.rowspan > 1) tokens[cell.open].attrSet('rowspan', String(span.rowspan));
        }),
      );
      state.tokens = tokens.filter((_, k) => !drop.has(k));
      return tableRule(state); // The indexes moved: the next tables are read again on the new list.
    }
  }

  md.block.ruler.before('fence', 'mdlayout_page', pageRule, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  md.block.ruler.before('fence', 'mdlayout_canvas', canvasRule, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  md.inline.ruler.before('image', 'mdlayout_media', mediaRule);
  md.inline.ruler.before('link', 'mdlayout_styled', styledRule);
  md.core.ruler.before('inline', 'mdlayout_tables', tableRule);
  md.core.ruler.before('inline', 'mdlayout_align', alignRule);

  // A block's text is rendered with the document's `env`: what other plugins keep there (footnote definitions,
  // numbers, the host's heading anchors) holds inside a column or a frame too.
  md.renderer.rules.mdlayout_canvas = (tokens, idx, _options, env) =>
    renderToHTML(tokens[idx].meta.canvas, { includeLabels, embeds, blockHeights: options.blockHeights, renderMarkdown: (text) => md.render(text, env) });
  md.renderer.rules.mdlayout_page = (tokens, idx, _options, env) => renderPage(tokens[idx].meta.page, { renderMarkdown: (text) => md.render(text, env) });
  md.renderer.rules.mdlayout_media = (tokens, idx) => renderToHTML(tokens[idx].meta.media, { includeLabels, embeds });
  md.renderer.rules.mdlayout_styled = (tokens, idx, _options, env) => renderToHTML(tokens[idx].meta.node, { renderMarkdown: (text) => md.renderInline(text, env) });
}

export default markdownItMdLayout;
