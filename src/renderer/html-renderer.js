// ── HTML Renderer ─────────────────────────────────────────────────────
// Renders mdlayout AST nodes to HTML strings.
// No DOM manipulation — pure string concatenation.
//
// Produces:
//   - Canvas → <div class="mdl-canvas mdl-canvas--{mode}">
//   - Block  → <div class="mdl-block" data-block-name="...">
//   - Media  → <figure class="mdl-media mdl-media--{type}">
//   - Inline → <span class="mdl-styled" style="...">
//
// Zero external dependencies.

import { resolveHints } from '../resolver/hint-resolver.js';
import { embedUrl } from '../media/embed.js';
import { solveConstraints } from '../solver/constraint-solver.js';
import { solveGrid } from '../solver/grid-solver.js';

/**
 * @typedef {import('../ast/types.js').CanvasNode} CanvasNode
 * @typedef {import('../ast/types.js').BlockNode} BlockNode
 * @typedef {import('../ast/types.js').MediaNode} MediaNode
 * @typedef {import('../ast/types.js').InlineStyledNode} InlineStyledNode
 */

/**
 * @typedef {Object} RenderOptions
 * @property {function(string): string} [renderMarkdown] - Callback to render markdown body content to HTML.
 *   If not provided, body text is escaped.
 *   **SECURITY WARNING**: The caller is responsible for sanitizing the output of renderMarkdown.
 *   Injecting unsanitized HTML (e.g. from user-generated markdown) is a security risk (XSS).
 *   Use a sanitizer like DOMPurify on the output before inserting into the DOM.
 * @property {Object.<string, number>} [blockHeights] - Measured block heights for fixed mode (% of canvas)
 * @property {boolean} [embeds=true] - False: a video page (YouTube, Vimeo, Dailymotion) becomes a link, not a frame
 * @property {boolean} [includeLabels=true] - Include block name labels
 */

/**
 * Render an AST node (or array of nodes) to an HTML string.
 *
 * @param {CanvasNode|CanvasNode[]|MediaNode|InlineStyledNode} ast - AST node(s) to render
 * @param {RenderOptions} [options]
 * @returns {string} HTML string
 *
 * @example
 *   const html = renderToHTML(canvasNode, {
 *     renderMarkdown: text => marked.parse(text)
 *   });
 */
export function renderToHTML(ast, options = {}) {
  if (!ast) return '';

  if (Array.isArray(ast)) {
    return ast.map(node => renderToHTML(node, options)).join('\n');
  }

  switch (ast.type) {
    case 'canvas':  return _renderCanvas(ast, options);
    case 'block':   return _renderBlock(ast, options);
    case 'media':   return _renderMedia(ast, options);
    case 'inline-styled': return _renderInlineStyled(ast, options);
    default:
      console.error(`[mdlayout:html-renderer] Unknown AST node type: "${ast.type}"`);
      return '';
  }
}

// ── Canvas ────────────────────────────────────────────────────────────

/**
 * @param {CanvasNode} canvas
 * @param {RenderOptions} options
 * @returns {string}
 */
