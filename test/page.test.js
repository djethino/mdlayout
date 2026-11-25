import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parsePages, readHints, renderPage, resolvePage, setHint, writePage } from '../src/index.js';

const SOURCE = `Avant.

::::page{size:a4, margin:15mm, bg:#fffaf0}
:::titre{x:15mm, y:15mm, w:180mm, h:25mm, size:32px, weight:700}
# Rapport annuel
:::
:::pastille{shape:ellipse, x:120mm, y:45mm, w:40mm, h:40mm, fill:gradient(#f59e0b #ef4444 90), stroke:#92400e, rotate:15, z:3}
**-30 %**
:::
:::code{x:15mm, y:100mm, w:100mm, h:40mm}
\`\`\`js
:::
\`\`\`
:::
::::

Après.`;

test('une page se lit : sa taille, ses cadres, leurs indications et leur texte', () => {
  const [page] = parsePages(SOURCE);
  assert.ok(page);
  assert.equal(page.raw?.startsWith('::::page{size:a4'), true);
  assert.deepEqual(page.frames.map((f) => f.name), ['titre', 'pastille', 'code']);
  assert.equal(page.frames[1].hints.find(([k]) => k === 'fill')?.[1], 'gradient(#f59e0b #ef4444 90)');
  assert.equal(page.frames[2].content, '```js\n:::\n```', 'un ::: dans un bloc de code ne ferme pas le cadre');
  const resolved = resolvePage(page);
  assert.equal(Math.round(resolved.width), 794);
  assert.equal(Math.round(resolved.frames[0].x), 57);
});

test('réécrite, une page se relit pareil ; une indication changée garde les autres à leur place', () => {
  const [page] = parsePages(SOURCE);
  const again = parsePages(writePage(page))[0];
  assert.deepEqual(again.frames, page.frames);
  assert.deepEqual(again.hints, page.hints);
  const moved = setHint(page.frames[0].hints, 'x', '20mm');
  assert.deepEqual(moved.slice(0, 2), [['x', '20mm'], ['y', '15mm']]);
  assert.deepEqual(readHints('a:1, b:gradient(#a #b 9), flag'), [['a', '1'], ['b', 'gradient(#a #b 9)'], ['flag', true]]);
});

test('le dessin est sûr : une valeur douteuse ne passe pas dans le style', () => {
  const [page] = parsePages('::::page{size:16:9, bg:red;background:url(x)}\n:::a{x:10, y:10, w:100, h:50, color:red;position:fixed, font:x}y{, fill:url(javascript:1)}\n<script>alert(1)</script>\n:::\n::::');
  const html = renderPage(page);
  assert.ok(!html.includes('url('), html);
  assert.ok(!html.includes('position:fixed'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('mdl-page'));
});

test("étoile : ses branches et son creux ; flèche : sa pointe — bornés", async () => {
  const { shapePath } = await import("../src/page/shapes.js");
  const points = (d) => d.split("L").length;
  assert.equal(points(shapePath("star", 100, 100)), 10);
  assert.equal(points(shapePath("star", 100, 100, { sides: 8 })), 16);
  assert.equal(points(shapePath("star", 100, 100, { sides: 999 })), 48);
  // Le creux : le premier point intérieur se rapproche du centre quand `inner` baisse.
  const inner = (d) => {
    const [x, y] = d.split("L")[1].trim().split(" ").map(Number);
    return Math.hypot(x - 50, y - 50);
  };
  assert.ok(inner(shapePath("star", 100, 100, { inner: 0.2 })) < inner(shapePath("star", 100, 100, { inner: 0.8 })));
  assert.equal(shapePath("star", 100, 100, { inner: NaN }), shapePath("star", 100, 100));
  // La pointe d'une flèche : plus longue quand `head` monte.
  assert.notEqual(shapePath("arrow-right", 200, 50, { head: 0.7 }), shapePath("arrow-right", 200, 50));
  assert.equal(shapePath("arrow-right", 200, 50, { head: 5 }), shapePath("arrow-right", 200, 50, { head: 0.9 }));
});
