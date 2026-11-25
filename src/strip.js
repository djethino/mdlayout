// ── Strip ─────────────────────────────────────────────────────────────
// Plain Markdown (CommonMark and GFM tables) from a document written with
// mdlayout, for tools that do not know the layout syntax:
//   - layout fences (`::::canvas{…}`, `:::name{…}`, `::::page`, `::::`) go,
//     their content stays;
//   - hints after an image or a link (`![x](y){width:half}`) go;
//   - styled spans (`[word]{color:…}`) keep their text;
//   - a paragraph's alignment (`… {align:center}`) goes;
//   - table cell styles (`| a {bg:#eee} |`) go;
//   - `!video(url)` / `!audio(url)` become a link to their address;
//   - slide marks (`---slide …---`) become a thematic break;
//   - the `[[toc]]` line goes.
// Code (fenced) is left untouched, and so is the front matter. Line endings
// are kept as they are.

const FENCE = /^\s{0,3}(```|~~~)/;
const LAYOUT_FENCE = /^\s{0,3}:{3,}.*$/;
const TOC = /^\s*\[\[toc\]\]\s*$/i;
const SLIDE = /^\s*---slide.*---\s*$/;
const MEDIA = /^\s*!(video|audio)\(([^()\s]+)\)(\{[^{}]*\})?\s*$/;
const AFTER_LINK = /(?<=\))\{[^{}\n]*\}/g;
const CELL_STYLE = /\s*\{(?:bg|color|align|valign|width|height)[:=][^{}\n]*\}(?=\s*\|)/g;
const STYLED = /(?<!!)\[([^\]\n]+)\]\{[^{}\n]*\}/g;
const ALIGN = /\s*\{align:[a-z]+\}\s*$/;

/**
 * Plain Markdown from a document written with mdlayout.
 *
 * @param {string} markdown
 * @returns {{ markdown: string, removed: number }} the text, and how many layout marks were left out
 */
export function stripLayout(markdown) {
  const lines = markdown.split('\n');
  const out = [];
  let fenced = false;
  let removed = 0;
  // The front matter (`---` … `---` on the first lines) stays as it is.
  let front = lines[0] !== undefined && lines[0].replace(/^﻿/, '').trim() === '---';
  for (const [index, line] of lines.entries()) {
    const cr = line.endsWith('\r') ? '\r' : '';
    const text = cr ? line.slice(0, -1) : line;
    if (front) {
      out.push(line);
      if (index > 0 && text.trim() === '---') front = false;
      continue;
    }
    if (FENCE.test(text)) {
      fenced = !fenced;
      out.push(line);
      continue;
    }
    if (fenced) {
      out.push(line);
      continue;
    }
    if (LAYOUT_FENCE.test(text) || TOC.test(text)) {
      removed++;
      continue;
    }
    if (SLIDE.test(text)) {
      out.push(`---${cr}`);
      removed++;
      continue;
    }
    const media = text.match(MEDIA);
    if (media) {
      out.push(`[${media[2]}](${media[2]})${cr}`);
      removed++;
      continue;
    }
    let cleaned = text.replace(AFTER_LINK, '').replace(CELL_STYLE, '').replace(STYLED, '$1');
    if (!cleaned.trimStart().startsWith('|')) cleaned = cleaned.replace(ALIGN, '');
    if (cleaned !== text) removed++;
    out.push(cleaned + cr);
  }
  return { markdown: out.join('\n'), removed };
}
