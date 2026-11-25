// ── Style Resolver ────────────────────────────────────────────────────
// Resolves visual style hint properties into CSS declarations and classes.
//
// Mappings:
//   color, bg, font, size, weight, radius, shadow, opacity,
//   z-index, rotation, underline, align, valign, pad, border, gap
//
// Zero dependencies.

/** @typedef {import('../ast/types.js').HintMap} HintMap */

/**
 * @typedef {Object} ResolvedStyles
 * @property {string} style - Inline CSS string (semicolon-separated)
 * @property {string[]} classes - CSS class names to apply
 */

// ── Size mappings ─────────────────────────────────────────────────────

const SIZE_MAP = {
  xs: '0.75rem',
  sm: '0.875rem',
  md: '1rem',
  lg: '1.25rem',
  xl: '1.5rem',
};

const RADIUS_MAP = {
  sm: '6px',
  md: '10px',
  lg: '16px',
};

const SHADOW_MAP = {
  sm:   '0 1px 2px rgba(0,0,0,0.1)',
  md:   '0 4px 6px rgba(0,0,0,0.1)',
  lg:   '0 10px 15px rgba(0,0,0,0.15)',
  none: 'none',
};

const PAD_MAP = {
  tight:  '0.5rem',
  normal: '1rem',
  loose:  '2rem',
};

const GAP_MAP = {
  tight:  '0.5rem',
  normal: '1rem',
  loose:  '2rem',
};

// ── Keys to skip (handled elsewhere) ──────────────────────────────────

const LAYOUT_KEYS = new Set([
  'width', 'height', 'position', 'at', 'mode',
  'below', 'above', 'beside', 'right-of', 'left-of', 'overlay',
  'row', 'col', 'span', 'ratio',
  // Content mode flags handled by hint-resolver
  'flow', 'scale', 'clip', 'scroll', 'fit',
]);

/**
 * Resolve visual style hints into CSS properties and classes.
 *
 * @param {HintMap} hints - Parsed hint map
 * @returns {ResolvedStyles}
 *
 * @example
 *   resolveStyles({ color: 'red', bg: '#1a1a2e', size: 'xl', underline: true })
 *   // → {
 *   //   style: 'color:red;background-color:#1a1a2e;font-size:1.5rem;text-decoration:underline',
 *   //   classes: []
 *   // }
 */
/**
 * A value that may go into a CSS declaration: no character that ends it or opens another (`;` `{` `}`), no markup, no
 * escape, and no function that fetches or runs (`url(`, `expression(`, `image-set(`…). Anything else is dropped.
 *
 * @param {string} value
 * @returns {string}
 */
export function safeCssValue(value) {
  if (typeof value !== 'string') return '';
  const v = value.trim();
  if (!v || v.length > 200) return '';
  if (/[;{}<>"'`\\]/.test(v)) return '';
  if (/(url|expression|image-set|image|element|paint|env|attr|var)\s*\(/i.test(v)) return '';
  if (/@|\/\*/.test(v)) return '';
  return v;
}

export function resolveStyles(hints) {
  if (!hints || typeof hints !== 'object') return { style: '', classes: [] };

  /** @type {string[]} */
  const props = [];
  /** @type {string[]} */
  const classes = [];

  for (const [key, value] of Object.entries(hints)) {
    // Skip layout keys — those are handled by width-resolver / hint-resolver
    if (LAYOUT_KEYS.has(key)) continue;

    const lk = key.toLowerCase();
    // 🔴 Une valeur ne sort jamais de sa déclaration (DecisionRoxor, 2026-11-18 : Écume la posait telle quelle).
    const sv = safeCssValue(typeof value === 'string' ? value : '');

    switch (lk) {
      case 'color':
        props.push(`color:${sv}`);
        break;

      case 'bg':
        props.push(`background-color:${sv}`);
        break;

      case 'font':
        props.push(`font-family:${sv}`);
        break;

      case 'size': {
        const mapped = SIZE_MAP[sv.toLowerCase()];
        props.push(`font-size:${mapped || sv}`);
        break;
      }

      case 'weight':
        props.push(`font-weight:${sv}`);
        break;

      case 'radius': {
        const mapped = RADIUS_MAP[sv.toLowerCase()];
        props.push(`border-radius:${mapped || sv}`);
        break;
      }

      case 'shadow': {
        const mapped = SHADOW_MAP[sv.toLowerCase()];
        if (mapped) {
          props.push(`box-shadow:${mapped}`);
        } else {
          props.push(`box-shadow:${sv}`);
        }
        break;
      }

      case 'opacity':
        props.push(`opacity:${sv}`);
        break;

      case 'z-index': {
        if (sv === 'front') {
          props.push('z-index:999');
          classes.push('mdl--z-front');
        } else if (sv === 'back') {
          props.push('z-index:0');
          classes.push('mdl--z-back');
        } else {
          props.push(`z-index:${sv}`);
        }
        break;
      }

      case 'rotation':
        props.push(`transform:rotate(${sv})`);
        break;

      case 'underline':
        if (value === true || sv === 'true') {
          props.push('text-decoration:underline');
        }
        break;

      case 'align':
        props.push(`text-align:${sv}`);
        break;

      case 'valign': {
        const vMap = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
        const mapped = vMap[sv.toLowerCase()];
        if (mapped) {
          classes.push(`mdl--valign-${sv.toLowerCase()}`);
        }
        break;
      }

      case 'pad': {
        const mapped = PAD_MAP[sv.toLowerCase()];
        props.push(`padding:${mapped || sv}`);
        if (mapped) classes.push(`mdl--pad-${sv.toLowerCase()}`);
        break;
      }

      case 'gap': {
        const mapped = GAP_MAP[sv.toLowerCase()];
        if (mapped) {
          classes.push(`mdl--gap-${sv.toLowerCase()}`);
        } else {
          props.push(`gap:${sv}`);
        }
        break;
      }

      case 'border':
        props.push(`border:${sv}`);
        break;

      case 'height': {
        // height is partially layout, but direct values go to CSS
        if (sv !== 'auto' && sv !== 'fill') {
          props.push(`height:${sv}`);
        } else if (sv === 'fill') {
          classes.push('mdl--fill-height');
        }
        break;
      }

      default:
        console.warn(`[mdlayout:style-resolver] Unknown style hint: "${key}"`);
        break;
    }
  }

  return {
    style: props.join(';'),
    classes,
  };
}
