// The conventions of documents written with MarkdownRoxor, for a markdown-it host (VS Code's Markdown preview): what
// MarkdownRoxor shows beyond CommonMark, GFM and mdlayout. Each one is the twin of the application's own reader; a
// change there is carried here.
//   - callouts `> [!NOTE]` (TIP, IMPORTANT, WARNING, CAUTION) — GitHub's alerts;
//   - task lists `- [ ]` / `- [x]` (boxes shown, not clickable);
//   - footnotes `[^label]` and `[^label]: text`;
//   - `[[toc]]` alone on a line: the table of contents (headings 1 to 3), linked to the preview's own anchors;
//   - numbered figures `![Caption](image.png){#fig-name}` and references `@fig-name` (Quarto, pandoc-crossref);
//   - numbered equations: `\label{name}` in a display formula, `\eqref{name}` / `\ref{name}` (LaTeX), written for KaTeX;
//   - slide marks `---slide …---`: a thematic break;
//   - the document theme (`theme:` and `background:` of the front matter): its colours and fonts.
//
// No script runs in the preview, nothing is fetched: everything is HTML made here, from escaped text and validated
// values, with the static stylesheet `styles/markdownroxor.css`.
//
// 🔴 Living with other extensions (Markdown All in One adds task lists and GitHub alerts too, VS Code does not say in
// which order plugins run): every rule here leaves alone what another plugin has already turned into something else,
// and removes the marker it handles, so that a plugin running after it finds nothing to do. No box or alert twice.

const CALLOUTS = { NOTE: 'Note', TIP: 'Tip', IMPORTANT: 'Important', WARNING: 'Warning', CAUTION: 'Caution' };
const CALLOUT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/i;
const TASK = /^\[([ xX])\][  ]/;
const FOOTNOTE_DEF = /^\[\^([^\]\s]+)\]:[ \t]?(.*)$/;
const FOOTNOTE_REF = /^\[\^([^\]\s]+)\]/;
const TOC = /^\[\[toc\]\][ \t]*$/i;
const SLIDE = /^---slide.*---[ \t]*$/;
const FIGURE_IN = /!\[[^\]]*\]\([^)]*\)\{([^}]*)\}/g;
const FIGURE_LABEL = /^#fig[-:]([\p{L}\p{N}_-]+)$/u;
const FIGURE_REF = /(?<![\p{L}\p{N}@/.])@fig[-:]([\p{L}\p{N}_]+(?:-[\p{L}\p{N}_]+)*)/gu;
const LABEL = /\\label\{([^{}]*)\}/;
const TAG = /\\tag\*?\{([^{}]*)\}/;
const COLOUR = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;
const FONTS = {
  sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  serif: 'Georgia, "Iowan Old Style", "Palatino Linotype", "Times New Roman", serif',
  mono: 'ui-monospace, Consolas, monospace',
};
const THEME_COLOURS = ['text', 'heading', 'link', 'accent', 'surface'];

/** Whether a `#rgb` / `#rrggbb` colour is light (its relative luminance above the middle). */
function isLight(colour) {
  const hex = colour.slice(1);
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}

/** The anchor VS Code's preview gives a heading (its `githubSlugifier`): kept in step so that `[[toc]]` links work. */
export function slugOf(text) {
  return text.trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '').replace(/\s/g, '-');
}

/** The anchors of a document's headings, in order, duplicates numbered as VS Code does (`a`, `a-1`, `a-2`). */
export function slugsOf(texts) {
  const seen = new Map();
  return texts.map((text) => {
    const slug = slugOf(text);
    const entry = seen.get(slug);
    if (entry) {
      entry.count++;
      return slugOf(`${slug}-${entry.count}`);
    }
    seen.set(slug, { count: 0 });
    return slug;
  });
}

/** The numbers of display formulas carrying `\label{name}`, in order (`\tag{…}` written by hand keeps its value). */
export function equationNumbers(displays) {
  const out = new Map();
  let counter = 0;
  for (const tex of displays) {
    const label = tex.match(LABEL)?.[1]?.trim();
    if (!label) continue;
    const tag = tex.match(TAG)?.[1];
    out.set(label, tag ?? String(++counter));
  }
  return out;
}