function _renderCanvas(canvas, options) {
  const mode = canvas.hints.mode || 'responsive';
  const { classes, style, dataAttrs } = resolveHints(canvas.hints);

  // Solve layout
  let layoutMap = null;
  if (mode === 'fixed') {
    layoutMap = solveConstraints(canvas, {
      blockHeights: options.blockHeights,
    });
  } else {
    layoutMap = solveGrid(canvas);
  }

  // Canvas classes
  const allClasses = ['mdl-canvas', `mdl-canvas--${mode}`, ...classes];

  // Canvas style
  const styleParts = [];
  if (style) styleParts.push(style);

  // Aspect ratio from hints
  if (canvas.hints.ratio) {
    const rm = canvas.hints.ratio.toString().match(/^(\d+)[:/](\d+)$/);
    if (rm) styleParts.push(`aspect-ratio:${rm[1]} / ${rm[2]}`);
  }

  const styleAttr = styleParts.length > 0 ? ` style="${_escAttr(styleParts.join(';'))}"` : '';
  const dataStr = _dataStr(dataAttrs);
  const modeAttr = ` data-mode="${mode}"`;
  const hintsAttr = ` data-hints="${_escAttr(_hintsToString(canvas.hints))}"`;

  // Render children
  let autoIdx = 0;
  const childrenHtml = canvas.children.map((block, idx) => {
    const blockName = block.name || `__anon_${autoIdx++}`;
    const layout = layoutMap ? layoutMap.get(blockName) : null;
    return _renderBlockInCanvas(block, blockName, idx, layout, mode, options);
  }).join('\n');

  return `<div class="${allClasses.join(' ')}"${modeAttr}${hintsAttr}${styleAttr}${dataStr}>\n${childrenHtml}\n</div>`;
}

// ── Block (inside canvas) ─────────────────────────────────────────────

/**
 * @param {BlockNode} block
 * @param {string} blockName
 * @param {number} idx
 * @param {Object|null} layout
 * @param {string} mode
 * @param {RenderOptions} options
 * @returns {string}
 */
function _renderBlockInCanvas(block, blockName, idx, layout, mode, options) {
  const { classes, style, dataAttrs } = resolveHints(block.hints);
  const allClasses = ['mdl-block', ...classes];

  const styleParts = [];
  if (style) styleParts.push(style);

  // Apply solved layout
  if (layout && mode === 'fixed') {
    styleParts.push(`position:absolute`);
    styleParts.push(`left:${layout.x}%`);
    styleParts.push(`top:${layout.y}%`);
    styleParts.push(`width:${layout.width}%`);
  } else if (layout && mode === 'responsive') {
    if (layout.gridRow !== null) {
      styleParts.push(`grid-row:${layout.gridRow}`);
    }
    styleParts.push(`grid-column:${layout.gridColumn} / span ${layout.gridSpan}`);
  }

  const styleAttr = styleParts.length > 0 ? ` style="${_escAttr(styleParts.join(';'))}"` : '';
  const dataStr = _dataStr({
    ...dataAttrs,
    'data-block-name': blockName,
    'data-color': String((idx % 8) + 1),
  });

  // Body content
  const bodyHtml = _renderBody(block.body, options);

  // Label
  const includeLabels = options.includeLabels !== false;
  const labelHtml = includeLabels && blockName && !blockName.startsWith('__anon_')
    ? `<span class="mdl-block__label">${_esc(blockName)}</span>`
    : '';

  return `<div class="${allClasses.join(' ')}"${dataStr}${styleAttr}>${labelHtml}<div class="mdl-block__content">${bodyHtml}</div></div>`;
}

// ── Standalone block ──────────────────────────────────────────────────

/**
 * @param {BlockNode} block
 * @param {RenderOptions} options
 * @returns {string}
 */
function _renderBlock(block, options) {
  const { classes, style, dataAttrs } = resolveHints(block.hints);
  const allClasses = ['mdl-block', ...classes];

  const styleAttr = style ? ` style="${_escAttr(style)}"` : '';
  const nameAttr = block.name ? ` data-block-name="${_escAttr(block.name)}"` : '';
  const dataStr = _dataStr(dataAttrs);

  const bodyHtml = _renderBody(block.body, options);

  return `<div class="${allClasses.join(' ')}"${nameAttr}${dataStr}${styleAttr}><div class="mdl-block__content">${bodyHtml}</div></div>`;
}

// ── Media ─────────────────────────────────────────────────────────────

/**
 * @param {MediaNode} media
 * @param {RenderOptions} options
 * @returns {string}
 */
