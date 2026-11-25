// ── Width Resolver ────────────────────────────────────────────────────
// Resolves semantic width keywords to numeric percentages, CSS classes,
// and CSS values.
//
// Supports:
//   - Named widths: full, two-thirds, half, third, quarter, wide, narrow, small, large
//   - Direct values: "50%", "320px", "20rem"
//
// Zero dependencies.

/**
 * @typedef {Object} ResolvedWidth
 * @property {number} percent - Width as percentage (0-100)
 * @property {string|null} cssClass - CSS class name (e.g. 'mdl--half') or null for direct values
 * @property {string} cssValue - CSS value string (e.g. '50%', '320px')
 */

/**
 * Named width → grid columns (12-column grid).
 * @type {Object.<string, number>}
 */
const WIDTH_COLS = {
  'full':       12,
  'two-thirds': 8,
  'half':       6,
  'third':      4,
  'quarter':    3,
  'wide':       9,
  'narrow':     3,
  'small':      4,
  'large':      9,
};

/**
 * Resolve a width value to numeric percentage, CSS class, and CSS value.
 *
 * @param {string} value - Width keyword or direct CSS value
 * @returns {ResolvedWidth}
 *
 * @example
 *   resolveWidth('half')
 *   // → { percent: 50, cssClass: 'mdl--half', cssValue: '50%' }
 *
 *   resolveWidth('320px')
 *   // → { percent: 100, cssClass: null, cssValue: '320px' }
 *
 *   resolveWidth('75%')
 *   // → { percent: 75, cssClass: null, cssValue: '75%' }
 */
export function resolveWidth(value) {
  if (!value || typeof value !== 'string') {
    return { percent: 100, cssClass: null, cssValue: '100%' };
  }

  const lc = value.toLowerCase().trim();

  // Named width keyword
  const cols = WIDTH_COLS[lc];
  if (cols !== undefined) {
    const pct = (cols / 12) * 100;
    return {
      percent: pct,
      cssClass: `mdl--${lc}`,
      cssValue: `${pct}%`,
    };
  }

  // Direct percentage
  const pctMatch = lc.match(/^(\d+(?:\.\d+)?)%$/);
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1]);
    return {
      percent: pct,
      cssClass: null,
      cssValue: `${pct}%`,
    };
  }

  // Direct px/rem/em/vw/vh value — percent defaults to 100 (unknown mapping)
  const unitMatch = lc.match(/^(\d+(?:\.\d+)?)(px|rem|em|vw|vh)$/);
  if (unitMatch) {
    return {
      percent: 100,
      cssClass: null,
      cssValue: `${unitMatch[1]}${unitMatch[2]}`,
    };
  }

  // Unknown → treat as 100%
  console.warn(`[mdlayout:width-resolver] Unknown width value: "${value}"`);
  return { percent: 100, cssClass: null, cssValue: '100%' };
}

/**
 * Convert a width percentage to CSS grid column span (12-column grid).
 *
 * @param {number} percent - Width as percentage (0-100)
 * @returns {number} Grid column span (1-12)
 */
export function percentToGridSpan(percent) {
  return Math.max(1, Math.min(12, Math.round((percent / 100) * 12)));
}
