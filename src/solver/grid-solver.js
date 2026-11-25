// ── Grid Solver (Responsive Mode) ─────────────────────────────────────
// Assigns CSS grid positions to blocks in responsive canvas mode.
//
// Rules:
//   - `beside X` / `right-of X` → same row as X
//   - `below X` → next row
//   - Widths map to grid column spans (12-column grid)
//   - Explicit `row`, `col`, `span` hints override automatic placement
//
// Ported from layout-engine.js _solveResponsive(), restructured as pure function.
// Zero dependencies except width-resolver.

import { resolveWidth, percentToGridSpan } from '../resolver/width-resolver.js';
import { parseRefs } from '../utils.js';

/** @typedef {import('../ast/types.js').CanvasNode} CanvasNode */

/**
 * @typedef {Object} GridPosition
 * @property {number|null} gridRow - CSS grid row number (null = auto)
 * @property {number|string} gridColumn - CSS grid column start (number or 'auto')
 * @property {number} gridSpan - Number of columns to span (1-12)
 */

/**
 * Solve responsive grid layout for a canvas.
 *
 * @param {CanvasNode} canvas - The canvas AST node
 * @returns {Map<string, GridPosition>} Grid position for each named block
 *
 * @example
 *   const layout = solveGrid(canvas);
 *   // → Map {
 *   //   'hero'  => { gridRow: 1, gridColumn: 'auto', gridSpan: 12 },
 *   //   'aside' => { gridRow: 1, gridColumn: 'auto', gridSpan: 4 }
 *   // }
 */
export function solveGrid(canvas) {
  const blocks = canvas.children || [];
  const result = new Map();

  if (blocks.length === 0) return result;

  const rowOf = new Map();
  let autoRow = 1;
  let autoIdx = 0;

  for (const block of blocks) {
    const name = block.name || `__anon_${autoIdx++}`;
    const hints = block.hints;

    // ── Explicit grid hints ───────────────────────────────────────
    if (hints.row) {
      const gridRow = parseInt(hints.row, 10);
      const gridCol = hints.col ? parseInt(hints.col, 10) : 'auto';
      const widthPct = hints.width ? resolveWidth(hints.width).percent : 100;
      const gridSpan = hints.span
        ? parseInt(hints.span, 10)
        : percentToGridSpan(widthPct);

      result.set(name, { gridRow, gridColumn: gridCol, gridSpan });
      rowOf.set(name, gridRow);
      continue;
    }

    // ── Relation: overlay → same row/column as ref ─────────────────
    const overlayRefs = parseRefs(hints.overlay);
    if (overlayRefs.length > 0) {
      const refName = overlayRefs[0];
      const refResult = result.get(refName);
      const refRow = rowOf.get(refName) ?? autoRow;
      const refSpan = refResult ? refResult.gridSpan : 12;
      const refCol = refResult ? refResult.gridColumn : 'auto';

      result.set(name, { gridRow: refRow, gridColumn: refCol, gridSpan: refSpan });
      rowOf.set(name, refRow);
      continue;
    }

    // ── Relation: beside / right-of → same row as ref ─────────────
    const besideRefs = parseRefs(hints.beside);
    const rightOfRefs = parseRefs(hints['right-of']);
    const allRightRefs = [...besideRefs, ...rightOfRefs];

    if (allRightRefs.length > 0) {
      const refRow = rowOf.get(allRightRefs[0]) ?? autoRow;
      const widthPct = hints.width ? resolveWidth(hints.width).percent : 100;
      const gridSpan = hints.span
        ? parseInt(hints.span, 10)
        : percentToGridSpan(widthPct);

      result.set(name, { gridRow: refRow, gridColumn: 'auto', gridSpan });
      rowOf.set(name, refRow);
      continue;
    }

    // ── Relation: below → explicit next row after ref ─────────────
    const belowRefs = parseRefs(hints.below);
    if (belowRefs.length > 0) {
      let maxRefRow = 0;
      for (const refName of belowRefs) {
        const rr = rowOf.get(refName);
        if (rr !== undefined && rr > maxRefRow) maxRefRow = rr;
      }
      const thisRow = maxRefRow > 0 ? maxRefRow + 1 : autoRow;
      const widthPct = hints.width ? resolveWidth(hints.width).percent : 100;
      const gridSpan = hints.span
        ? parseInt(hints.span, 10)
        : percentToGridSpan(widthPct);

      result.set(name, { gridRow: thisRow, gridColumn: 'auto', gridSpan });
      rowOf.set(name, thisRow);
      if (thisRow >= autoRow) autoRow = thisRow + 1;
      continue;
    }

    // ── Default: new row ──────────────────────────────────────────
    const widthPct = hints.width ? resolveWidth(hints.width).percent : 100;
    const gridSpan = hints.span
      ? parseInt(hints.span, 10)
      : percentToGridSpan(widthPct);

    result.set(name, { gridRow: null, gridColumn: 'auto', gridSpan });
    rowOf.set(name, autoRow);
    autoRow++;
  }

  return result;
}
