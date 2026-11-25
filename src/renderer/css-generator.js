// ── CSS Generator ─────────────────────────────────────────────────────
// Generates scoped CSS for mdlayout canvases.
//
// Produces:
//   - CSS Grid variables and layout rules
//   - Responsive breakpoints
//   - Width classes (mdl--full, mdl--half, etc.)
//   - Utility classes (padding, valign, gap, z-index)
//
// Can generate:
//   1. Static base CSS (call once, shared across all canvases)
//   2. Scoped CSS for a specific canvas (optional scope ID)
//
// Zero dependencies.

/**
 * @typedef {import('../ast/types.js').CanvasNode} CanvasNode
 */

/**
 * Generate the base CSS for mdlayout.
 * This should be included once on the page.
 *
 * @returns {string} CSS string
 */
export function generateBaseCSS() {
  return `/* mdlayout base styles */
.mdl-canvas {
  position: relative;
  width: 100%;
}

.mdl-canvas--responsive {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--mdl-gap, 1rem);
}

.mdl-canvas--fixed {
  position: relative;
  overflow: hidden;
}

.mdl-canvas--fixed > .mdl-block {
  position: absolute;
}

/* ── Width classes (12-column grid) ─────────────────────────────── */
.mdl--full       { grid-column: span 12; width: 100%; }
.mdl--two-thirds { grid-column: span 8; }
.mdl--half       { grid-column: span 6; }
.mdl--third      { grid-column: span 4; }
.mdl--quarter    { grid-column: span 3; }
.mdl--wide       { grid-column: span 9; }
.mdl--narrow     { grid-column: span 3; }
.mdl--small      { grid-column: span 4; }
.mdl--large      { grid-column: span 9; }

/* ── Block ──────────────────────────────────────────────────────── */
.mdl-block {
  position: relative;
  box-sizing: border-box;
}

.mdl-block__label {
  display: none; /* Hidden by default; shown in editor mode */
}

.mdl-block__content {
  width: 100%;
}

/* ── Position helpers ───────────────────────────────────────────── */
.mdl--absolute {
  position: absolute;
}

.mdl--center {
  margin-left: auto;
  margin-right: auto;
}

/* ── Vertical alignment ─────────────────────────────────────────── */
.mdl--valign-top    { display: flex; align-items: flex-start; }
.mdl--valign-middle { display: flex; align-items: center; }
.mdl--valign-bottom { display: flex; align-items: flex-end; }

/* ── Padding presets ────────────────────────────────────────────── */
.mdl--pad-tight  { padding: 0.5rem; }
.mdl--pad-normal { padding: 1rem; }
.mdl--pad-loose  { padding: 2rem; }

/* ── Gap presets ────────────────────────────────────────────────── */
.mdl--gap-tight  { gap: 0.5rem; }
.mdl--gap-normal { gap: 1rem; }
.mdl--gap-loose  { gap: 2rem; }

/* ── Z-index helpers ────────────────────────────────────────────── */
/* These classes are added by style-resolver alongside inline z-index styles.
   The classes enable external CSS overrides; the inline styles ensure correct
   rendering without the base stylesheet. Both are needed. */
.mdl--z-front { z-index: 999; }
.mdl--z-back  { z-index: 0; }

/* ── Content modes ──────────────────────────────────────────────── */
.mdl--flow   { overflow: visible; }
.mdl--clip   { overflow: hidden; }
.mdl--scroll { overflow: auto; }
.mdl--scale  { overflow: hidden; }
.mdl--scale > .mdl-block__content { transform-origin: top left; }
.mdl--fit    { object-fit: contain; }
.mdl--fill-height { height: 100%; }

/* ── Media ──────────────────────────────────────────────────────── */
.mdl-media {
  margin: 0;
  padding: 0;
  display: inline-block;
}

.mdl-media img,
.mdl-media video,
.mdl-media audio {
  max-width: 100%;
  display: block;
}

/* A media outside a grid takes its width from the same keywords. */
.mdl-media.mdl--full       { width: 100%; }
.mdl-media.mdl--two-thirds { width: 66.667%; }
.mdl-media.mdl--wide,
.mdl-media.mdl--large      { width: 75%; }
.mdl-media.mdl--half       { width: 50%; }
.mdl-media.mdl--third,
.mdl-media.mdl--small      { width: 33.333%; }
.mdl-media.mdl--quarter,
.mdl-media.mdl--narrow     { width: 25%; }
.mdl-media img,
.mdl-media video,
.mdl-media iframe          { width: 100%; height: auto; border-radius: inherit; }
.mdl-media iframe          { aspect-ratio: 16 / 9; border: 0; }
.mdl-media audio           { width: 100%; }

/* ── Inline styled ──────────────────────────────────────────────── */
.mdl-styled {
  /* No default styling; all comes from inline styles */
}

/* ── Responsive breakpoints ─────────────────────────────────────── */
@media (max-width: 768px) {
  .mdl-canvas--responsive {
    grid-template-columns: 1fr;
  }

  .mdl-canvas--responsive > .mdl-block {
    grid-column: 1 / -1 !important;
  }
}
`;
}

/**
 * Generate scoped CSS for a specific canvas instance.
 *
 * @param {CanvasNode} canvas - The canvas AST node
 * @param {string} [scopeId] - Optional scope ID for CSS isolation (e.g. 'mdl-canvas-1')
 * @returns {string} Scoped CSS string
 *
 * @example
 *   generateCSS(canvasNode, 'mdl-c-42')
 *   // → '#mdl-c-42 { ... }'
 */
export function generateCSS(canvas, scopeId) {
  if (!canvas || canvas.type !== 'canvas') return '';

  const rules = [];
  const prefix = scopeId ? `#${scopeId}` : '.mdl-canvas';

  // Canvas-level custom properties
  const gap = canvas.hints.gap;
  if (gap) {
    const gapMap = { tight: '0.5rem', normal: '1rem', loose: '2rem' };
    const gapValue = gapMap[gap] || gap;
    rules.push(`${prefix} { --mdl-gap: ${gapValue}; }`);
  }

  // Per-block scoped rules (if needed for complex layouts)
  let autoIdx = 0;
  for (const block of canvas.children) {
    const name = block.name || `__anon_${autoIdx++}`;

    // Aspect ratio on block
    if (block.hints.ratio) {
      const rm = block.hints.ratio.toString().match(/^(\d+)[:/](\d+)$/);
      if (rm) {
        rules.push(`${prefix} [data-block-name="${name}"] { aspect-ratio: ${rm[1]} / ${rm[2]}; }`);
      }
    }
  }

  return rules.join('\n');
}
