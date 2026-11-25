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
  // Une valeur dangereuse ne passe pas.
  assert.ok(!md.render('[x]{color:red;background:url(javascript:alert(1))}').includes('javascript:'));
});
