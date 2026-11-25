import { strict as assert } from "node:assert";
import { test } from "node:test";
import { cellHint, hintOf, markOf, marksOf, spansOf } from "../src/table/table.js";

test("une fusion se lit en rectangles, et se réécrit pareil", () => {
  // A s'étend sur deux colonnes et deux lignes ; B sur deux lignes.
  const grid = [
    [null, ">", null],
    ["^", ">", "^"],
    [null, null, null],
  ];
  const spans = spansOf(grid);
  assert.deepEqual(spans, [
    { row: 0, column: 0, colspan: 2, rowspan: 2 },
    { row: 0, column: 2, colspan: 1, rowspan: 2 },
    { row: 2, column: 0, colspan: 1, rowspan: 1 },
    { row: 2, column: 1, colspan: 1, rowspan: 1 },
    { row: 2, column: 2, colspan: 1, rowspan: 1 },
  ]);
  assert.deepEqual(marksOf(spans, 3, 3), grid);
});

test("ce qui ne forme pas un rectangle se lit sans fusion", () => {
  // `^` sous une cellule large mais seulement sur sa première colonne : un L, pas un rectangle.
  assert.equal(spansOf([[null, ">"], ["^", null]]), null);
  // Des rangées de longueurs différentes.
  assert.equal(spansOf([[null, null], [null]]), null);
  // `>` en première colonne et `^` en première ligne restent du texte (une cellule à eux).
  assert.equal(spansOf([[">", "^"]])?.length, 2);
});

test("le style d'une cellule se lit et s'écrit ; un style douteux reste du texte", () => {
  assert.deepEqual(cellHint("Payé {bg:#dcfce7, color:#166534, valign:middle}"), {
    before: "Payé",
    style: { bg: "#dcfce7", color: "#166534", align: null, valign: "middle", width: null, height: null },
  });
  assert.equal(cellHint("Total {align:right, width:30%}")?.style.width, "30%");
  // Un mot inconnu, une valeur qui pourrait sortir du style, le style d'un passage : pas un style de cellule.
  assert.equal(cellHint("x {weight:bold}"), null);
  assert.equal(cellHint("x {bg:red;background:url(evil)}"), null);
  assert.equal(cellHint("x {bg:expression(alert(1))}"), null);
  assert.equal(cellHint("[x]{color:red}"), null);
  assert.equal(cellHint("pas de style"), null);
  assert.equal(hintOf({ bg: "#fff", align: "center", valign: "top" }, "center"), "{bg:#fff, valign:top}");
  assert.equal(hintOf({}), "");
  // Une cellule écrite `\>` n'est pas une fusion.
  assert.equal(markOf(" > "), ">");
  assert.equal(markOf("\\>"), null);
});
