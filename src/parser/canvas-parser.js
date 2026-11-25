// ── Canvas Parser ─────────────────────────────────────────────────────
// Parses `::::canvas{hints}\n...\n::::` blocks from markdown source.
//
// A canvas contains child blocks (`:::name{hints}\n...\n:::`).
// Multiple canvases can exist in a single document.
// Nesting canvases inside blocks is an error.
//
// Zero dependencies except hint-parser and block-parser.

import { parseHints } from './hint-parser.js';
import { parseBlock, isBlockOpening } from './block-parser.js';

/**
 * @typedef {import('../ast/types.js').CanvasNode} CanvasNode
 */

/**
 * Parse all canvas blocks from a markdown text.
 *
 * @param {string} text - Full markdown source
 * @returns {CanvasNode[]} Array of canvas AST nodes
 *
 * @example
 *   const canvases = parseCanvas('::::canvas{responsive}\n:::hero{full}\n# Title\n:::\n::::');
 *   // → [{ type:'canvas', hints:{mode:'responsive'}, children:[...], raw:'...' }]
 */
export function parseCanvas(text) {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split('\n');
  const canvases = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Canvas opening: 4+ colons followed by "canvas" and optional hints
    const canvasOpenRe = /^::::canvas(?:\{([^}]*)\})?\s*$/;
    const match = line.match(canvasOpenRe);

    if (!match) {
      i++;
      continue;
    }

    const hintsStr = match[1] || '';
    const hints = parseHints(hintsStr);
    const rawLines = [line];
    const children = [];
    let j = i + 1;
    let closed = false;

    while (j < lines.length) {
      const innerLine = lines[j];

      // Canvas closing: exactly 4 colons (no more)
      if (/^::::\s*$/.test(innerLine)) {
        rawLines.push(innerLine);
        closed = true;
        break;
      }

      // Nested canvas = error
      if (/^::::canvas/.test(innerLine)) {
        throw new Error(
          `[mdlayout:canvas-parser] Line ${j + 1}: nested canvas is not allowed`
        );
      }

      // Block opening inside canvas
      if (isBlockOpening(innerLine)) {
        const { node, endIndex } = parseBlock(lines, j);
        children.push(node);

        // Collect raw lines for the block
        for (let k = j; k <= endIndex; k++) {
          rawLines.push(lines[k]);
        }

        j = endIndex + 1;
        continue;
      }

      // Non-block content inside canvas: warn and preserve in raw.
      // Text between :::block::: markers inside a canvas has no semantic
      // meaning — it is likely a formatting mistake by the author.
      if (innerLine.trim()) {
        console.warn(
          `[mdlayout:canvas-parser] Line ${j + 1}: non-block content inside canvas ignored: "${innerLine.trim()}"`
        );
      }
      rawLines.push(innerLine);
      j++;
    }

    if (!closed) {
      throw new Error(
        `[mdlayout:canvas-parser] Canvas opened at line ${i + 1} is never closed (missing ::::)`
      );
    }

    canvases.push({
      type: 'canvas',
      hints,
      children,
      raw: rawLines.join('\n'),
    });

    i = j + 1;
  }

  return canvases;
}
