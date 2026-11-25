// Les formes d'une page mdlayout, dessinées en SVG dans la boîte du cadre (largeur `w`, hauteur `h`, en pixels).
// Chaque forme est un chemin ; une ligne et une flèche sont un trait (sans remplissage).

/** Les formes connues, dans l'ordre de la palette. */
export const SHAPES = ['rect', 'rounded', 'ellipse', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'arrow-right', 'chevron', 'bubble', 'line', 'arrow', 'polygon'];

/** Les formes qui sont un trait, pas une surface. */
export const STROKES = new Set(['line', 'arrow']);

const f = (n) => Math.round(n * 100) / 100;
/** Un réglage numérique borné ; absent ou douteux : sa valeur d'office. */
const clamp = (value, min, max, fallback) => (typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback);

function regular(sides, w, h, rotation = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i * 2 * Math.PI) / sides;
    pts.push(`${f(w / 2 + (w / 2) * Math.cos(a))} ${f(h / 2 + (h / 2) * Math.sin(a))}`);
  }
  return `M${pts.join(' L')} Z`;
}

function star(points, w, h, inner = 0.45) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 === 0 ? 1 : inner;
    pts.push(`${f(w / 2 + (w / 2) * r * Math.cos(a))} ${f(h / 2 + (h / 2) * r * Math.sin(a))}`);
  }
  return `M${pts.join(' L')} Z`;
}

/**
 * Le chemin SVG d'une forme.
 * @param {string} shape
 * @param {number} w
 * @param {number} h
 * @param {{ radius?: number, points?: string, sides?: number, inner?: number, head?: number }} [options]
 *   `sides` : les branches d'une étoile (3 à 24) ; `inner` : son creux, le rayon intérieur sur l'extérieur (0,1 à 0,95) ;
 *   `head` : la pointe d'une flèche, en part de sa longueur (0,1 à 0,9).
 * @returns {string}
 */
export function shapePath(shape, w, h, options = {}) {
  const r = Math.max(0, Math.min(options.radius ?? 0, w / 2, h / 2));
  switch (shape) {
    case 'rounded': {
      const k = r || Math.min(w, h) * 0.18;
      return `M${f(k)} 0 H${f(w - k)} A${f(k)} ${f(k)} 0 0 1 ${f(w)} ${f(k)} V${f(h - k)} A${f(k)} ${f(k)} 0 0 1 ${f(w - k)} ${f(h)} H${f(k)} A${f(k)} ${f(k)} 0 0 1 0 ${f(h - k)} V${f(k)} A${f(k)} ${f(k)} 0 0 1 ${f(k)} 0 Z`;
    }
    case 'ellipse':
      return `M0 ${f(h / 2)} A${f(w / 2)} ${f(h / 2)} 0 1 0 ${f(w)} ${f(h / 2)} A${f(w / 2)} ${f(h / 2)} 0 1 0 0 ${f(h / 2)} Z`;
    case 'triangle':
      return `M${f(w / 2)} 0 L${f(w)} ${f(h)} L0 ${f(h)} Z`;
    case 'diamond':
      return `M${f(w / 2)} 0 L${f(w)} ${f(h / 2)} L${f(w / 2)} ${f(h)} L0 ${f(h / 2)} Z`;
    case 'pentagon':
      return regular(5, w, h);
    case 'hexagon':
      return regular(6, w, h, 0);
    case 'star':
      return star(options.sides && options.sides >= 3 ? Math.min(24, Math.round(options.sides)) : 5, w, h, clamp(options.inner, 0.1, 0.95, 0.45));
    case 'arrow-right': {
      const head = Math.min(w * clamp(options.head, 0.1, 0.9, 0.4), options.head === undefined ? h : w);
      return `M0 ${f(h * 0.28)} H${f(w - head)} V0 L${f(w)} ${f(h / 2)} L${f(w - head)} ${f(h)} V${f(h * 0.72)} H0 Z`;
    }
    case 'chevron': {
      const k = Math.min(w * 0.35, h * 0.6);
      return `M0 0 H${f(w - k)} L${f(w)} ${f(h / 2)} L${f(w - k)} ${f(h)} H0 L${f(k)} ${f(h / 2)} Z`;
    }
    case 'bubble': {
      const body = h * 0.78;
      const k = Math.min(w, body) * 0.15;
      return `M${f(k)} 0 H${f(w - k)} Q${f(w)} 0 ${f(w)} ${f(k)} V${f(body - k)} Q${f(w)} ${f(body)} ${f(w - k)} ${f(body)} H${f(w * 0.32)} L${f(w * 0.18)} ${f(h)} L${f(w * 0.2)} ${f(body)} H${f(k)} Q0 ${f(body)} 0 ${f(body - k)} V${f(k)} Q0 0 ${f(k)} 0 Z`;
    }
    case 'line':
    case 'arrow':
      return `M0 ${f(h / 2)} L${f(w)} ${f(h / 2)}`;
    case 'polygon': {
      // `points` : des couples « x y » en pour cent de la boîte (`0 0 100 0 50 100`).
      const nums = String(options.points || '').trim().split(/[\s;]+/).map(Number).filter(Number.isFinite);
      if (nums.length < 6) return `M0 0 H${f(w)} V${f(h)} H0 Z`;
      const pts = [];
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push(`${f((nums[i] / 100) * w)} ${f((nums[i + 1] / 100) * h)}`);
      return `M${pts.join(' L')} Z`;
    }
    case 'rect':
    default:
      if (r > 0) return shapePath('rounded', w, h, { radius: r });
      return `M0 0 H${f(w)} V${f(h)} H0 Z`;
  }
}
