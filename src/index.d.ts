// Les types de ce que mdlayout exporte (le paquet est en JavaScript, sans dépendance).
export interface MdlayoutOptions {
  /** Le rendu du corps d'un bloc ; d'office, le texte échappé. */
  renderMarkdown?: (markdown: string) => string;
  blockHeights?: Record<string, number>;
  includeLabels?: boolean;
}
export function mdlayout(markdown: string, options?: MdlayoutOptions): string;
export function generateBaseCSS(): string;
/** Le lecteur d'un site de vidéos (YouTube sans cookie, Vimeo, Dailymotion) pour une adresse de page, ou `null`. */
export function embedUrl(address: string): string | null;
/** Les indications `{…}` résolues en classes et en style (valeurs rendues sûres). */
export function resolveHints(hints: Record<string, string | boolean>): { classes: string[]; style: string; dataAttrs: Record<string, string> };
export function parseHints(text: string): Record<string, string | boolean>;
export function generateCSS(canvas: unknown, scopeId?: string): string;
export function resolveStyles(hints: Record<string, unknown>): { style: string; classes: string[] };
export function parseCanvas(text: string): unknown[];
export function safeCssValue(value: string): string;
export function renderToHTML(ast: unknown, options?: MdlayoutOptions): string;
/** Du Markdown simple (CommonMark, tableaux GFM) à partir d'un document écrit avec mdlayout ; `removed` : combien de
 *  marques de mise en page sont parties. La commande `mdlayout strip` fait de même. */
export function stripLayout(markdown: string): { markdown: string; removed: number };

// ── Les pages (mise en page libre : cadres, formes, calques) ─────────────────────────────────────────────────────
export type Hints = [string, string | true][];
export interface PageFrame {
  name: string;
  hints: Hints;
  content: string;
}
export interface Page {
  hints: Hints;
  frames: PageFrame[];
  raw?: string;
  start?: number;
  end?: number;
}
export interface ResolvedFrame {
  name: string;
  frame: PageFrame;
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
  z: number;
  hidden: boolean;
  locked: boolean;
  layer: string;
  group: string;
}
export function parsePages(text: string): Page[];
export function writePage(page: Page): string;
export function resolvePage(page: Page): { width: number; height: number; unit: "px" | "mm"; margin: number; frames: ResolvedFrame[] };
export function readHints(text: string | undefined): Hints;
export function writeHints(hints: Hints): string;
export function hint(hints: Hints, key: string): string | true | undefined;
export function setHint(hints: Hints, key: string, value: string | true | undefined): Hints;
export function freshName(page: Page, base?: string): string;
export function renderPage(page: Page, options?: { renderMarkdown?: (md: string) => string; frameAttrs?: boolean }): string;
export function generatePageCSS(): string;
export function safeColor(value: unknown): string | null;
export function readGradient(value: unknown): { from: string; to: string; angle: number } | null;
export function shapePath(shape: string, w: number, h: number, options?: { radius?: number; points?: string; sides?: number; inner?: number; head?: number }): string;
export const SHAPES: string[];
export const STROKES: Set<string>;
export function toPx(value: string | number | undefined, whole?: number): number | null;
export function fromPx(px: number, unit: "px" | "mm" | "cm" | "in" | "pt"): string;
export function pageSize(size: string | undefined, landscape: boolean): { width: number; height: number; unit: "px" | "mm" };
export const PAGE_SIZES: Record<string, [number, number, string]>;

// ── Tables: merged cells (`>`, `^`) and cell styles (`{bg:…}`) ────────
export interface CellStyle { bg: string | null; color: string | null; align: string | null; valign: string | null; width: string | null; height: string | null }
export type CellMark = ">" | "^" | null;
export interface CellSpan { row: number; column: number; colspan: number; rowspan: number }
export declare function cellHint(raw: string): { style: CellStyle; before: string } | null;
export declare function hintOf(style: Partial<CellStyle>, columnAlign?: string | null): string;
export declare function markOf(raw: string): CellMark;
export declare function spansOf(grid: CellMark[][]): CellSpan[] | null;
export declare function marksOf(spans: CellSpan[], height: number, width: number): CellMark[][];
export declare function processTable(table: HTMLTableElement): void;
export declare function processTables(container: ParentNode): void;
