// ── Block Parser ──────────────────────────────────────────────────────
// Parses a single `:::name{hints}\ncontent\n:::` block from an array
// of lines starting at a given index.
//
// Rules:
//   - Name is optional: `:::` alone creates an anonymous block
//   - Hints are optional: `:::name` without `{...}` has empty hints
//   - Body is everything between opening and closing `:::`
//   - Closing `:::` must be on its own line (may have trailing whitespace)
//   - Does NOT handle `::::` (4+ colons) — that's canvas-parser's job
//
// Zero dependencies except hint-parser.

import { parseHints } from './hint-parser.js';

/**
 * @typedef {import('../ast/types.js').BlockNode} BlockNode
 */

/**
 * Parse a block starting at `startIndex` in `lines`.
 *
 * @param {string[]} lines - Array of source lines
 * @param {number} startIndex - Index of the opening `:::` line
 * @returns {{ node: BlockNode, endIndex: number }} The parsed block and the index of the closing `:::` line
 * @throws {Error} If the block is not properly closed
 *
 * @example
 *   const lines = [':::hero{full, bg:#1a1a2e}', '# Title', ':::', ''];
 *   const { node, endIndex } = parseBlock(lines, 0);
 *   // node = { type:'block', name:'hero', hints:{width:'full', bg:'#1a1a2e'}, body:'# Title' }
 *   // endIndex = 2
 */
export function parseBlock(lines, startIndex) {
  const openLine = lines[startIndex];

  // Match opening: ::: followed by optional name and optional {hints}
  // Must be exactly 3 colons (not 4+)
  const openRe = /^:::(?!:)(\w+)?(?:\{([^}]*)\})?\s*$/;
  const match = openLine.match(openRe);

  if (!match) {
    throw new Error(
      `[mdlayout:block-parser] Line ${startIndex + 1}: invalid block opening: "${openLine}"`
    );
  }

  const name = match[1] || null;
  const hintsStr = match[2] || '';
  const hints = parseHints(hintsStr);

  // Collect body lines until closing :::
  const bodyLines = [];
  let i = startIndex + 1;
  let closed = false;

  while (i < lines.length) {
    const line = lines[i];

    // Closing: exactly 3 colons (not 4+), possibly with trailing whitespace
    if (/^:::(?!:)\s*$/.test(line)) {
      closed = true;
      break;
    }

    bodyLines.push(line);
    i++;
  }

  if (!closed) {
    throw new Error(
      `[mdlayout:block-parser] Block "${name || 'anonymous'}" opened at line ${startIndex + 1} is never closed`
    );
  }

  return {
    node: {
      type: 'block',
      name,
      hints,
      body: bodyLines.join('\n').trim(),
    },
    endIndex: i,
  };
}

/**
 * Test whether a line is a block opening (exactly 3 colons, not 4+).
 *
 * @param {string} line
 * @returns {boolean}
 */
export function isBlockOpening(line) {
  return /^:::(?!:)(\w+)?(?:\{[^}]*\})?\s*$/.test(line);
}