function _renderMedia(media, options) {
  const { classes, style } = resolveHints(media.hints);
  const allClasses = ['mdl-media', `mdl-media--${media.mediaType}`, ...classes];
  const styleAttr = style ? ` style="${_escAttr(style)}"` : '';

  let innerHtml;
  switch (media.mediaType) {
    case 'image':
      innerHtml = `<img src="${_escAttr(media.url)}" alt="${_escAttr(media.alt)}" loading="lazy" />`;
      break;
    case 'video': {
      // Une page YouTube, Vimeo ou Dailymotion : le lecteur du site, dans un cadre fermé — ou, là où les cadres sont
      // interdits (`embeds: false`, l'aperçu de VS Code), un lien vers la page de la vidéo plutôt qu'un cadre vide.
      const player = embedUrl(media.url);
      if (player && options.embeds === false) {
        const host = (media.url.match(/^https:\/\/(?:www\.)?([^/]+)/) || [])[1] || media.url;
        innerHtml = `<a class="mdl-media__link" href="${_escAttr(media.url)}">▶ ${_esc(media.alt || host)}</a>`;
        break;
      }
      innerHtml = player
        ? `<iframe src="${_escAttr(player)}" sandbox="allow-scripts allow-same-origin allow-presentation" allow="fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" loading="lazy"></iframe>`
        : `<video src="${_escAttr(media.url)}" controls></video>`;
      break;
    }
    case 'audio':
      innerHtml = `<audio src="${_escAttr(media.url)}" controls></audio>`;
      break;
    default:
      console.error(`[mdlayout:html-renderer] Unknown media type: "${media.mediaType}"`);
      innerHtml = '';
  }

  return `<figure class="${allClasses.join(' ')}"${styleAttr}>${innerHtml}</figure>`;
}

// ── Inline Styled ─────────────────────────────────────────────────────

/**
 * @param {InlineStyledNode} node
 * @param {RenderOptions} options
 * @returns {string}
 */
function _renderInlineStyled(node, options) {
  const { classes, style } = resolveHints(node.hints);
  const allClasses = ['mdl-styled', ...classes];
  const styleAttr = style ? ` style="${_escAttr(style)}"` : '';
  const text = options.renderMarkdown ? options.renderMarkdown(node.text) : _esc(node.text);

  return `<span class="${allClasses.join(' ')}"${styleAttr}>${text}</span>`;
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Render block body to HTML.
 * @param {string} body
 * @param {RenderOptions} options
 * @returns {string}
 */
function _renderBody(body, options) {
  if (!body) return '';
  if (options.renderMarkdown) {
    return options.renderMarkdown(body);
  }
  return _esc(body);
}

/**
 * Escape HTML entities.
 * @param {string} str
 * @returns {string}
 */
function _esc(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Escape for HTML attribute values.
 * @param {string} str
 * @returns {string}
 */
function _escAttr(str) {
  return _esc(str);
}

/**
 * Build data attributes string.
 * @param {Object.<string, string>} attrs
 * @returns {string}
 */
function _dataStr(attrs) {
  if (!attrs || Object.keys(attrs).length === 0) return '';
  return ' ' + Object.entries(attrs)
    .map(([k, v]) => `${k}="${_escAttr(v)}"`)
    .join(' ');
}

/**
 * Serialize a HintMap back to a hint string.
 * Values containing spaces or commas are quoted with double quotes, ensuring
 * the output is re-parsable by hint-parser.parseHints() without data loss.
 * This round-trip property is relied upon by the editor for data-hints
 * attributes on canvas elements.
 * @param {Object} hints
 * @returns {string}
 */
function _hintsToString(hints) {
  if (!hints) return '';
  return Object.entries(hints)
    .map(([k, v]) => {
      if (v === true) return k;
      const sv = String(v);
      // Quote values that contain spaces or commas to avoid ambiguity
      if (sv.includes(' ') || sv.includes(',')) return `${k}:"${sv}"`;
      return `${k}:${sv}`;
    })
    .join(', ');
}