/** What KaTeX draws: `\label` removed (and the number set as `\tag` in a display formula), references replaced. */
export function numberedTex(tex, display, numbers) {
  let out = tex;
  const label = out.match(LABEL)?.[1]?.trim();
  if (label !== undefined) {
    out = out.replace(LABEL, '');
    if (display && !TAG.test(out) && numbers.has(label)) out = `${out}\\tag{${numbers.get(label)}}`;
  }
  const bare = (text) => text.replace(/[\\{}]/g, '');
  return out
    .replace(/\\eqref\{([^{}]*)\}/g, (_, name) => `\\text{(${bare(numbers.get(name.trim()) ?? '?')})}`)
    .replace(/\\ref\{([^{}]*)\}/g, (_, name) => `\\text{${bare(numbers.get(name.trim()) ?? '?')}}`);
}

/** The figure a list of hints declares (`#fig-name`, or `#fig:name`), or `null`. */
export function figureOf(hints) {
  for (const part of String(hints ?? '').split(',')) {
    const found = FIGURE_LABEL.exec(part.trim());
    if (found) return found[1];
  }
  return null;
}

/** A front matter without the settings MarkdownRoxor writes there (`format:`, `background:`, `theme:`, one line each,
 *  `src/lib/doc/settings.ts`): what is left is the author's. */
export function withoutSettings(frontMatter) {
  return String(frontMatter ?? '')
    .split(/\r?\n/)
    .filter((line) => !/^(format|background|theme)\s*:/.test(line))
    .join('\n');
}

/** The document theme written in a front matter (MarkdownRoxor's `theme: { … }` line and `background:`), validated:
 *  colours are colours, fonts one of three families. `null` when there is neither. Twin of `doc-theme.ts`. */
