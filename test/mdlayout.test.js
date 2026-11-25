// Les essais de mdlayout (Écume n'en avait aucun). Lancer : node --test packages/mdlayout/test/mdlayout.test.js
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mdlayout, parseCanvas, parseHints, safeCssValue } from "../src/index.js";

const sample = "::::canvas{responsive}\n:::hero{full, bg:#1a1a2e, color:white, pad:loose}\n# Welcome\n:::\n:::sidebar{beside hero, third}\nNav\n:::\n::::";

test("les indications se lisent : mots, clés et valeurs, guillemets", () => {
  const hints = parseHints('{full, bg:#1a1a2e, below:"a b"}');
  assert.ok(JSON.stringify(hints).includes("full"));
  assert.ok(JSON.stringify(hints).includes("#1a1a2e"));
});

test("un canevas a ses blocs, dans l'ordre", () => {
  const [canvas] = parseCanvas(sample);
  assert.ok(canvas, "un canevas");
  const text = JSON.stringify(canvas);
  assert.ok(text.indexOf("hero") >= 0 && text.indexOf("hero") < text.indexOf("sidebar"), text);
});

test("le rendu échappe le texte : rien ne devient du code", () => {
  const html = mdlayout("::::canvas{responsive}\n:::a{full}\n<script>alert(1)</script>\n:::\n::::");
  assert.ok(!html.includes("<script>"), html);
  assert.ok(html.includes("&lt;script&gt;"), html);
});

test("une indication de style ne sort pas de sa valeur (pas de CSS injecté)", () => {
  for (const evil of ["red;position:fixed", "url(https://example.com/x.png)", "expression(alert(1))"]) {
    assert.equal(safeCssValue(evil), "", evil);
    const html = mdlayout(`::::canvas{responsive}\n:::a{bg:${evil}}\nx\n:::\n::::`);
    assert.ok(!html.includes("position:fixed") && !html.includes("url(") && !html.includes("expression("), `${evil} → ${html}`);
  }
  assert.equal(safeCssValue("#1a1a2e"), "#1a1a2e");
  assert.ok(mdlayout("::::canvas{responsive}\n:::a{bg:#1a1a2e}\nx\n:::\n::::").includes("background-color:#1a1a2e"));
});

test("le placement fixe tient avec un cycle (a sous b, b sous a)", () => {
  const html = mdlayout("::::canvas{fixed}\n:::a{below b}\nA\n:::\n:::b{below a}\nB\n:::\n::::");
  assert.ok(html.includes("mdl"), html);
});
