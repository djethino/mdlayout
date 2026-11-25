// ── markdown-it Plugin Adapter ────────────────────────────────────────
// Adapter for markdown-it 13+ (the parser of VS Code's Markdown preview, of
// VitePress, Docusaurus and many others). The same syntax as the marked
// adapter (`marked-plugin.js`):
//   - ::::canvas{hints} ... ::::  → spatial canvas blocks
//   - ![alt](url){hints}          → images with layout hints
//   - !video(url){hints}          → video embeds
//   - !audio(url){hints}          → audio embeds
//   - [text]{hints}               → inline styled spans
//
// Usage:
//   import MarkdownIt from 'markdown-it';
//   import { markdownItMdLayout } from '@asymptomatik/mdlayout/markdown-it';
//   const md = new MarkdownIt().use(markdownItMdLayout);
//
// Zero external dependencies (markdown-it is the host, never imported here).
// Hint values are made safe by the resolver (`safeCssValue`), as in every
// other renderer of mdlayout; block bodies are rendered by the host markdown-it
// instance, so its own `html` option still governs raw HTML.

import { parseCanvas } from '../parser/canvas-parser.js';
import { parseMedia } from '../parser/media-parser.js';
import { parseInlineStyled } from '../parser/inline-parser.js';
import { renderToHTML } from '../renderer/html-renderer.js';

const CANVAS_OPEN = /^::::canvas(\{[^}]*\})?/;
const CANVAS_CLOSE = /^::::\s*$/;
const MEDIA = [/^!\[([^\]]*)\]\(([^)]+)\)\{([^}]*)\}/, /^!video\(([^)]+)\)(?:\{([^}]*)\})?/, /^!audio\(([^)]+)\)(?:\{([^}]*)\})?/];
const STYLED = /^\[([^\]]+)\]\{([^}]*)\}/;

/**
 * The markdown-it plugin.
 *
 * @param {object} md - The markdown-it instance (`md.use(markdownItMdLayout, options)`).
 * @param {{ includeLabels?: boolean, blockHeights?: Object.<string, number> }} [options]
 */
export function markdownItMdLayout(md, options = {}) {
  const includeLabels = options.includeLabels !== false;

  // ── Canvas blocks ─────────────────────────────────────────────
  function canvasRule(state, startLine, endLine, silent) {
    // Indented four spaces or more: code, not a canvas.
    if (state.sCount[startLine] - state.blkIndent >= 4) return false;
    const lineText = (line) => state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
    if (!CANVAS_OPEN.test(lineText(startLine))) return false;
    let close = startLine + 1;
    while (close < endLine && !CANVAS_CLOSE.test(lineText(close))) close++;
    // Never closed: left to the other rules (it shows as text).
    if (close >= endLine) return false;
    if (silent) return true;
    const raw = state.getLines(startLine, close + 1, 0, false);
    let canvas;
    try {
      canvas = parseCanvas(raw)[0];
    } catch (err) {
      console.error('[mdlayout:markdown-it] Canvas parse error:', err && err.message);
      return false;
    }
    if (!canvas) return false;
    const token = state.push('mdlayout_canvas', 'div', 0);
    token.block = true;
    token.map = [startLine, close + 1];
    token.meta = { canvas };
    state.line = close + 1;
    return true;
  }

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

  md.block.ruler.before('fence', 'mdlayout_canvas', canvasRule, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  md.inline.ruler.before('image', 'mdlayout_media', mediaRule);
  md.inline.ruler.before('link', 'mdlayout_styled', styledRule);

  md.renderer.rules.mdlayout_canvas = (tokens, idx) =>
    renderToHTML(tokens[idx].meta.canvas, { includeLabels, blockHeights: options.blockHeights, renderMarkdown: (text) => md.render(text) });
  md.renderer.rules.mdlayout_media = (tokens, idx) => renderToHTML(tokens[idx].meta.media, { includeLabels });
  md.renderer.rules.mdlayout_styled = (tokens, idx) => renderToHTML(tokens[idx].meta.node, { renderMarkdown: (text) => md.renderInline(text) });
}

export default markdownItMdLayout;
