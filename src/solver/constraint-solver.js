// ── Constraint Solver (Fixed Mode) ────────────────────────────────────
// Positions blocks within a fixed canvas using relational constraints.
//
// Pipeline:
//   1. Build dependency graph from block hints (below, beside, etc.)
//   2. Topological sort (detect cycles)
//   3. Resolve positions in dependency order
//
// Ported from layout-engine.js, restructured as pure function (no DOM).
// Zero dependencies except width-resolver.

import { resolveWidth } from '../resolver/width-resolver.js';
import { parseRefs } from '../utils.js';

/** @typedef {import('../ast/types.js').CanvasNode} CanvasNode */
/** @typedef {import('../ast/types.js').BlockNode} BlockNode */

/**
 * @typedef {Object} BlockLayout
 * @property {number} x - X position as percentage (0-100)
 * @property {number} y - Y position as percentage (0-100)
 * @property {number} width - Width as percentage (0-100)
 * @property {number} height - Height as percentage (0-100)
 */

/**
 * Default block height estimate (percentage of canvas).
 * Used when no content measurement is available.
 * @type {number}
 */
const DEFAULT_HEIGHT_PCT = 15;

/**
 * Solve fixed-mode layout constraints for a canvas.
 *
 * @param {CanvasNode} canvas - The canvas AST node
 * @param {{ width?: number, height?: number, blockHeights?: Object.<string, number> }} [options]
 *   - width/height: container dimensions in pixels (for height estimation)
 *   - blockHeights: measured heights per block name (in % of canvas height)
 * @returns {Map<string, BlockLayout>} Position and size for each named block
 *
 * @example
 *   const canvas = parseCanvas('::::canvas{fixed}\n:::hero{full}\n...\n:::\n:::aside{beside hero, third}\n...\n:::\n::::')[0];
 *   const layout = solveConstraints(canvas);
 *   // → Map { 'hero' => {x:0, y:0, width:100, height:15}, 'aside' => {x:100, y:0, width:33.33, height:15} }
 */
