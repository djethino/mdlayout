// ── @ecume/mdlayout — Public API ──────────────────────────────────────
// Spatial layout extension for Markdown.
// Zero dependencies, pure JS, no DOM.
//
// Usage (standalone):
//   import { mdlayout, parseCanvas, renderToHTML } from '@asymptomatik/mdlayout';
//   const html = mdlayout('::::canvas{responsive}\n:::hero{full}\n# Hello\n:::\n::::');
//
// Usage (with marked):
//   import { markedMdLayout } from '@ecume/mdlayout/marked';
//   marked.use(markedMdLayout());

// ── Internal imports for the mdlayout() convenience function ──────────
import { parsePages as _parsePages } from './page/page.js';
import { renderPage as _renderPage } from './page/render.js';
import { parseCanvas as _parseCanvas } from './parser/canvas-parser.js';
import { parseMedia as _parseMedia } from './parser/media-parser.js';
import { parseInlineStyled as _parseInlineStyled } from './parser/inline-parser.js';
import { renderToHTML as _renderToHTML } from './renderer/html-renderer.js';

// ── Parsers ───────────────────────────────────────────────────────────
export { parseHints } from './parser/hint-parser.js';
export { parseCanvas } from './parser/canvas-parser.js';
export { parseBlock, isBlockOpening } from './parser/block-parser.js';
export { parseMedia } from './parser/media-parser.js';
export { embedUrl } from './media/embed.js';
export { parsePages, writePage, resolvePage, readHints, writeHints, hint, setHint, freshName } from './page/page.js';
export { renderPage, generatePageCSS, safeColor, readGradient } from './page/render.js';
export { shapePath, SHAPES, STROKES } from './page/shapes.js';
export { toPx, fromPx, pageSize, PAGE_SIZES } from './page/units.js';
export { parseInlineStyled } from './parser/inline-parser.js';

// ── Tables: merged cells (`>`, `^`) and cell styles (`{bg:…}`) ────────
export { cellHint, hintOf, markOf, spansOf, marksOf, processTable, processTables } from './table/table.js';

// ── AST factories ─────────────────────────────────────────────────────
export { createCanvas, createBlock, createMedia, createInlineStyled } from './ast/types.js';

// ── Resolvers ─────────────────────────────────────────────────────────
export { resolveHints } from './resolver/hint-resolver.js';
export { resolveWidth, percentToGridSpan } from './resolver/width-resolver.js';
export { resolveStyles, safeCssValue } from './resolver/style-resolver.js';

// ── Solvers ───────────────────────────────────────────────────────────
export { solveConstraints } from './solver/constraint-solver.js';
export { solveGrid } from './solver/grid-solver.js';

// ── Renderers ─────────────────────────────────────────────────────────
export { renderToHTML } from './renderer/html-renderer.js';
export { stripLayout } from './strip.js';
export { generateCSS, generateBaseCSS } from './renderer/css-generator.js';

// ── One-shot convenience ──────────────────────────────────────────────

/**
 * One-shot convenience function: parse markdown containing mdlayout
 * syntax and render to HTML.
 *
 * Handles canvases, media with hints, and inline styled spans.
 * For full markdown rendering (headings, bold, etc.), use the marked
 * adapter instead.
 *
 * @param {string} markdown - Markdown source with mdlayout syntax
 * @param {Object} [options]
 * @param {function(string): string} [options.renderMarkdown] - Callback to render markdown body
 * @param {Object.<string, number>} [options.blockHeights] - Block height estimates for fixed mode
 * @param {boolean} [options.includeLabels=true] - Show block name labels
 * @returns {string} HTML string with mdlayout elements rendered
 *
 * @example
 *   import { mdlayout } from '@ecume/mdlayout';
 *
 *   const html = mdlayout(`
 *     ::::canvas{responsive}
 *     :::hero{full, bg:#1a1a2e, color:white}
 *     # Welcome
 *     :::
 *     :::sidebar{beside hero, third}
 *     Navigation here
 *     :::
 *     ::::
 *   `);
 */
export function mdlayout(markdown, options = {}) {
  if (!markdown || typeof markdown !== 'string') return '';

  // If no renderMarkdown provided, default to HTML-escaped output (XSS-safe).
  const safeOptions = { ...options };
  if (!safeOptions.renderMarkdown) {
    safeOptions.renderMarkdown = _escapeHtml;
  }

  let result = markdown;

  // ── 0. Process pages (free layout: frames, shapes, layers) ─────────
  try {
    for (const page of _parsePages(markdown)) {
      if (page.raw) result = result.replace(page.raw, _renderPage(page, safeOptions));
    }
  } catch (err) {
    console.error('[mdlayout] Page processing error:', err.message);
  }

  // ── 1. Process canvases ─────────────────────────────────────────────
  try {
    const canvases = _parseCanvas(markdown);
    for (const canvas of canvases) {
      const html = _renderToHTML(canvas, safeOptions);
      result = result.replace(canvas.raw, html);
    }
  } catch (err) {
    console.error('[mdlayout] Canvas processing error:', err.message);
  }

  // ── 2. Process media with hints ─────────────────────────────────────
  // Process images: ![alt](url){hints}
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)\{([^}]*)\}/g, (match) => {
    try {
      const media = _parseMedia(match);
      if (media) return _renderToHTML(media, safeOptions);
    } catch (err) {
      console.error('[mdlayout] Image media processing error:', err.message);
    }
    return match;
  });

  // Process video: !video(url){hints} or !video(url)
  result = result.replace(/!video\(([^)]+)\)(?:\{([^}]*)\})?/g, (match) => {
    try {
      const media = _parseMedia(match);
      if (media) return _renderToHTML(media, safeOptions);
    } catch (err) {
      console.error('[mdlayout] Video media processing error:', err.message);
    }
    return match;
  });

  // Process audio: !audio(url){hints} or !audio(url)
  result = result.replace(/!audio\(([^)]+)\)(?:\{([^}]*)\})?/g, (match) => {
    try {
      const media = _parseMedia(match);
      if (media) return _renderToHTML(media, safeOptions);
    } catch (err) {
      console.error('[mdlayout] Audio media processing error:', err.message);
    }
    return match;
  });

  // ── 3. Process inline styled spans ──────────────────────────────────
  try {
    const { nodes, processed } = _parseInlineStyled(result);
    if (nodes.length > 0) {
      result = processed;
      for (let i = 0; i < nodes.length; i++) {
        const html = _renderToHTML(nodes[i], safeOptions);
        result = result.replace(`<!--mdl-inline-${i}-->`, html);
      }
    }
  } catch (err) {
    console.error('[mdlayout] Inline styled processing error:', err.message);
  }

  return result;
}

/**
 * Escape HTML entities (minimal, no DOM). Used as default renderMarkdown
 * to prevent XSS when no custom renderer is provided.
 * @param {string} str
 * @returns {string}
 */
function _escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
