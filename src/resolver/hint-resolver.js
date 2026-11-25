// ── Hint Resolver ─────────────────────────────────────────────────────
// Transforms a HintMap into a combined { classes, style, dataAttrs }
// ready for rendering.
//
// Delegates to:
//   - width-resolver: width keywords → CSS class + value
//   - style-resolver: visual properties → inline CSS + classes
//
// Also handles:
//   - Position keywords (top, bottom, left, right, center)
//   - Relation keywords (below, above, beside, right-of, left-of, overlay)
//   - Absolute positioning (at)
//   - Content modes (flow, scale, clip, scroll, fit)
//   - Grid properties (row, col, span)
//   - Aspect ratio
//   - z-index shortcuts (front, back)
//
// Zero external dependencies.

import { resolveWidth } from './width-resolver.js';
import { resolveStyles } from './style-resolver.js';

/** @typedef {import('../ast/types.js').HintMap} HintMap */

const POSITION_KW = new Set(['top', 'bottom', 'left', 'right', 'center']);
const RELATION_KW = new Set(['below', 'above', 'beside', 'right-of', 'left-of', 'overlay']);
const CONTENT_KW  = new Set(['flow', 'scale', 'clip', 'scroll', 'fit']);

/**
 * @typedef {Object} ResolvedHints
 * @property {string[]} classes - CSS class names to apply
 * @property {string} style - Inline CSS string (semicolon-separated)
 * @property {Object.<string, string>} dataAttrs - Data attributes (key includes 'data-' prefix)
 */

/**
 * Resolve a HintMap into classes, inline style, and data attributes.
 *
 * @param {HintMap} hints - Parsed hint map
 * @returns {ResolvedHints}
 *
 * @example
 *   resolveHints({ width: 'half', color: 'red', below: 'hero' })
 *   // → {
 *   //   classes: ['mdl--half'],
 *   //   style: 'color:red',
 *   //   dataAttrs: { 'data-below': 'hero' }
 *   // }
 */
export function resolveHints(hints) {
  if (!hints || typeof hints !== 'object') {
    return { classes: [], style: '', dataAttrs: {} };
  }

  /** @type {string[]} */
  const classes = [];
  /** @type {string[]} */
  const styleProps = [];
  /** @type {Object.<string, string>} */
  const dataAttrs = {};

  // ── Width ───────────────────────────────────────────────────────────
  if (hints.width) {
    const w = resolveWidth(hints.width);
    if (w.cssClass) classes.push(w.cssClass);
    // If no cssClass (direct value), use inline style
    if (!w.cssClass && w.cssValue !== '100%') {
      styleProps.push(`width:${w.cssValue}`);
    }
  }

  // ── Position keywords ───────────────────────────────────────────────
  if (hints.position) {
    const positions = hints.position.toString().split(/\s+/);
    for (const p of positions) {
      if (POSITION_KW.has(p)) classes.push(`mdl--${p}`);
    }
  }

  // ── Relations ───────────────────────────────────────────────────────
  for (const rel of RELATION_KW) {
    if (hints[rel]) {
      const value = typeof hints[rel] === 'string' ? hints[rel] : '';
      if (value) {
        dataAttrs[`data-${rel}`] = value;
        classes.push('mdl--rel');
      }
    }
  }

  // ── Absolute position: at ───────────────────────────────────────────
  if (hints.at) {
    const parts = hints.at.toString().split(/\s+/);
    const x = (parts[0] || '0').replace('%', '');
    const y = (parts[1] || '0').replace('%', '');
    styleProps.push(`left:${x}%`);
    styleProps.push(`top:${y}%`);
    dataAttrs['data-at'] = `${x} ${y}`;
    classes.push('mdl--absolute');
  }

  // ── Content mode flags ──────────────────────────────────────────────
  for (const kw of CONTENT_KW) {
    if (hints[kw]) classes.push(`mdl--${kw}`);
  }

  // ── Aspect ratio ────────────────────────────────────────────────────
  if (hints.ratio) {
    const rm = hints.ratio.toString().match(/^(\d+)[:/](\d+)$/);
    if (rm) {
      styleProps.push(`aspect-ratio:${rm[1]} / ${rm[2]}`);
      dataAttrs['data-ratio'] = `${rm[1]}:${rm[2]}`;
    }
  }

  // ── Grid properties ─────────────────────────────────────────────────
  if (hints.row) dataAttrs['data-grid-row'] = hints.row.toString();
  if (hints.col) dataAttrs['data-grid-col'] = hints.col.toString();
  if (hints.span) dataAttrs['data-grid-span'] = hints.span.toString();

  // ── Shape properties (preserved as data-shape-* for round-trip) ─────
  // These are read back by the Encre canvas to regenerate the SVG after
  // markdown → HTML render (see core/js/canvas/shapes.js).
  if (hints.shape) {
    dataAttrs['data-shape'] = hints.shape.toString();
    if (hints.fill)          dataAttrs['data-shape-fill']          = hints.fill.toString();
    if (hints.stroke)        dataAttrs['data-shape-stroke']        = hints.stroke.toString();
    if (hints.strokeWidth)   dataAttrs['data-shape-stroke-width']  = hints.strokeWidth.toString();
    if (hints.cornerRadius)  dataAttrs['data-shape-corner-radius'] = hints.cornerRadius.toString();
    if (hints.arrowHead)     dataAttrs['data-shape-arrow-head']    = hints.arrowHead.toString();
    if (hints.points)        dataAttrs['data-shape-points']        = hints.points.toString();
    if (hints.inset)         dataAttrs['data-shape-inset']         = hints.inset.toString();
    if (hints.customPoints)  dataAttrs['data-shape-custom-points'] = hints.customPoints.toString();
  }

  // ── Visual styles (delegated) ───────────────────────────────────────
  const resolved = resolveStyles(hints);
  classes.push(...resolved.classes);
  if (resolved.style) styleProps.push(resolved.style);

  return {
    classes,
    style: styleProps.join(';'),
    dataAttrs,
  };
}
