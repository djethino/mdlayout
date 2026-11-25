# mdlayout — Markdown layout

Write page layouts in plain Markdown and see them in VS Code's Markdown preview: blocks side by side, a text beside a
picture, images and videos sized with a hint, styled words. The file stays Markdown; other tools show it as text.

```markdown
::::canvas{responsive}
:::intro{two-thirds}
# Our offer
Three plans, one price per month.
:::
:::picture{third}
![The team](team.jpg){radius:md, shadow:md}
:::
::::

A [highlighted]{bg:#fef08a} word, and a video: !video(https://www.youtube.com/watch?v=ID){width:full}
```

## What it adds

- **In the preview**: `::::canvas` blocks laid out in columns (`half`, `third`, `two-thirds`, `quarter`, `width:40%`,
  `beside`, backgrounds and padding), images with layout hints, `!video(…)` and `!audio(…)` players, styled spans
  `[text]{color:…, bg:…, size:…, font:…}`.
- **In the editor**: the layout markers and hints are coloured.

The syntax is the one of the open-source library [`@asymptomatik/mdlayout`](https://www.npmjs.com/package/@asymptomatik/mdlayout),
also used by MarkdownRoxor. Style values are filtered: a hint can set a colour or a size, never a script or an outside
address.

No network access, no telemetry.

## Licence

MIT — ASymptOmatik.
