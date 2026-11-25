// Les longueurs et les formats d'une page mdlayout. Tout se ramène au pixel CSS (96 par pouce) : `mm`, `cm`, `in`,
// `pt`, `px` ; un nombre seul est en pixels ; `%` se rapporte à la largeur (x, w) ou à la hauteur (y, h) de la page.

const PER_INCH = 96;
const FACTORS = { px: 1, mm: PER_INCH / 25.4, cm: PER_INCH / 2.54, in: PER_INCH, pt: PER_INCH / 72 };

/** Les formats nommés, en millimètres pour le papier, en pixels pour l'écran (largeur × hauteur, en portrait). */
export const PAGE_SIZES = {
  a3: [297, 420, 'mm'],
  a4: [210, 297, 'mm'],
  a5: [148, 210, 'mm'],
  a6: [105, 148, 'mm'],
  letter: [215.9, 279.4, 'mm'],
  legal: [215.9, 355.6, 'mm'],
  tabloid: [279.4, 431.8, 'mm'],
  '16:9': [1920, 1080, 'px'],
  '4:3': [1600, 1200, 'px'],
  '21:9': [2520, 1080, 'px'],
  '1:1': [1080, 1080, 'px'],
  '9:16': [1080, 1920, 'px'],
  banner: [1500, 500, 'px'],
};

/**
 * Une longueur en pixels.
 * @param {string | number | undefined} value
 * @param {number} [whole] - la dimension de la page qui fait 100 %
 * @returns {number | null} `null` si la valeur n'est pas une longueur
 */
export function toPx(value, whole = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*(px|mm|cm|in|pt|%)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = (m[2] || 'px').toLowerCase();
  if (unit === '%') return (n / 100) * whole;
  return n * FACTORS[unit];
}

/**
 * Une longueur en pixels réécrite dans une unité (arrondie à 0,1).
 * @param {number} px
 * @param {'px'|'mm'|'cm'|'in'|'pt'} unit
 */
export function fromPx(px, unit) {
  const n = px / FACTORS[unit];
  const rounded = Math.round(n * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}${unit === 'px' ? '' : unit}`;
}

/**
 * La taille d'une page : un format nommé (`a4`, `16:9`), ou `LxH` avec une unité (`210x297mm`, `1280x720`).
 * @param {string | undefined} size
 * @param {boolean} landscape
 * @returns {{ width: number, height: number, unit: 'px'|'mm' }}
 */
export function pageSize(size, landscape) {
  let width = 1920;
  let height = 1080;
  let unit = 'px';
  const named = PAGE_SIZES[String(size || '16:9').toLowerCase()];
  if (named) {
    [width, height] = named;
    unit = named[2];
  } else {
    const m = String(size).trim().match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(px|mm|cm|in|pt)?$/i);
    if (m) {
      unit = (m[3] || 'px').toLowerCase();
      width = parseFloat(m[1]);
      height = parseFloat(m[2]);
      if (unit !== 'px' && unit !== 'mm') {
        width = (width * FACTORS[unit]) / FACTORS.mm;
        height = (height * FACTORS[unit]) / FACTORS.mm;
        unit = 'mm';
      }
    }
  }
  const pw = width * FACTORS[unit];
  const ph = height * FACTORS[unit];
  const swap = landscape ? pw < ph : false;
  return { width: swap ? ph : pw, height: swap ? pw : ph, unit: /** @type {'px'|'mm'} */ (unit) };
}