export function themeOf(frontMatter) {
  let theme = null;
  let background = null;
  for (const line of String(frontMatter ?? '').split(/\r?\n/)) {
    const bg = line.match(/^background[ \t]*:[ \t]*["']?(#[0-9a-fA-F]{3,6})["']?[ \t]*$/);
    if (bg && COLOUR.test(bg[1])) background = bg[1].toLowerCase();
    const inner = line.match(/^theme[ \t]*:[ \t]*\{(.*)\}[ \t]*$/)?.[1];
    if (inner === undefined) continue;
    theme = { font: 'sans', headings: 'sans' };
    for (const part of inner.split(',')) {
      const at = part.indexOf(':');
      if (at < 0) continue;
      const key = part.slice(0, at).trim();
      const value = part.slice(at + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
      if ((key === 'font' || key === 'headings') && FONTS[value]) theme[key] = value;
      else if (THEME_COLOURS.includes(key) && COLOUR.test(value)) theme[key] = value.toLowerCase();
    }
  }
  return theme || background ? { theme, background } : null;
}

/**
 * The markdown-it plugin. Use it after mdlayout's (`md.use(markdownItMdLayout).use(markdownItConventions)`): numbered
 * figures dress mdlayout's images.
 * @param {any} md
 */
export function markdownItConventions(md) {
  const escape = md.utils.escapeHtml;
  /** This plugin's state for the document being read (kept in markdown-it's `env`). */
  // `nested` : inside a layout block's text (a column, a frame), rendered apart with the same `env` (mdlayout's adapter).
  const own = (env) => (env.mdroxor ??= { footnotes: new Map(), order: [], figures: new Map(), equations: new Map(), nested: 0 });

  // ── Block rules ───────────────────────────────────────────────
  const lineOf = (state, line) => state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
  const notCode = (state, line) => state.sCount[line] - state.blkIndent < 4;

  function slideRule(state, startLine, _endLine, silent) {
    if (!notCode(state, startLine) || !SLIDE.test(lineOf(state, startLine))) return false;
    if (!silent) Object.assign(state.push('mdr_slide', 'hr', 0), { map: [startLine, startLine + 1], block: true });
    state.line = startLine + 1;
    return true;
  }

  function tocRule(state, startLine, _endLine, silent) {
    if (!notCode(state, startLine) || !TOC.test(lineOf(state, startLine))) return false;
    if (!silent) Object.assign(state.push('mdr_toc', 'nav', 0), { map: [startLine, startLine + 1], block: true, meta: { entries: [] } });
    state.line = startLine + 1;
    return true;
  }

  // A definition and the indented lines that continue it. Before `reference`: `[^1]: text` would otherwise be read as
  // a link reference and vanish.
  function footnoteDefRule(state, startLine, endLine, silent) {
    if (!notCode(state, startLine)) return false;
    const match = lineOf(state, startLine).match(FOOTNOTE_DEF);
    if (!match) return false;
    if (silent) return true;
    const lines = [match[2]];
    let line = startLine + 1;
    while (line < endLine && state.sCount[line] - state.blkIndent >= 2 && lineOf(state, line).trim()) lines.push(lineOf(state, line).trim()), line++;
    const store = own(state.env).footnotes;
    if (!store.has(match[1])) store.set(match[1], lines.join(' '));
    Object.assign(state.push('mdr_footnote_def', '', 0), { map: [startLine, line], block: true, hidden: true });
    state.line = line;
    return true;
  }

  // ── Inline rule: a footnote reference whose definition exists (the block phase has read them all) ──
  function footnoteRefRule(state, silent) {
    if (state.src.charCodeAt(state.pos) !== 0x5b /* [ */ || state.src.charCodeAt(state.pos + 1) !== 0x5e /* ^ */) return false;
    const match = state.src.slice(state.pos).match(FOOTNOTE_REF);
    const data = own(state.env);
    if (!match || !data.footnotes.has(match[1])) return false;
    if (!silent) {
      if (!data.order.includes(match[1])) data.order.push(match[1]);
      state.push('mdr_footnote_ref', 'sup', 0).meta = { label: match[1], number: data.order.indexOf(match[1]) + 1 };
    }
    state.pos += match[0].length;
    return true;
  }

  // ── Core rules, before the inline phase ───────────────────────
  // Callouts: a blockquote whose first line is `[!NOTE]`. One already turned into an alert by another plugin is no
  // longer a blockquote; once ours, the marker is gone and another plugin sees a plain quote.
  function calloutRule(state) {
    // `renderInline` (a footnote's text) runs the core rules again: not for it.
    if (state.inlineMode) return;
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length - 2; i++) {
      if (tokens[i].type !== 'blockquote_open' || tokens[i + 1].type !== 'paragraph_open' || tokens[i + 2].type !== 'inline') continue;
      const inline = tokens[i + 2];
      const match = inline.content.match(CALLOUT);
      if (!match) continue;
      const kind = match[1].toUpperCase();
      const open = tokens[i];
      let depth = 0;
      let close = i;
      for (; close < tokens.length; close++) {
        if (tokens[close].type === 'blockquote_open') depth++;
        else if (tokens[close].type === 'blockquote_close' && --depth === 0) break;
      }
      open.tag = 'aside';
      open.attrSet('class', `callout ${kind.toLowerCase()}`);
      open.attrSet('data-kind', kind);
      if (tokens[close]) tokens[close].tag = 'aside';
      inline.content = inline.content.slice(match[0].length);
      const title = Object.assign(new state.Token('mdr_callout_title', 'p', 0), { block: true, meta: { label: CALLOUTS[kind] } });
      // A first paragraph that held only the marker goes; the title takes its place.
      if (!inline.content.trim()) tokens.splice(i + 1, 3, title);
      else tokens.splice(i + 1, 0, title);
    }
  }

  // The theme: the front matter (VS Code's own plugin keeps it as a `front_matter` token) dresses the whole document.
  function themeRule(state) {
    if (state.inlineMode || own(state.env).nested) return;
    const front = state.tokens.find((token) => token.type === 'front_matter');
    // VS Code keeps the front matter's text in `meta.content` (its yamlPreamble.ts); another plugin may keep a string.
    const text = front && (typeof front.meta === 'string' ? front.meta : front.meta?.content);
    const found = front && themeOf(text);
    // MarkdownRoxor's settings are not content: VS Code shows a front matter as a table by default
    // (`markdown.preview.frontMatter`), so they leave it once read; the reader's own keys (a title, an author) stay.
    if (front && typeof text === 'string') {
      const rest = withoutSettings(text);
      if (!rest.trim()) front.meta = null;
      else if (typeof front.meta === 'string') front.meta = rest;
      else front.meta = { ...front.meta, content: rest };
    }
    if (!found) return;
    state.tokens.unshift(Object.assign(new state.Token('mdr_theme_open', 'div', 1), { block: true, meta: found }));
    state.tokens.push(Object.assign(new state.Token('mdr_theme_close', 'div', -1), { block: true }));
  }

  // Figures (their numbers, in the order of the document) and display formulas (theirs, and the text KaTeX draws). The
  // text of a layout block (a column, a frame) is read in place too: it is rendered later, apart, and a reference
  // before it must already know its number.
  function numberingRule(state) {
    if (state.inlineMode) return;
    const data = own(state.env);
    if (!data.nested) {
      const lines = state.src.split(String.fromCharCode(10));
      const displays = [];
      const figures = (text) => {
        for (const match of text.matchAll(FIGURE_IN)) {
          const name = figureOf(match[1]);
          if (name && !data.figures.has(name)) data.figures.set(name, data.figures.size + 1);
        }
      };
      for (const token of state.tokens) {
        if (token.type === 'inline') figures(token.content);
        else if (token.type === 'math_block') displays.push(token.content);
        else if ((token.type === 'mdlayout_canvas' || token.type === 'mdlayout_page') && token.map) {
          const raw = lines.slice(token.map[0], token.map[1]).join(String.fromCharCode(10));
          figures(raw);
          for (const match of raw.matchAll(/\$\$([\s\S]*?)\$\$/g)) displays.push(match[1]);
        }
      }
      data.equations = equationNumbers(displays);
    }
    for (const token of state.tokens) if (token.type === 'math_block') token.content = numberedTex(token.content, true, data.equations);
  }

  // ── Core rules, after the inline phase ────────────────────────
  // Task boxes. Markdown All in One's plugin checks the inline token's content: the marker leaves it too.
  function taskRule(state) {
    if (state.inlineMode) return;
    const tokens = state.tokens;
    for (let i = 2; i < tokens.length; i++) {
      const inline = tokens[i];
      if (inline.type !== 'inline' || tokens[i - 1].type !== 'paragraph_open' || tokens[i - 2].type !== 'list_item_open') continue;
      const first = inline.children?.[0];
      const match = first?.type === 'text' ? first.content.match(TASK) : null;
      if (!match) continue;
      const done = match[1] !== ' ';
      first.content = first.content.slice(match[0].length);
      inline.content = inline.content.replace(TASK, '');
      inline.children.unshift(Object.assign(new state.Token('mdr_task_box', 'input', 0), { meta: { done } }));
      const item = tokens[i - 2];
      item.attrJoin('class', done ? 'task done' : 'task');
    }
  }

  // Headings: their anchors (VS Code sets the same ones itself; another host gets them from here), and `[[toc]]`.
  function headingsRule(state) {
    if (state.inlineMode || own(state.env).nested) return;
    const tokens = state.tokens;
    const plain = (token) => (token.children ?? []).map((child) => (child.type === 'text' || child.type === 'code_inline' || child.type === 'emoji' ? child.content : plain(child))).join('');
    const headings = [];
    for (let i = 0; i < tokens.length - 1; i++) if (tokens[i].type === 'heading_open') headings.push({ open: tokens[i], text: plain(tokens[i + 1]), level: Number(tokens[i].tag.slice(1)) });
    const slugs = slugsOf(headings.map((heading) => heading.text));
    headings.forEach((heading, k) => heading.open.attrGet('id') || heading.open.attrSet('id', slugs[k]));
    const entries = headings.map((heading, k) => ({ text: heading.text.trim(), level: heading.level, slug: slugs[k] })).filter((entry) => entry.level <= 3 && entry.text);
    for (const token of tokens) if (token.type === 'mdr_toc') token.meta.entries = entries;
  }

  // Figure references in the text, and references inside formulas of the text.
  function referencesRule(state) {
    if (state.inlineMode) return;
    const data = own(state.env);
    for (const token of state.tokens) {
      if (token.type !== 'inline' || !token.children) continue;
      const children = [];
      for (const child of token.children) {
        if (child.type === 'math_inline') child.content = numberedTex(child.content, false, data.equations ?? new Map());
        if (child.type !== 'text' || !FIGURE_REF.test(child.content)) {
          children.push(child);
          continue;
        }
        FIGURE_REF.lastIndex = 0;
        let at = 0;
        for (const match of child.content.matchAll(FIGURE_REF)) {
          if (match.index > at) children.push(Object.assign(new state.Token('text', '', 0), { content: child.content.slice(at, match.index) }));
          const number = data.figures.get(match[1]);
          children.push(Object.assign(new state.Token('mdr_figure_ref', 'a', 0), { meta: { name: match[1], number } }));
          at = match.index + match[0].length;
        }
        if (at < child.content.length) children.push(Object.assign(new state.Token('text', '', 0), { content: child.content.slice(at) }));
      }
      token.children = children;
    }
  }

  // Footnotes, gathered at the end in the order of their first reference — references inside a layout block are read
  // while rendering, so the list is the one known when the end is rendered.
  function footnotesRule(state) {
    if (state.inlineMode) return;
    const data = own(state.env);
    if (data.nested || !data.footnotes.size) return;
    state.tokens.push(Object.assign(new state.Token('mdr_footnotes', 'section', 0), { block: true }));
  }

  md.block.ruler.before('hr', 'mdr_slide', slideRule, { alt: ['paragraph'] });
  md.block.ruler.before('paragraph', 'mdr_toc', tocRule);
  md.block.ruler.before('reference', 'mdr_footnote_def', footnoteDefRule, { alt: ['paragraph'] });
  md.inline.ruler.before('link', 'mdr_footnote_ref', footnoteRefRule);
  md.core.ruler.before('inline', 'mdr_callouts', calloutRule);
  md.core.ruler.before('inline', 'mdr_numbering', numberingRule);
  md.core.ruler.push('mdr_tasks', taskRule);
  md.core.ruler.push('mdr_headings', headingsRule);
  md.core.ruler.push('mdr_references', referencesRule);
  md.core.ruler.push('mdr_footnotes', footnotesRule);
  md.core.ruler.push('mdr_theme', themeRule);
  // 🔴 VS Code reads a document with one `env` (and caches the tokens) and renders it with another, fresh one
  // (markdownEngine.ts): what the reading noted (figure numbers, footnote definitions) would be lost at rendering. A
  // hidden first token carries it, and hands it to the rendering `env` before anything else is drawn.
  md.core.ruler.push('mdr_data', (state) => {
    if (state.inlineMode) return;
    state.tokens.unshift(Object.assign(new state.Token('mdr_data', '', 0), { hidden: true, meta: { data: own(state.env) } }));
  });

  // ── Rendering ─────────────────────────────────────────────────
  const rules = md.renderer.rules;
  rules.mdr_slide = () => '<hr class="mdr-slide">\n';
  rules.mdr_callout_title = (tokens, idx) => `<p class="callout-title">${escape(tokens[idx].meta.label)}</p>\n`;
  rules.mdr_task_box = (tokens, idx) => `<input class="task-box" type="checkbox" disabled${tokens[idx].meta.done ? ' checked' : ''}> `;
  rules.mdr_toc = (tokens, idx) => {
    const entries = tokens[idx].meta.entries;
    if (!entries.length) return '';
    const items = entries.map((entry) => `<li class="toc-${entry.level}"><a href="#${escape(entry.slug)}">${escape(entry.text)}</a></li>`).join('');
    return `<nav class="toc"><ol>${items}</ol></nav>\n`;
  };
  rules.mdr_footnote_def = () => '';
  rules.mdr_footnote_ref = (tokens, idx) => {
    const { label, number } = tokens[idx].meta;
    return `<sup class="footnote-ref"><a href="#fn-${escape(label)}" id="fnref-${escape(label)}">${number}</a></sup>`;
  };
  rules.mdr_footnotes = (tokens, idx, _options, env) => {
    const data = own(env);
    if (!data.order.length) return '';
    const items = [...data.order]
      .map((label) => `<li id="fn-${escape(label)}">${md.renderInline(data.footnotes.get(label) ?? '', env)} <a class="footnote-back" href="#fnref-${escape(label)}">↩</a></li>`)
      .join('\n');
    return `<section class="footnotes"><ol>\n${items}\n</ol></section>\n`;
  };
  rules.mdr_figure_ref = (tokens, idx) => {
    const { name, number } = tokens[idx].meta;
    return number ? `<a class="figure-ref" href="#fig-${escape(name)}">Figure ${number}</a>` : `<span class="figure-ref missing">Figure ?</span>`;
  };
  rules.mdr_theme_open = (tokens, idx) => {
    const { theme, background } = tokens[idx].meta;
    const vars = [];
    if (theme) {
      for (const key of THEME_COLOURS) if (theme[key]) vars.push(`--mdr-${key}:${theme[key]}`);
      vars.push(`--mdr-font:${FONTS[theme.font]}`, `--mdr-heading-font:${FONTS[theme.headings]}`);
    }
    vars.push(`--mdr-paper:${background ?? '#ffffff'}`);
    // A background without a theme: the text takes the tone the paper needs (as MarkdownRoxor does).
    const tone = theme ? '' : ` paper-only ${isLight(background) ? 'light' : 'dark'}`;
    return `<div class="mdr-themed${tone}" style="${escape(vars.join(';'))}">\n`;
  };
  rules.mdr_theme_close = () => '</div>\n';
  rules.mdr_data = (tokens, idx, _options, env) => {
    // The reading's notes, for this rendering (and for the text of layout blocks, read while rendering).
    if (env && !env.mdroxor) env.mdroxor = tokens[idx].meta.data;
    return '';
  };

  // The text of mdlayout's layout blocks is rendered apart, with the same `env`: what holds once per document (the
  // footnotes' list, the anchors, the theme, the numbers) is not done again inside.
  for (const type of ['mdlayout_canvas', 'mdlayout_page']) {
    const block = rules[type];
    if (!block) continue;
    rules[type] = (tokens, idx, options, env, self) => {
      const data = own(env);
      data.nested++;
      try {
        return block(tokens, idx, options, env, self);
      } finally {
        data.nested--;
      }
    };
  }

  // Numbered figures dress mdlayout's images: an anchor, and the caption under it.
  const media = rules.mdlayout_media;
  if (media) {
    rules.mdlayout_media = (tokens, idx, options, env, self) => {
      const html = media(tokens, idx, options, env, self);
      const found = tokens[idx].meta?.media;
      const hints = found?.hints ? Object.entries(found.hints).map(([key, value]) => (value === true ? key : `${key}:${value}`)).join(',') : '';
      const name = figureOf(hints);
      const number = name && own(env).figures.get(name);
      if (!number) return html;
      const caption = `<figcaption class="figcaption">Figure ${number}${found.alt ? ` — ${escape(found.alt)}` : ''}</figcaption>`;
      return html.replace(/^<figure /, `<figure id="fig-${escape(name)}" `).replace(/<\/figure>$/, `${caption}</figure>`);
    };
  }
}

export default markdownItConventions;
