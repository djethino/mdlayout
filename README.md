# @asymptomatik/mdlayout

On npm: https://www.npmjs.com/package/@asymptomatik/mdlayout

Spatial layout extension for Markdown. Position blocks, images, and styled content using a simple hint syntax.

**Zero dependencies** -- pure JavaScript, no DOM, no Node APIs.

Currently **ESM-only**. CJS/UMD builds are planned for a future release.

> **Note on AST structure**: The spec calls for 4 separate AST files. The implementation uses a single `src/ast/types.js` with factory functions, which is simpler to maintain. This is a conscious deviation.

## Installation

```bash
npm install @asymptomatik/mdlayout
```

## Usage

### Standalone

```javascript
import { mdlayout } from '@asymptomatik/mdlayout';

const html = mdlayout(`
::::canvas{responsive}
:::hero{full, bg:#1a1a2e, color:white, pad:loose}
# Welcome to the Future
:::
:::sidebar{beside hero, third}
Navigation content here
:::
::::
`);
```

### With marked

```javascript
import { marked } from 'marked';
import { markedMdLayout } from '@asymptomatik/mdlayout/marked';

marked.use(markedMdLayout());

const html = marked.parse(`
# My Document

::::canvas{responsive}
:::intro{two-thirds}
Main content area with **markdown** support.
:::
:::side{beside intro, third}
Sidebar content
:::
::::
`);
```

### Plain Markdown again

For a tool that does not know the layout syntax, `stripLayout(text)` (or the command line) gives plain
Markdown back: layout fences go and their content stays, hints go, styled spans keep their text, videos become links.
Code blocks and the front matter are left untouched.

```bash
npx @asymptomatik/mdlayout strip document.md -o document.plain.md
```

### With markdown-it

The parser of VS Code's Markdown preview, VitePress, Docusaurus and many others.

```javascript
import MarkdownIt from 'markdown-it';
import { markdownItMdLayout } from '@asymptomatik/mdlayout/markdown-it';

const md = new MarkdownIt().use(markdownItMdLayout);
const html = md.render('::::canvas{responsive}
:::hero{full}
# Hello
:::
::::
');
```

Add the base stylesheet once to the page (`generateBaseCSS()` from the main entry). In VS Code, the
**mdlayout — Markdown layout** extension does both.

## Syntax

### Canvas blocks

Wrap content in a canvas container. Two modes: `responsive` (CSS Grid) and `fixed` (absolute positioning).

```markdown
::::canvas{responsive}
:::blockName{hints}
Markdown content here
:::
::::
```

### Block hints

Hints control layout, style, and positioning:

```
{width:half, color:red, bg:#f0f0f0, pad:loose}
```

#### Width keywords

| Keyword | Grid span | Percentage |
|---------|-----------|------------|
| `full` | 12 | 100% |
| `two-thirds` | 8 | ~66.67% |
| `half` | 6 | 50% |
| `third` | 4 | ~33.33% |
| `quarter` | 3 | 25% |
| `wide` | 9 | 75% |
| `narrow` | 3 | 25% |

Shortcuts: bare keywords expand automatically. `{half}` = `{width:half}`.

#### Relations (responsive & fixed)

| Hint | Effect |
|------|--------|
| `beside blockName` | Place next to the referenced block |
| `below blockName` | Place below the referenced block |
| `above blockName` | Place above the referenced block |
| `right-of blockName` | Same as `beside` |
| `left-of blockName` | Place to the left of the referenced block |
| `overlay blockName` | Overlay on top of the referenced block (same position, higher z-index) |

For multi-word block references, use quoted values: `below:"blockA blockB"`.

#### Style properties

| Hint | CSS | Example |
|------|-----|---------|
| `color:red` | `color: red` | Text color |
| `bg:#1a1a2e` | `background-color: #1a1a2e` | Background |
| `font:serif` | `font-family: serif` | Font family |
| `size:xl` | `font-size: 1.5rem` | xs/sm/md/lg/xl or direct |
| `weight:bold` | `font-weight: bold` | Font weight |
| `radius:md` | `border-radius: 10px` | sm/md/lg or direct |
| `shadow:lg` | `box-shadow: ...` | sm/md/lg/none |
| `opacity:0.5` | `opacity: 0.5` | Transparency |
| `pad:loose` | `padding: 2rem` | tight/normal/loose or direct |
| `align:center` | `text-align: center` | Text alignment |
| `underline` | `text-decoration: underline` | Flag (no value) |

### Pages (free layout: frames, shapes, layers)

A page is laid out like a slide or a printed page: every frame is placed at exact coordinates, can be rotated,
stacked and drawn as a shape. The content of a frame stays plain Markdown.

```markdown
::::page{size:a4, margin:15mm, bg:#fffaf0}
:::title{x:15mm, y:15mm, w:180mm, h:25mm, size:32px, weight:700, color:#0f172a}
# Annual report
:::
:::badge{shape:ellipse, x:140mm, y:45mm, w:40mm, h:40mm, fill:gradient(#f59e0b #ef4444 135), stroke:#92400e, rotate:15, z:3}
**-30 %**
:::
:::photo{x:15mm, y:100mm, w:100mm, h:70mm, fit:cover, radius:4mm, shadow:md}
![Lighthouse](media/lighthouse.jpg)
:::
::::
```

Page hints: `size` (`a3`, `a4`, `a5`, `a6`, `letter`, `legal`, `tabloid`, `16:9`, `4:3`, `21:9`, `1:1`, `9:16`, `banner`,
or `WxH` with a unit such as `210x297mm`, `1280x720`), `landscape`, `margin`, `bg` (a colour or `gradient(a b angle)`).

Frame hints: `x`, `y`, `w`, `h` (units `px`, `mm`, `cm`, `in`, `pt`, or `%` of the page; a bare number is pixels),
`rotate` (degrees), `z` (stacking order), `layer`, `group`, `hidden`, `locked`; `shape` (`rect`, `rounded`, `ellipse`,
`triangle`, `diamond`, `pentagon`, `hexagon`, `star`, `arrow-right`, `chevron`, `bubble`, `line`, `arrow`, `polygon` with
`points:x y x y …` in % of the frame), `fill` (colour, `gradient(a b angle)`, `none`), `stroke`, `stroke-width`,
`dash` (`dashed`, `dotted`), `radius`, `opacity`, `shadow` (`sm`, `md`, `lg`); text: `size`, `weight`, `color`, `font`,
`align`, `valign` (`top`, `middle`, `bottom`), `pad`, `leading`; image: `fit` (`cover`, `contain`).

The page keeps its proportions at any width (`container-type: inline-size`; text sizes in `cqw`). Every value is
checked before reaching a style: colours, lengths, numbers and font names; nothing passes through as is.

API: `parsePages(text)`, `writePage(page)`, `resolvePage(page)`, `renderPage(page, { renderMarkdown })`,
`generatePageCSS()`, `readHints`, `writeHints`, `setHint`, `shapePath`, `toPx`, `fromPx`, `pageSize`.

### Media with hints

```markdown
![alt text](https://example.com/photo.jpg){width:half, radius:md, shadow:lg}

!video(https://example.com/video.mp4){width:full, ratio:16:9}

!audio(https://example.com/song.mp3){width:half}
```

### Inline styled text

```markdown
This text has [highlighted words]{color:red, size:xl, weight:bold} in it.

Use [underlined text]{underline} for emphasis.
```

### Tables: merged cells and cell styles

A GFM table stays a GFM table. Two additions, which any other Markdown reader shows as readable text:

```markdown
| Quarter | Sales                  | >          |
| ------- | ---------------------- | ---------- |
| Q1      | 120 {bg:#dcfce7}       | Rising     |
| ^       | 95                     | >          |
```

- a cell holding only `>` extends the cell on its left (colspan); only `^`, the cell above (rowspan). Write `\>` for a
  cell that must show a lone chevron. A merge that does not form a rectangle is ignored (the marks stay text).
- `{bg:…, color:…, align:left|center|right, valign:top|middle|bottom, width:30%}` at the end of a cell styles it;
  `height:48px` on a row's first cell sets the row's height, `width:180px` on a header cell the column's width.
  Colours must be `#hex`, a name or `rgb()`/`rgba()` of numbers; anything else leaves the hint as text.

`processTables(container)` applies both to tables already rendered by marked, markdown-it or remark (in a browser);
`cellHint`, `markOf`, `spansOf`, `marksOf` and `hintOf` are the pure functions behind it, for an editor that reads and
writes tables itself.

## API Reference

### Parsers

```javascript
import { parseHints, parseCanvas, parseBlock, parseMedia, parseInlineStyled } from '@asymptomatik/mdlayout';
```

- **`parseHints(str)`** -- Parse `{key:value, flag}` string to `HintMap`
- **`parseCanvas(text)`** -- Parse `::::canvas...::::` blocks to `CanvasNode[]`
- **`parseBlock(lines, startIndex)`** -- Parse a single `:::block:::` from lines
- **`parseMedia(line)`** -- Parse media element with hints to `MediaNode | null`
- **`parseInlineStyled(text)`** -- Parse `[text]{hints}` to `{ nodes, processed }`

### Resolvers

```javascript
import { resolveHints, resolveWidth, resolveStyles } from '@asymptomatik/mdlayout';
```

- **`resolveHints(hints)`** -- Transform HintMap to `{ classes, style, dataAttrs }`
- **`resolveWidth(value)`** -- Resolve width keyword to `{ percent, cssClass, cssValue }`
- **`resolveStyles(hints)`** -- Resolve visual hints to `{ style, classes }`

### Solvers

```javascript
import { solveConstraints, solveGrid } from '@asymptomatik/mdlayout';
```

- **`solveConstraints(canvas, options?)`** -- Fixed mode layout solver
- **`solveGrid(canvas)`** -- Responsive grid layout solver

### Renderers

```javascript
import { renderToHTML, generateCSS, generateBaseCSS } from '@asymptomatik/mdlayout';
```

- **`renderToHTML(ast, options?)`** -- Render AST to HTML string
- **`generateCSS(canvas, scopeId?)`** -- Generate scoped CSS for a canvas
- **`generateBaseCSS()`** -- Generate shared base CSS (include once)

### Convenience

```javascript
import { mdlayout } from '@asymptomatik/mdlayout';
```

- **`mdlayout(markdown, options?)`** -- One-shot: parse + render all mdlayout elements

## Examples

### Two-column layout

```markdown
::::canvas{responsive}
:::main{two-thirds}
# Article Title
Main content with full markdown support.
:::
:::sidebar{beside main, third, bg:#f5f5f5, pad:normal, radius:md}
## Related
- Link 1
- Link 2
:::
::::
```

### Hero section with sidebar

```markdown
::::canvas{responsive}
:::hero{full, bg:#1a1a2e, color:white, pad:loose, align:center}
# Welcome
Your tagline here
:::
:::features{half}
## Feature 1
Description
:::
:::features2{beside features, half}
## Feature 2
Description
:::
::::
```

### Image gallery

```markdown
![Photo 1](photo1.jpg){width:third, radius:md, shadow:sm}
![Photo 2](photo2.jpg){width:third, radius:md, shadow:sm}
![Photo 3](photo3.jpg){width:third, radius:md, shadow:sm}
```

### Styled text

```markdown
This is a paragraph with [important text]{color:red, weight:bold, size:lg}
and some [subtle note]{color:gray, size:sm, font:monospace}.
```

## CSS Classes

All generated elements use the `mdl-` prefix:

- `.mdl-canvas` / `.mdl-canvas--responsive` / `.mdl-canvas--fixed`
- `.mdl-block` / `.mdl-block__label` / `.mdl-block__content`
- `.mdl-media` / `.mdl-media--image` / `.mdl-media--video` / `.mdl-media--audio`
- `.mdl-styled`
- `.mdl--full`, `.mdl--half`, `.mdl--third`, etc. (width)
- `.mdl--pad-tight`, `.mdl--pad-normal`, `.mdl--pad-loose` (padding)
- `.mdl--valign-top`, `.mdl--valign-middle`, `.mdl--valign-bottom`
- `.mdl--gap-tight`, `.mdl--gap-normal`, `.mdl--gap-loose`
- `.mdl--z-front`, `.mdl--z-back` (z-index shortcuts)

Include the base CSS with `generateBaseCSS()` or use your own styles.

## Security

When using `renderMarkdown` (either via `mdlayout()` or `markedMdLayout()`), **the caller is responsible for sanitizing the HTML output**. By default (when no `renderMarkdown` is provided), the standalone `mdlayout()` function escapes all HTML entities. However, if you pass a custom `renderMarkdown` that produces raw HTML (e.g. `marked.parse()`), you must sanitize the output yourself (e.g. with [DOMPurify](https://github.com/cure53/DOMPurify)) before inserting it into the DOM. Failing to do so exposes your application to XSS attacks.

## License

MIT
