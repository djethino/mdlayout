// Le greffon markdown-it, contre un vrai markdown-it : l'essai se saute (et le dit) tant que markdown-it n'est pas
// installé en dépendance de développement — un téléchargement, à faire avec l'accord de l'utilisateur.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { markdownItMdLayout } from '../src/adapters/markdown-it-plugin.js';

let MarkdownIt = null;
try {
  MarkdownIt = (await import('markdown-it')).default;
} catch {
  MarkdownIt = null;
}

test('le greffon markdown-it rend la syntaxe de mdlayout', { skip: MarkdownIt ? false : 'markdown-it is not installed' }, () => {
  const md = new MarkdownIt().use(markdownItMdLayout);
  const canvas = md.render('Avant.\n\n::::canvas{responsive}\n:::hero{full, bg:#1a1a2e}\n# Bonjour\n:::\n::::\n\nAprès.\n');
  assert.match(canvas, /<p>Avant\.<\/p>/);
  assert.match(canvas, /Bonjour<\/h1>/);
  assert.match(canvas, /<p>Après\.<\/p>/);
  assert.ok(!canvas.includes('::::'), canvas);
  // Une image avec des indications, une vidéo, un passage stylé.
  const inline = md.render('![carte](carte.png){width:half}\n\n!video(film.mp4)\n\nUn [mot]{color:#dc2626} rouge.\n');
  assert.match(inline, /carte\.png/);
  assert.match(inline, /<video/);
  assert.match(inline, /#dc2626/);
  // Un canevas jamais refermé reste du texte ; un lien ordinaire reste un lien.
  assert.match(md.render('::::canvas\n:::a\nx\n:::\n'), /::::canvas/);
  assert.match(md.render('[lien](https://example.org)'), /<a href="https:\/\/example.org">lien<\/a>/);
  // Là où les cadres sont interdits (l'aperçu de VS Code) : une vidéo en ligne devient un lien vers sa page.
  const strict = new MarkdownIt().use(markdownItMdLayout, { embeds: false }).render('!video(https://www.youtube.com/watch?v=abc123)' + String.fromCharCode(10));
  assert.ok(!strict.includes('<iframe') && strict.includes('href="https://www.youtube.com/watch?v=abc123"'), strict);
  // Une valeur dangereuse ne passe pas.
  assert.ok(!md.render('[x]{color:red;background:url(javascript:alert(1))}').includes('javascript:'));
});

test('le greffon markdown-it lit les pages libres, les tableaux fusionnés et stylés, l’alignement', { skip: MarkdownIt ? false : 'markdown-it is not installed' }, () => {
  const md = new MarkdownIt().use(markdownItMdLayout);
  // Une page libre : ses cadres placés, leur texte rendu par markdown-it.
  const page = md.render('::::page{size:16:9}\n:::titre{x:10%, y:10%, w:80%, h:20%}\n# Bonjour\n:::\n::::\n\nAprès.\n');
  assert.match(page, /class="mdl-page/);
  assert.match(page, /Bonjour<\/h1>/);
  assert.match(page, /<p>Après\.<\/p>/);
  assert.ok(!page.includes('::::'), page);
  // Un tableau : une cellule prolongée à droite, une autre vers le bas, des styles.
  const table = md.render(
    ['| A | B | C |', '|:--|---|---|', '| 1 {bg:#dcfce7} | > | x |', '| 2 | 3 | ^ |', '| \> | 5 | 6 |'].join('\n'),
  );
  assert.match(table, /<td style="text-align:left;background:#dcfce7" colspan="2">1<\/td>/);
  assert.match(table, /<td rowspan="2">x<\/td>/);
  assert.equal((table.match(/<td/g) || []).length, 7);
  assert.match(table, /<td style="text-align:left">&gt;<\/td>/);
  // Une fusion qui ne fait pas un rectangle : le tableau se lit sans fusion.
  const odd = md.render(['| A | B |', '|---|---|', '| 1 | > |', '| ^ | 3 |'].join('\n'));
  assert.equal((odd.match(/<td/g) || []).length, 4);
  // L'alignement d'un paragraphe et d'un titre.
  assert.match(md.render('# Titre {align:center}\n\nTexte. {align:right}\n'), /<h1 style="text-align:center">Titre<\/h1>\n<p style="text-align:right">Texte\.<\/p>/);
  // Un `::::` dans du code ne ferme pas une page.
  assert.match(md.render('::::page\n:::a{x:0, y:0, w:10, h:10}\n```\n::::\n```\n:::\n::::\n'), /class="mdl-page/);
});
