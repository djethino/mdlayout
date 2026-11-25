// ── Tables: merged cells and cell styles ──────────────────────────────
// A GFM table, unchanged for any other reader, gains two things (the syntax of Écume's table plugin):
//   - a cell holding only `>` extends the cell on its left (colspan), only `^` the cell above (rowspan);
//   - a trailing `{bg:#dcfce7, color:#166534, align:center, valign:middle, width:30%, height:48px}` styles a cell (a
//     height on a row's first cell sets the row's height).
// A table with no marker and no hint is plain GFM. Anything that cannot be read safely stays text: a merge that does not
// form a rectangle, an unknown key, a value that could leave a CSS declaration.
//
// The core is pure (no DOM): `cellHint`, `hintOf`, `markOf`, `spansOf`, `marksOf`. `processTable(table)` applies it to a
// <table> already rendered by any Markdown renderer (marked, markdown-it, remark…), in a browser.

/** A colour safe to put in a style: `#rgb`, `#rrggbb(aa)`, a name, `rgb(…)`/`rgba(…)` of numbers. */
export const COLOR = /^(#[0-9a-f]{3,8}|[a-z]{3,20}|rgba?\(\s*[0-9.]+%?\s*(,\s*[0-9.]+%?\s*){2,3}\))$/i;
const WIDTH = /^\d{1,3}(\.\d+)?(%|px)$/;

const HEIGHT = /^\d{1,4}px$/;

export const NO_STYLE = Object.freeze({ bg: null, color: null, align: null, valign: null, width: null, height: null });

/**
 * The style written at the end of a cell (`raw`: its source text), with the text before it; or `null`.
 * @param {string} raw
 * @returns {{ style: { bg: string|null, color: string|null, align: string|null, valign: string|null, width: string|null, height: string|null }, before: string } | null}
 */
export function cellHint(raw) {
  const m = /^([\s\S]*?)[ \t]*\{([a-z]+[ \t]*:[^{}]*)\}[ \t]*$/.exec(raw);
  // `[text]{color:…}` styles a run of text, not the cell.
  if (!m || m[1].endsWith("]")) return null;
  const style = { ...NO_STYLE };
  for (const part of m[2].split(",")) {
    const at = part.indexOf(":");
    const key = part.slice(0, at).trim();
    const value = part.slice(at + 1).trim();
    if (key === "bg" && COLOR.test(value)) style.bg = value;
    else if (key === "color" && COLOR.test(value)) style.color = value;
    else if (key === "align" && /^(left|center|right)$/.test(value)) style.align = value;
    else if (key === "valign" && /^(top|middle|bottom)$/.test(value)) style.valign = value;
    else if (key === "width" && WIDTH.test(value)) style.width = value;
    else if (key === "height" && HEIGHT.test(value)) style.height = value;
    else return null;
  }
  return { style, before: m[1] };
}

/** The style to write at the end of a cell (`align` only when it differs from the column's). */
export function hintOf(style, columnAlign = null) {
  const parts = [];
  if (style.bg) parts.push(`bg:${style.bg}`);
  if (style.color) parts.push(`color:${style.color}`);
  if (style.align && style.align !== columnAlign) parts.push(`align:${style.align}`);
  if (style.valign) parts.push(`valign:${style.valign}`);
  if (style.width) parts.push(`width:${style.width}`);
  if (style.height) parts.push(`height:${style.height}`);
  return parts.length ? `{${parts.join(", ")}}` : "";
}

/** `>` or `^` when the cell holds only that mark (an escaped `\>` is a chevron, not a merge), else `null`. */
export function markOf(raw) {
  const text = raw.trim();
  return text === ">" ? ">" : text === "^" ? "^" : null;
}

/**
 * The cells of a grid of marks (one array per row), in reading order: `{ row, column, colspan, rowspan }`. `null` when
 * the grid does not form rectangles: the table is then read without merges.
 */
export function spansOf(grid) {
  const width = grid[0]?.length ?? 0;
  if (!width || grid.some((row) => row.length !== width)) return null;
  const owner = grid.map((row) => row.map(() => -1));
  const spans = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < width; c++) {
      const mark = grid[r][c];
      if (mark === ">" && c > 0) owner[r][c] = owner[r][c - 1];
      else if (mark === "^" && r > 0) owner[r][c] = owner[r - 1][c];
      else {
        owner[r][c] = spans.length;
        spans.push({ row: r, column: c, colspan: 1, rowspan: 1 });
      }
    }
  }
  for (let id = 0; id < spans.length; id++) {
    const cells = [];
    owner.forEach((row, r) => row.forEach((one, c) => one === id && cells.push([r, c])));
    const rows = cells.map(([r]) => r);
    const columns = cells.map(([, c]) => c);
    const top = Math.min(...rows), bottom = Math.max(...rows), left = Math.min(...columns), right = Math.max(...columns);
    if (top !== spans[id].row || left !== spans[id].column || cells.length !== (bottom - top + 1) * (right - left + 1)) return null;
    spans[id].colspan = right - left + 1;
    spans[id].rowspan = bottom - top + 1;
  }
  return spans;
}

/** The grid of marks to write for placed cells: `null` where a cell starts. */
export function marksOf(spans, height, width) {
  const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => ">"));
  for (const span of spans) {
    for (let r = span.row; r < span.row + span.rowspan; r++) {
      for (let c = span.column; c < span.column + span.colspan; c++) {
        grid[r][c] = r === span.row && c === span.column ? null : r === span.row ? ">" : c === span.column ? "^" : ">";
      }
    }
  }
  return grid;
}

/**
 * Applies merges and cell styles to a <table> rendered from GFM, in place (a browser). Idempotent.
 * Reads the cells' text content: write `\>` in the Markdown for a cell that must show a lone chevron.
 * @param {HTMLTableElement} table
 */
export function processTable(table) {
  if (table.dataset.mdlayoutTable) return;
  table.dataset.mdlayoutTable = "1";
  const rows = [...table.rows];
  // Styles first: a hint leaves the cell's text.
  for (const row of rows) {
    for (const cell of row.cells) {
      const last = cell.lastChild;
      const hint = last && last.nodeType === 3 ? cellHint(last.textContent ?? "") : null;
      if (!hint) continue;
      last.textContent = hint.before;
      const s = hint.style;
      if (s.bg) cell.style.background = s.bg;
      if (s.color) cell.style.color = s.color;
      if (s.align) cell.style.textAlign = s.align;
      if (s.valign) cell.style.verticalAlign = s.valign;
      if (s.width) cell.style.width = s.width;
      if (s.height) cell.style.height = s.height;
    }
  }
  const spans = spansOf(rows.map((row) => [...row.cells].map((cell) => markOf(cell.textContent ?? ""))));
  if (!spans) return;
  const starts = new Set(spans.map((span) => `${span.row}:${span.column}`));
  rows.forEach((row, r) => {
    [...row.cells].forEach((cell, c) => {
      if (!starts.has(`${r}:${c}`)) cell.remove();
    });
  });
  for (const span of spans) {
    const cell = rows[span.row].cells[[...starts].filter((key) => key.startsWith(`${span.row}:`)).map((key) => Number(key.split(":")[1])).sort((a, b) => a - b).indexOf(span.column)];
    if (span.colspan > 1) cell.colSpan = span.colspan;
    if (span.rowspan > 1) cell.rowSpan = span.rowspan;
  }
}

/** Every table inside `container` (a browser). */
export function processTables(container) {
  for (const table of container.querySelectorAll("table")) processTable(table);
}
