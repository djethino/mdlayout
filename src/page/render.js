// Le dessin d'une page mdlayout en HTML : la page garde ses proportions et s'adapte à la largeur qu'on lui donne
// (`container-type: inline-size` ; les tailles de texte et les marges intérieures en `cqw`, rapportées à la largeur de
// la page). Chaque cadre est posé en pour cent ; une forme est un SVG à la taille du cadre, le texte par-dessus.
// 🔴 Rien ne passe tel quel dans le style : couleurs, longueurs, nombres et polices sont vérifiés un par un.

import { hint, resolvePage } from './page.js';
import { shapePath, STROKES } from './shapes.js';
import { toPx } from './units.js';

const COLOR = /^(#[0-9a-f]{3,8}|[a-z]{3,20}|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\))$/i;
const FONT = /^[\w\s'-]{1,60}$/;
const SHADOWS = { sm: '0 1px 3px rgb(0 0 0 / 0.2)', md: '0 4px 14px rgb(0 0 0 / 0.22)', lg: '0 12px 36px rgb(0 0 0 / 0.28)' };
const SIZES = { xs: 12, sm: 14, md: 18, lg: 24, xl: 32, xxl: 48, huge: 72 };

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (v, fallback = null) => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
};
const pct = (n) => `${Math.round(n * 10000) / 10000}%`;

/** Une couleur sûre, ou `null`. */
export function safeColor(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v === 'none' || v === 'transparent') return v;
  return COLOR.test(v) ? v : null;
}

/** `gradient(#a #b 135)` → ses deux couleurs et son angle, ou `null`. */
export function readGradient(value) {
  const m = typeof value === 'string' ? value.trim().match(/^gradient\(\s*(\S+)\s+(\S+)(?:\s+(-?\d+(?:\.\d+)?))?\s*\)$/i) : null;
  if (!m) return null;
  const from = safeColor(m[1]);
  const to = safeColor(m[2]);
  return from && to ? { from, to, angle: m[3] ? parseFloat(m[3]) : 135 } : null;
}

let uid = 0;

/**
 * Le HTML d'une page.
 * @param {import('./page.js').Page} page
 * @param {{ renderMarkdown?: (md: string) => string, frameAttrs?: boolean }} [options]
 *   `frameAttrs` : chaque cadre porte `data-frame` (son nom), pour un éditeur.
 */
