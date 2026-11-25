// Les pages de mdlayout : une mise en page libre, comme une diapositive ou une page imprimée — des cadres posés à la
// coordonnée près (x, y, largeur, hauteur), tournés, empilés, sur des calques, des formes avec leur remplissage et leur
// trait, du texte et des images dedans. Le texte reste du Markdown lisible :
//
//   ::::page{size:a4, margin:15mm}
//   :::titre{x:15mm, y:15mm, w:180mm, h:25mm, size:32px, weight:700}
//   # Rapport annuel
//   :::
//   :::pastille{shape:ellipse, x:120mm, y:45mm, w:40mm, h:40mm, fill:#f59e0b, rotate:15}
//   **-30 %**
//   :::
//   ::::
//
// Ce module lit et réécrit (`parsePages`, `writePage`) et résout en pixels (`resolvePage`) ; `render.js` dessine.
// Sans DOM, sans dépendance.

import { pageSize, toPx } from './units.js';

/** @typedef {[string, string | true][]} Hints */
/** @typedef {{ name: string, hints: Hints, content: string }} Frame */
/** @typedef {{ hints: Hints, frames: Frame[], raw?: string, start?: number, end?: number }} Page */

const OPEN = /^::::page(?:\{([^\n]*)\})?[ \t]*$/;
const CLOSE = /^::::[ \t]*$/;
const FRAME_OPEN = /^:::([A-Za-z0-9_À-ɏ-]+)(?:\{([^\n]*)\})?[ \t]*$/;
const FRAME_CLOSE = /^:::[ \t]*$/;

/**
 * `x:15mm, fill:gradient(#a #b 90), shadow` → `[["x","15mm"],["fill","gradient(#a #b 90)"],["shadow",true]]`.
 * Une virgule entre parenthèses ou guillemets ne sépare pas.
 * @param {string | undefined} text
 * @returns {Hints}
 */
export function readHints(text) {
  /** @type {Hints} */
  const out = [];
  if (!text) return out;
  let depth = 0;
  let quote = '';
  let part = '';
  const push = () => {
    const item = part.trim();
    part = '';
    if (!item) return;
    const at = item.indexOf(':');
    if (at < 0) out.push([item, true]);
    else out.push([item.slice(0, at).trim(), item.slice(at + 1).trim().replace(/^"(.*)"$/, '$1')]);
  };
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = '';
      part += ch;
    } else if (ch === '"') {
      quote = ch;
      part += ch;
    } else if (ch === '(') {
      depth++;
      part += ch;
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1);
      part += ch;
    } else if (ch === ',' && depth === 0) push();
    else part += ch;
  }
  push();
  return out;
}

/** @param {Hints} hints */
export function writeHints(hints) {
  return hints.map(([k, v]) => (v === true ? k : /[,{}]/.test(v) && !/^[\w-]+\(.*\)$/.test(v) ? `${k}:"${v}"` : `${k}:${v}`)).join(', ');
}

/** @param {Hints} hints @param {string} key */
export function hint(hints, key) {
  return hints.find(([k]) => k === key)?.[1];
}

/**
 * Pose (ou retire, `undefined`) une indication ; les autres gardent leur place.
 * @param {Hints} hints @param {string} key @param {string | true | undefined} value
 * @returns {Hints}
 */
export function setHint(hints, key, value) {
  const out = hints.map((pair) => /** @type {[string, string | true]} */ ([...pair]));
  const at = out.findIndex(([k]) => k === key);
  if (value === undefined) {
    if (at >= 0) out.splice(at, 1);
  } else if (at >= 0) out[at] = [key, value];
  else out.push([key, value]);
  return out;
}

/**
 * Les pages d'un texte, avec leur place (`start`, `end` en caractères) et leur source (`raw`).
 * @param {string} text
 * @returns {Page[]}
 */
export function parsePages(text) {
  /** @type {Page[]} */
  const pages = [];
  const lines = String(text ?? '').split('\n');
  let offset = 0;
  /** @type {Page | null} */
  let page = null;
  /** @type {Frame | null} */
  let frame = null;
  let body = [];
  let fence = false;
  for (const line of lines) {
    const bare = line.replace(/\r$/, '');
    const lineEnd = offset + line.length;
    if (!page) {
      const m = bare.match(OPEN);
      if (m) page = { hints: readHints(m[1]), frames: [], start: offset };
    } else if (frame) {
      if (/^\s{0,3}(```|~~~)/.test(bare)) fence = !fence;
      if (!fence && FRAME_CLOSE.test(bare)) {
        frame.content = body.join('\n');
        page.frames.push(frame);
        frame = null;
        body = [];
      } else body.push(bare);
    } else if (CLOSE.test(bare)) {
      page.end = lineEnd;
      page.raw = text.slice(/** @type {number} */ (page.start), lineEnd);
      pages.push(page);
      page = null;
    } else {
      const m = bare.match(FRAME_OPEN);
      if (m) {
        frame = { name: m[1], hints: readHints(m[2]), content: '' };
        fence = false;
      }
    }
    offset = lineEnd + 1;
  }
  return pages;
}

/**
 * Réécrit une page.
 * @param {Page} page
 * @returns {string}
 */
export function writePage(page) {
  const out = [`::::page{${writeHints(page.hints)}}`];
  for (const frame of page.frames) {
    out.push(frame.hints.length ? `:::${frame.name}{${writeHints(frame.hints)}}` : `:::${frame.name}`);
    if (frame.content.trim()) out.push(frame.content.replace(/\n+$/, ''));
    out.push(':::');
  }
  out.push('::::');
  return out.join('\n');
}

/** Un nom de cadre neuf (`f1`, `f2`…). @param {Page} page @param {string} [base] */
export function freshName(page, base = 'f') {
  const taken = new Set(page.frames.map((frame) => frame.name));
  let n = 1;
  while (taken.has(`${base}${n}`)) n++;
  return `${base}${n}`;
}

/**
 * Une page résolue en pixels : sa taille, sa marge, son fond, et chaque cadre avec sa boîte.
 * @param {Page} page
 */
export function resolvePage(page) {
  const size = pageSize(/** @type {string} */ (hint(page.hints, 'size')), hint(page.hints, 'landscape') === true);
  const margin = toPx(/** @type {string} */ (hint(page.hints, 'margin')), size.width) ?? 0;
  const frames = page.frames.map((frame, index) => {
    const get = (key) => hint(frame.hints, key);
    const x = toPx(/** @type {string} */ (get('x')), size.width) ?? margin;
    const y = toPx(/** @type {string} */ (get('y')), size.height) ?? margin;
    const w = toPx(/** @type {string} */ (get('w')), size.width) ?? size.width - 2 * margin;
    const h = toPx(/** @type {string} */ (get('h')), size.height) ?? Math.min(120, size.height - 2 * margin);
    const rotate = parseFloat(String(get('rotate') ?? 0)) || 0;
    const z = parseInt(String(get('z') ?? index + 1), 10) || index + 1;
    return { name: frame.name, frame, x, y, w, h, rotate, z, hidden: get('hidden') === true, locked: get('locked') === true, layer: typeof get('layer') === 'string' ? String(get('layer')) : '', group: typeof get('group') === 'string' ? String(get('group')) : '' };
  });
  return { ...size, margin, frames };
}
