// ── Marked Plugin Adapter ─────────────────────────────────────────────
// Adapter for marked@15+ that integrates mdlayout as a marked extension.
//
// Usage:
//   import { markedMdLayout } from '@ecume/mdlayout/marked';
//   import { marked } from 'marked';
//   marked.use(markedMdLayout());
//
// Handles:
//   - ::::canvas{hints} ... :::: → spatial canvas blocks
//   - ![alt](url){hints} → images with layout hints
//   - !video(url){hints} → video embeds
//   - !audio(url){hints} → audio embeds
//   - [text]{hints} → inline styled spans
//
// Zero external dependencies (marked is a peer dependency).

import { parseCanvas } from '../parser/canvas-parser.js';
import { parseMedia } from '../parser/media-parser.js';
import { parseInlineStyled } from '../parser/inline-parser.js';
import { renderToHTML } from '../renderer/html-renderer.js';

/**
 * @typedef {Object} MdLayoutOptions
 * @property {boolean} [includeLabels=true] - Show block name labels
 * @property {Object.<string, number>} [blockHeights] - Block height estimates for fixed mode
 * @property {function(string): string} [renderMarkdown] - Custom function to render markdown
 *   body content inside blocks. If provided, this is used instead of the internal marked
 *   instance capture. The caller is responsible for sanitizing the output (e.g. via DOMPurify).
 */

/**
 * Create a marked extension for mdlayout.
 *
 * @param {MdLayoutOptions} [options]
 * @returns {Object} Marked extension object compatible with `marked.use()`
 *
 * @example
 *   import { marked } from 'marked';
 *   import { markedMdLayout } from '@ecume/mdlayout/marked';
 *
 *   marked.use(markedMdLayout());
 *   const html = marked.parse('::::canvas{responsive}\n:::hero{full}\n# Hello\n:::\n::::');
 */
export function markedMdLayout(options = {}) {
  // User-supplied renderMarkdown takes priority over internal capture.
  const _userRenderMarkdown = options.renderMarkdown || null;

  // Reference to the marked instance (captured via walkTokens which
  // reliably receives the Lexer's `this` — more robust than the
  // preprocess hook whose `this` binding varies across marked versions).
  let _markedInstance = null;

  /**
   * Render block-level markdown content. Uses user-supplied function if
   * provided, otherwise falls back to the captured marked instance.
   * @param {string} text
   * @returns {string}
   */
  function _renderBlock(text) {
    if (_userRenderMarkdown) return _userRenderMarkdown(text);
    if (_markedInstance && typeof _markedInstance.parse === 'function') {
      try {
        return _markedInstance.parse(text);
      } catch (err) {
        console.error('[mdlayout:marked] Block body render error:', err);
      }
    }
    return _escapeHtml(text);
  }

  /**
   * Render inline markdown content.
   * @param {string} text
   * @returns {string}
   */
  function _renderInline(text) {
    if (_userRenderMarkdown) return _userRenderMarkdown(text);
    if (_markedInstance && typeof _markedInstance.parseInline === 'function') {
      try {
        return _markedInstance.parseInline(text);
      } catch (err) {
        console.error('[mdlayout:marked] Inline styled render error:', err);
      }
    }
    return _escapeHtml(text);
  }

  return {
    extensions: [
      // ── Canvas block extension ──────────────────────────────────
      {
        name: 'mdlayout',
        level: 'block',

        start(src) {
          return src.indexOf('::::canvas');
        },

        tokenizer(src) {
          const canvasRe = /^::::canvas(\{[^}]*\})?([^\n]*)\n([\s\S]*?)::::\n?/;
          const match = src.match(canvasRe);
          if (!match) return undefined;

          const raw = match[0];

          // Parse using our parser
          let canvases;
          try {
            canvases = parseCanvas(raw);
          } catch (err) {
            console.error('[mdlayout:marked] Canvas parse error:', err.message);
            return undefined;
          }

          if (canvases.length === 0) return undefined;

          return {
            type: 'mdlayout',
            raw,
            canvas: canvases[0],
          };
        },

        renderer(token) {
          return renderToHTML(token.canvas, {
            includeLabels: options.includeLabels !== false,
            blockHeights: options.blockHeights,
            renderMarkdown: _renderBlock,
          });
        },
      },

      // ── Media extension (images/video/audio with hints) ─────────
      {
        name: 'mdlayout-media',
        level: 'inline',

        start(src) {
          // Quick check: starts with `![` or `!video` or `!audio`
          const idx = src.search(/!\[|!video\(|!audio\(/);
          return idx;
        },

        tokenizer(src) {
          // Image with hints: ![alt](url){hints}
          const imgRe = /^!\[([^\]]*)\]\(([^)]+)\)\{([^}]*)\}/;
          const imgMatch = src.match(imgRe);
          if (imgMatch) {
            const media = parseMedia(imgMatch[0]);
            if (media) {
              return { type: 'mdlayout-media', raw: imgMatch[0], media };
            }
          }

          // Video: !video(url){hints} or !video(url)
          const vidRe = /^!video\(([^)]+)\)(?:\{([^}]*)\})?/;
          const vidMatch = src.match(vidRe);
          if (vidMatch) {
            const media = parseMedia(vidMatch[0]);
            if (media) {
              return { type: 'mdlayout-media', raw: vidMatch[0], media };
            }
          }

          // Audio: !audio(url){hints} or !audio(url)
          const audRe = /^!audio\(([^)]+)\)(?:\{([^}]*)\})?/;
          const audMatch = src.match(audRe);
          if (audMatch) {
            const media = parseMedia(audMatch[0]);
            if (media) {
              return { type: 'mdlayout-media', raw: audMatch[0], media };
            }
          }

          return undefined;
        },

        renderer(token) {
          return renderToHTML(token.media, {
            includeLabels: options.includeLabels !== false,
          });
        },
      },

      // ── Inline styled extension ─────────────────────────────────
      {
        name: 'mdlayout-inline',
        level: 'inline',

        start(src) {
          // Look for `[text]{hints}` but NOT `[text](url)`
          const idx = src.search(/\[[^\]]+\]\{/);
          return idx;
        },

        tokenizer(src) {
          const re = /^\[([^\]]+)\]\{([^}]*)\}/;
          const match = src.match(re);
          if (!match) return undefined;

          const { nodes } = parseInlineStyled(match[0]);
          if (nodes.length === 0) return undefined;

          return {
            type: 'mdlayout-inline',
            raw: match[0],
            node: nodes[0],
          };
        },

        renderer(token) {
          return renderToHTML(token.node, {
            renderMarkdown: _renderInline,
          });
        },
      },
    ],

    hooks: {
      preprocess(markdown) {
        // Capture the marked instance for use in renderers.
        // In marked@15+ `this` inside preprocess is the marked Lexer/instance.
        if (this && typeof this.parse === 'function') {
          _markedInstance = this;
        }
        return markdown;
      },
    },
  };
}

/**
 * Escape HTML entities (minimal, no DOM).
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