export function renderPage(page, options = {}) {
  const render = options.renderMarkdown || esc;
  const resolved = resolvePage(page);
  const W = resolved.width;
  const H = resolved.height;
  const u = (px) => `calc(${Math.round(px * 1000) / 1000} * 100cqw / ${Math.round(W * 1000) / 1000})`;
  const bg = hint(page.hints, 'bg');
  const pageStyle = [`aspect-ratio:${Math.round(W)} / ${Math.round(H)}`];
  const grad = readGradient(bg);
  if (grad) pageStyle.push(`background:linear-gradient(${grad.angle}deg, ${grad.from}, ${grad.to})`);
  else if (safeColor(bg)) pageStyle.push(`background:${safeColor(bg)}`);

  const frames = resolved.frames
    .filter((f) => !f.hidden)
    .sort((a, b) => a.z - b.z)
    .map((f) => {
      const get = (key) => hint(f.frame.hints, key);
      // Un trait (une ligne, une flèche) a une boîte de hauteur nulle : on le dessine dans une bande de la hauteur de son
      // épaisseur et de sa pointe, centrée sur la ligne — sans quoi il est écrasé à rien.
      const lineShape = STROKES.has(String(get('shape') ?? ''));
      const lineWidth = toPx(/** @type {string} */ (get('stroke-width'))) ?? 2;
      const boxH = lineShape ? Math.max(f.h, lineWidth * 6, 6) : f.h;
      const boxY = f.y + f.h / 2 - boxH / 2;
      const style = [`left:${pct((f.x / W) * 100)}`, `top:${pct((boxY / H) * 100)}`, `width:${pct((f.w / W) * 100)}`, `height:${pct((Math.max(boxH, 0.01) / H) * 100)}`, `z-index:${f.z}`];
      if (f.rotate) style.push(`transform:rotate(${f.rotate}deg)`);
      const opacity = num(get('opacity'));
      if (opacity !== null) style.push(`opacity:${Math.max(0, Math.min(1, opacity))}`);
      // Le texte.
      const color = safeColor(get('color'));
      if (color) style.push(`color:${color}`);
      const size = SIZES[String(get('size'))] ?? toPx(/** @type {string} */ (get('size')));
      if (size) style.push(`font-size:${u(size)}`);
      const weight = String(get('weight') ?? '');
      if (/^(bold|normal|[1-9]00)$/.test(weight)) style.push(`font-weight:${weight}`);
      const font = get('font');
      if (typeof font === 'string' && FONT.test(font)) style.push(`font-family:${font.includes(' ') ? `'${font}'` : font}`);
      const align = String(get('align') ?? '');
      if (/^(left|center|right|justify)$/.test(align)) style.push(`text-align:${align}`);
      const valign = String(get('valign') ?? '');
      if (/^(top|middle|bottom)$/.test(valign)) style.push(`justify-content:${{ top: 'flex-start', middle: 'center', bottom: 'flex-end' }[valign]}`);
      const pad = toPx(/** @type {string} */ (get('pad')));
      const lineHeight = num(get('leading'));
      if (lineHeight !== null) style.push(`line-height:${Math.max(0.5, Math.min(4, lineHeight))}`);
      // La forme, ou le fond du cadre.
      const shape = typeof get('shape') === 'string' ? String(get('shape')) : '';
      const fill = get('fill');
      const stroke = safeColor(get('stroke'));
      const strokeWidth = toPx(/** @type {string} */ (get('stroke-width'))) ?? (stroke ? 2 : 0);
      const radius = toPx(/** @type {string} */ (get('radius'))) ?? 0;
      const shadow = SHADOWS[String(get('shadow'))] ?? (get('shadow') === true ? SHADOWS.md : null);
      let svg = '';
      if (shape) {
        const id = `mdl-g${++uid}`;
        const g = readGradient(fill);
        const isStroke = STROKES.has(shape);
        const paint = isStroke ? 'none' : g ? `url(#${id})` : (safeColor(fill) ?? 'none');
        const dash = { dashed: `${strokeWidth * 3} ${strokeWidth * 2}`, dotted: `0 ${strokeWidth * 2}` }[String(get('dash'))];
        const marker = shape === 'arrow' ? `<marker id="${id}a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${stroke ?? 'currentColor'}"/></marker>` : '';
        const defs = g || marker ? `<defs>${g ? `<linearGradient id="${id}" gradientTransform="rotate(${g.angle - 90} .5 .5)"><stop offset="0" stop-color="${g.from}"/><stop offset="1" stop-color="${g.to}"/></linearGradient>` : ''}${marker}</defs>` : '';
        const filter = shadow ? ` style="filter:drop-shadow(${shadow})"` : '';
        svg = `<svg class="mdl-frame__shape" viewBox="0 0 ${Math.max(f.w, 0.01)} ${Math.max(boxH, 0.01)}" preserveAspectRatio="none" aria-hidden="true"${filter}>${defs}<path d="${shapePath(shape, f.w, boxH, { radius, points: /** @type {string} */ (get('points')), sides: num(get('sides')) ?? undefined, inner: num(get('inner')) ?? undefined, head: num(get('head')) ?? undefined })}" fill="${paint}" stroke="${stroke ?? (isStroke ? 'currentColor' : 'none')}" stroke-width="${isStroke ? Math.max(strokeWidth, 1) : strokeWidth}"${dash ? ` stroke-dasharray="${dash}"` : ''}${isStroke ? ' stroke-linecap="round"' : ''}${marker ? ` marker-end="url(#${id}a)"` : ''}${shape === 'arrow' && get('both') === true ? ` marker-start="url(#${id}a)"` : ''} vector-effect="non-scaling-stroke"/></svg>`;
      } else {
        const g = readGradient(fill);
        if (g) style.push(`background:linear-gradient(${g.angle}deg, ${g.from}, ${g.to})`);
        else if (safeColor(fill)) style.push(`background:${safeColor(fill)}`);
        if (stroke && strokeWidth) style.push(`border:${u(strokeWidth)} ${{ dashed: 'dashed', dotted: 'dotted' }[String(get('dash'))] ?? 'solid'} ${stroke}`);
        if (radius) style.push(`border-radius:${u(radius)}`);
        if (shadow) style.push(`box-shadow:${shadow}`);
      }
      const fit = String(get('fit') ?? '');
      const classes = ['mdl-frame'];
      if (shape) classes.push(`mdl-frame--shape`);
      if (/^(cover|contain)$/.test(fit)) classes.push(`mdl-frame--fit-${fit}`);
      const attrs = options.frameAttrs ? ` data-frame="${esc(f.name)}"` : '';
      const content = f.frame.content.trim() ? `<div class="mdl-frame__content"${pad !== null ? ` style="padding:${u(pad)}"` : ''}>${render(f.frame.content)}</div>` : '';
      return `<div class="${classes.join(' ')}"${attrs} style="${style.join(';')}">${svg}${content}</div>`;
    })
    .join('');
  return `<div class="mdl-page" data-width="${Math.round(W)}" data-height="${Math.round(H)}" style="${pageStyle.join(';')}">${frames}</div>`;
}

/** La feuille des pages, à poser une fois (avec `generateBaseCSS`). */
export function generatePageCSS() {
  return `
.mdl-page {
  position: relative;
  width: 100%;
  container-type: inline-size;
  overflow: hidden;
  background: #fff;
  color: #111;
  box-sizing: border-box;
}
.mdl-frame {
  position: absolute;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  transform-origin: center;
}
.mdl-frame--shape { justify-content: center; text-align: center; }
.mdl-frame__shape { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.mdl-frame__content { position: relative; min-width: 0; overflow: hidden; }
.mdl-frame__content > :first-child { margin-top: 0; }
.mdl-frame__content :is(h1, h2, h3, h4, h5, h6) { font-size: 1em; line-height: 1.12; margin: 0 0 0.3em; }
.mdl-frame__content > :last-child { margin-bottom: 0; }
.mdl-frame--fit-cover .mdl-frame__content,
.mdl-frame--fit-contain .mdl-frame__content { height: 100%; padding: 0; }
.mdl-frame--fit-cover img,
.mdl-frame--fit-contain img { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.mdl-frame--fit-contain img { object-fit: contain; }
`;
}
