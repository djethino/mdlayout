# mdlayout — Markdown layout

Read documents written with mdlayout and MarkdownRoxor in VS Code's Markdown preview: page layouts, callouts, footnotes,
task lists, a table of contents, numbered figures and equations, document themes — and preview standalone Mermaid files.
The files stay Markdown; other tools show them as text.

```markdown
::::canvas{responsive}
:::intro{two-thirds}
# Our offer {align:center}
Three plans, one price per month.[^vat]
:::
:::picture{third}
![The team](team.jpg){#fig-team, radius:md}
:::
::::

> [!TIP]
> See @fig-team for who answers the phone.

[^vat]: Prices before VAT.
```

## What it adds to the preview

- **Layout** (the mdlayout syntax): `::::canvas` blocks in columns (`half`, `third`, `two-thirds`, `quarter`,
  `width:40%`, `beside`, backgrounds, padding); free pages `::::page` with positioned frames, shapes and layers; images
  with layout hints; `!video(…)` and `!audio(…)` players; styled spans `[text]{color:…, bg:…, size:…, font:…}`; a
  paragraph or heading aligned with `{align:center}`; tables with merged cells (`>` and `^`) and cell styles
  (`{bg:…, color:…, align:…, width:…}`).
- **Callouts** `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]` (GitHub's alerts).
- **Footnotes** `[^label]`, gathered at the end, numbered in the order they are referred to.
- **Task lists** `- [ ]` and `- [x]`.
- **Table of contents**: `[[toc]]` alone on a line, built from the headings 1 to 3 and linked to them.
- **Numbered figures**: `![Caption](image.png){#fig-name}` gets “Figure 1 — Caption”, and `@fig-name` in the text
  becomes a link “Figure 1” (the convention of Quarto and pandoc-crossref).
- **Numbered equations**: `\label{name}` in a display formula numbers it, `\eqref{name}` and `\ref{name}` refer to it
  (with VS Code's built-in math).
- **Document themes**: the `theme:` and `background:` lines of the front matter (written by MarkdownRoxor) give the
  document its own colours, fonts and paper.
- **Slide marks** `---slide …---` show as a break.

Mermaid diagrams and math formulas are drawn by VS Code itself.

## Mermaid files

**mdlayout: Preview Mermaid Diagram** (the preview button of the editor, or the context menu of a `.mmd` or `.mermaid`
file) opens the diagram in VS Code's preview, drawn by its built-in Mermaid, and follows the file as you type. Mermaid
files are coloured in the editor.

## With other extensions

It is a reader: it adds no editing command or shortcut, and works next to editing extensions such as Markdown All in
One. When another extension already shows task boxes or callouts, it leaves them to it: nothing appears twice.

## Network and security

The extension itself connects to nothing and collects nothing, and runs no script in the preview. What a document
points to obeys the security settings of VS Code's Markdown preview (**Markdown: Change preview security settings**).
With the default level, *Strict*:

- images and audio or video files over `https:` are loaded by the preview, as for any Markdown image;
- frames are not allowed, so a YouTube, Vimeo or Dailymotion video shows as a link to its page (`▶ youtube.com`)
  instead of a player — the link opens in your browser;
- no script runs.

Hint values are filtered: a hint can set a colour or a size, never a script or an outside address.

The syntax is the one of the open-source library
[`@asymptomatik/mdlayout`](https://www.npmjs.com/package/@asymptomatik/mdlayout), also used by MarkdownRoxor.

## Licence

MIT — ASymptOmatik.