export function solveConstraints(canvas, options = {}) {
  const blockHeights = options.blockHeights || {};
  const blocks = canvas.children || [];
  const result = new Map();

  if (blocks.length === 0) return result;

  // ── Index blocks by name ────────────────────────────────────────────
  const byName = new Map();
  let autoIdx = 0;
  for (const block of blocks) {
    const name = block.name || `__anon_${autoIdx++}`;
    byName.set(name, block);
  }

  // ── Parse dimensions ────────────────────────────────────────────────
  const dims = new Map();
  for (const [name, block] of byName) {
    const w = block.hints.width ? resolveWidth(block.hints.width).percent : 100;
    const h = blockHeights[name] ?? DEFAULT_HEIGHT_PCT;
    dims.set(name, { w, h });
  }

  // ── Resolve positions ───────────────────────────────────────────────
  const positions = new Map();
  const resolved = new Set();
  const resolving = new Set();

  function resolve(name) {
    if (resolved.has(name)) return positions.get(name);

    if (resolving.has(name)) {
      console.warn(`[mdlayout:constraint-solver] Circular dependency detected for block: "${name}"`);
      const d = dims.get(name) || { w: 100, h: DEFAULT_HEIGHT_PCT };
      return { x: 0, y: 0, width: d.w, height: d.h };
    }

    const block = byName.get(name);
    if (!block) {
      console.warn(`[mdlayout:constraint-solver] Referenced block not found: "${name}"`);
      return { x: 0, y: 0, width: 100, height: DEFAULT_HEIGHT_PCT };
    }

    resolving.add(name);

    const hints = block.hints;
    const { w, h } = dims.get(name);

    let x = 0;
    let y = 0;
    let isBottom = false;

    // ── Position keywords ─────────────────────────────────────────
    const posStr = hints.position || '';
    const posSet = new Set(
      typeof posStr === 'string' ? posStr.split(/\s+/).filter(Boolean) : []
    );

    // Also check top-level flags for position shortcuts
    if (hints.center === true || posStr === 'center') posSet.add('center');
    if (hints.left === true || posStr === 'left') posSet.add('left');
    if (hints.right === true || posStr === 'right') posSet.add('right');
    if (hints.top === true || posStr === 'top') posSet.add('top');
    if (hints.bottom === true || posStr === 'bottom') posSet.add('bottom');

    // X from position
    const hasBeside = !!hints.beside;
    const hasRightOf = !!hints['right-of'];
    if (posSet.has('center') && !hasBeside && !hasRightOf) {
      x = (100 - w) / 2;
    } else if (posSet.has('right') && !hasBeside && !hasRightOf) {
      x = 100 - w;
    }

    // Y from position
    if (posSet.has('top')) {
      y = 0;
    } else if (posSet.has('bottom')) {
      isBottom = true;
    }

    // ── Relation: overlay ──────────────────────────────────────────
    const overlayRefs = parseRefs(hints.overlay);
    if (overlayRefs.length > 0) {
      const refPos = resolve(overlayRefs[0]);
      x = refPos.x;
      y = refPos.y;
      // Override width/height to match the referenced block
      dims.set(name, { w: refPos.width, h: refPos.height });
      const pos = { x, y, width: refPos.width, height: refPos.height };
      positions.set(name, pos);
      resolved.add(name);
      resolving.delete(name);
      return pos;
    }

    // ── Relation: below ───────────────────────────────────────────
    const belowRefs = parseRefs(hints.below);
    if (belowRefs.length > 0) {
      let maxBottom = 0;
      let firstRefPos = null;
      for (const refName of belowRefs) {
        const refPos = resolve(refName);
        const bottom = refPos.y + refPos.height;
        if (bottom > maxBottom) {
          maxBottom = bottom;
          firstRefPos = refPos;
        }
      }
      y = maxBottom;

      // Align X on first ref if no explicit horizontal position
      const hasExplicitX = posSet.has('left') || posSet.has('right') || posSet.has('center') ||
                           hasBeside || hasRightOf;
      if (!hasExplicitX && firstRefPos) {
        x = firstRefPos.x;
      }
    }

    // ── Relation: beside / right-of ───────────────────────────────
    const besideRefs = parseRefs(hints.beside);
    const rightOfRefs = parseRefs(hints['right-of']);
    const allRightRefs = [...besideRefs, ...rightOfRefs];
    if (allRightRefs.length > 0) {
      const refPos = resolve(allRightRefs[0]);
      x = refPos.x + refPos.width;
      if (belowRefs.length === 0 && !posSet.has('top') && !posSet.has('bottom')) {
        y = refPos.y;
      }
    }

    // ── Relation: left-of ─────────────────────────────────────────
    const leftOfRefs = parseRefs(hints['left-of']);
    if (leftOfRefs.length > 0) {
      const refPos = resolve(leftOfRefs[0]);
      x = refPos.x - w;
      if (belowRefs.length === 0 && !posSet.has('top')) {
        y = refPos.y;
      }
    }

    // ── Relation: above ───────────────────────────────────────────
    const aboveRefs = parseRefs(hints.above);
    if (aboveRefs.length > 0) {
      const refPos = resolve(aboveRefs[0]);
      y = refPos.y - h;
      const hasExplicitX = posSet.has('left') || posSet.has('right') || posSet.has('center') ||
                           hasBeside;
      if (!hasExplicitX) x = refPos.x;
    }

    // ── Absolute position: at ─────────────────────────────────────
    if (hints.at) {
      const parts = hints.at.toString().split(/\s+/);
      x = parseFloat((parts[0] || '0').replace('%', ''));
      y = parseFloat((parts[1] || '0').replace('%', ''));
    }

    const pos = { x, y, width: w, height: h };
    positions.set(name, pos);
    resolved.add(name);
    resolving.delete(name);
    return pos;
  }

  // ── First pass: resolve non-bottom blocks ───────────────────────────
  const bottomNames = [];
  for (const [name, block] of byName) {
    const posStr = block.hints.position || '';
    const isBottomPos = posStr === 'bottom' || block.hints.bottom === true;
    const hasAbove = !!block.hints.above;
    const hasAt = !!block.hints.at;

    if (isBottomPos && !hasAbove && !hasAt) {
      bottomNames.push(name);
    } else {
      resolve(name);
    }
  }

  // ── Second pass: resolve bottom blocks ──────────────────────────────
  for (const name of bottomNames) {
    const d = dims.get(name) || { w: 100, h: DEFAULT_HEIGHT_PCT };
    const block = byName.get(name);
    const posStr = block.hints.position || '';
    const posSet = new Set(posStr.split(/\s+/).filter(Boolean));
    if (block.hints.center === true) posSet.add('center');
    if (block.hints.right === true) posSet.add('right');

    let bx = 0;
    if (posSet.has('center')) bx = (100 - d.w) / 2;
    if (posSet.has('right')) bx = 100 - d.w;

    positions.set(name, { x: bx, y: 100 - d.h, width: d.w, height: d.h });
    resolved.add(name);
  }

  return positions;
}
