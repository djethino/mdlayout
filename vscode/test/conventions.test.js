// Les conventions de MarkdownRoxor dans markdown-it (l'aperçu de VS Code), contre le vrai markdown-it.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import MarkdownIt from 'markdown-it';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// La bibliothèque : `packages/mdlayout/src` dans DecisionRoxor, `src/` à la racine du dépôt public (l'extension y est
// dans `vscode/`).
const library = ['../../mdlayout/src', '../../src'].map((dir) => new URL(`${dir}/adapters/markdown-it-plugin.js`, import.meta.url)).find((url) => existsSync(fileURLToPath(url)));
const { markdownItMdLayout } = await import(library.href);
import { markdownItConventions, slugsOf, themeOf, withoutSettings } from '../src/conventions.js';

const reader = () => new MarkdownIt().use(markdownItMdLayout, { embeds: false }).use(markdownItConventions);

test('encadrés, cases de tâches, filet de diapositive', () => {
  const html = reader().render('> [!NOTE]\n> Lisez ceci.\n\n> [!warning]\n> Attention à la marche.\n\n> [!TIP] Sur la même ligne : une citation, comme sur GitHub.\n\n> Une citation.\n\n- [ ] à faire\n- [x] fait\n\n---slide bg:#000---\n');
  assert.match(html, /<aside class="callout note" data-kind="NOTE">\n<p class="callout-title">Note<\/p>\n<p>Lisez ceci\.<\/p>\n<\/aside>/);
  assert.match(html, /<aside class="callout warning" data-kind="WARNING">\n<p class="callout-title">Warning<\/p>\n<p>Attention à la marche\.<\/p>/);
  assert.match(html, /<blockquote>\n<p>\[!TIP\] Sur la même ligne/);
  assert.match(html, /<blockquote>\n<p>Une citation\.<\/p>/);
  assert.match(html, /<li class="task"><input class="task-box" type="checkbox" disabled> à faire<\/li>/);
  assert.match(html, /<li class="task done"><input class="task-box" type="checkbox" disabled checked> fait<\/li>/);
  assert.match(html, /<hr class="mdr-slide">/);
});

test('notes de bas de page : numérotées dans l’ordre des renvois, regroupées à la fin', () => {
  const html = reader().render('Un[^b] et deux[^a] et encore[^b].\n\n[^a]: La note *a*.\n[^b]: La note b,\n  sur deux lignes.\n\nUn [^inconnu] reste du texte.\n');
  assert.match(html, /Un<sup class="footnote-ref"><a href="#fn-b" id="fnref-b">1<\/a><\/sup> et deux<sup class="footnote-ref"><a href="#fn-a" id="fnref-a">2<\/a><\/sup>/);
  assert.match(html, /<section class="footnotes"><ol>\n<li id="fn-b">La note b, sur deux lignes\. <a class="footnote-back" href="#fnref-b">↩<\/a><\/li>\n<li id="fn-a">La note <em>a<\/em>\./);
  assert.match(html, /Un \[\^inconnu\] reste du texte/);
  assert.ok(!html.includes('[^a]:'), html);
});

test('[[toc]] : les titres 1 à 3, avec les ancres de VS Code (doublons compris)', () => {
  const html = reader().render('[[toc]]\n\n# Intro\n\n## Le `code` d’ici\n\n#### Trop bas\n\n# Intro\n');
  assert.match(html, /<nav class="toc"><ol><li class="toc-1"><a href="#intro">Intro<\/a><\/li><li class="toc-2"><a href="#le-code-dici">Le code d’ici<\/a><\/li><li class="toc-1"><a href="#intro-1">Intro<\/a><\/li><\/ol><\/nav>/);
  assert.match(html, /<h1 id="intro">Intro<\/h1>/);
  assert.match(html, /<h1 id="intro-1">Intro<\/h1>/);
  assert.deepEqual(slugsOf(['A b!', 'A b!', 'A b!']), ['a-b', 'a-b-1', 'a-b-2']);
});

test('figures numérotées et renvois', () => {
  const html = reader().render('Voir @fig-carte puis @fig-plan, et @fig-rien.\n\n![La carte](carte.png){#fig-carte, width:half}\n\n![Le plan](plan.png){#fig:plan}\n\nUn courriel a@fig-carte.fr ne bouge pas.\n');
  assert.match(html, /Voir <a class="figure-ref" href="#fig-carte">Figure 1<\/a> puis <a class="figure-ref" href="#fig-plan">Figure 2<\/a>, et <span class="figure-ref missing">Figure \?<\/span>/);
  assert.match(html, /<figure id="fig-carte" class="mdl-media[^"]*"[^>]*><img src="carte\.png"[^>]*\/><figcaption class="figcaption">Figure 1 — La carte<\/figcaption><\/figure>/);
  assert.match(html, /<figure id="fig-plan" /);
  assert.match(html, /a@fig-carte\.fr/);
});

test('équations numérotées : \\label, \\eqref, \\ref, \\tag gardé', () => {
  // Le greffon KaTeX de VS Code produit des jetons math_block et math_inline : ce greffon d'essai fait de même.
  const fakeMath = (md) => {
    md.block.ruler.before('paragraph', 'math_block', (state, start, end, silent) => {
      const first = state.src.slice(state.bMarks[start] + state.tShift[start], state.eMarks[start]);
      if (first !== '$$') return false;
      let line = start + 1;
      while (line < end && state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]) !== '$$') line++;
      if (silent) return true;
      state.push('math_block', 'math', 0).content = state.getLines(start + 1, line, 0, false).trim();
      state.line = line + 1;
      return true;
    });
    md.inline.ruler.before('escape', 'math_inline', (state, silent) => {
      const match = state.src.slice(state.pos).match(/^\$([^$\n]+)\$/);
      if (!match) return false;
      if (!silent) state.push('math_inline', 'math', 0).content = match[1];
      state.pos += match[0].length;
      return true;
    });
    md.renderer.rules.math_block = (tokens, idx) => `<div class="math">${tokens[idx].content}</div>\n`;
    md.renderer.rules.math_inline = (tokens, idx) => `<span class="math">${tokens[idx].content}</span>`;
  };
  const md = new MarkdownIt().use(fakeMath).use(markdownItMdLayout).use(markdownItConventions);
  const html = md.render('$$\nE = mc^2 \\label{energie}\n$$\n\n$$\na = b \\tag{A} \\label{main}\n$$\n\n$$\nx = 1 \\label{x}\n$$\n\nVoir $\\eqref{energie}$, $\\ref{x}$, $\\eqref{main}$ et $\\eqref{nul}$.\n');
  assert.match(html, /<div class="math">E = mc\^2 \\tag\{1\}<\/div>/);
  assert.match(html, /<div class="math">a = b \\tag\{A\} <\/div>/);
  assert.match(html, /<div class="math">x = 1 \\tag\{2\}<\/div>/);
  assert.match(html, /Voir <span class="math">\\text\{\(1\)\}<\/span>, <span class="math">\\text\{2\}<\/span>, <span class="math">\\text\{\(A\)\}<\/span> et <span class="math">\\text\{\(\?\)\}<\/span>/);
});

test('thème de document : lu du front matter, validé ; rien sans thème', () => {
  assert.deepEqual(themeOf('format: a4\ntheme: { name: "R", font: serif, headings: mono, text: "#1b1b1f", link: "url(x)", accent: "#ABC" }\nbackground: "#fbf7ee"'), {
    theme: { font: 'serif', headings: 'mono', text: '#1b1b1f', accent: '#abc' },
    background: '#fbf7ee',
  });
  assert.equal(themeOf('format: a4'), null);
  // Le front matter tel que le garde l'aperçu de VS Code (un jeton front_matter) : ce greffon d'essai le pose.
  const frontMatter = (md) =>
    md.block.ruler.before('table', 'front_matter', (state, start, end, silent) => {
      if (start !== 0 || state.src.slice(0, 4) !== '---\n') return false;
      let line = 1;
      while (line < end && state.src.slice(state.bMarks[line], state.eMarks[line]) !== '---') line++;
      if (silent) return true;
      state.push('front_matter', '', 0).meta = { content: state.getLines(1, line, 0, false) }; // comme VS Code (yamlPreamble.ts)
      state.line = line + 1;
      return true;
    });
  const md = new MarkdownIt().use(frontMatter).use(markdownItMdLayout).use(markdownItConventions);
  md.renderer.rules.front_matter = () => '';
  const html = md.render('---\ntheme: { name: "N", font: serif, headings: sans, text: "#f1f5f0", heading: "#fde68a", link: "#93c5fd", accent: "#fde68a", surface: "#24423a" }\nbackground: "#1b3a33"\n---\n\n# Titre\n');
  assert.match(html, /^<div class="mdr-themed" style="--mdr-text:#f1f5f0;--mdr-heading:#fde68a;--mdr-link:#93c5fd;--mdr-accent:#fde68a;--mdr-surface:#24423a;--mdr-font:Georgia, &quot;Iowan Old Style&quot;, &quot;Palatino Linotype&quot;, &quot;Times New Roman&quot;, serif;--mdr-heading-font:system-ui, -apple-system, &quot;Segoe UI&quot;, sans-serif;--mdr-paper:#1b3a33">\n/);
  assert.match(html, /<\/h1>\n<\/div>\n$/);
  assert.ok(!md.render('# Sans thème\n').includes('mdr-themed'));
});

test('cohabitation avec Markdown All in One : ni case ni encadré en double, dans un ordre comme dans l’autre', async () => {
  // Les greffons qu'utilise Markdown All in One pour son aperçu (dépendances de développement de ces essais seulement).
  const taskLists = (await import('markdown-it-task-lists')).default;
  const alerts = (await import('markdown-it-github-alerts')).default;
  const source = '> [!NOTE]\n> Lisez ceci.\n\n- [ ] à faire\n- [x] fait\n';
  const count = (html, pattern) => (html.match(pattern) || []).length;
  const orders = {
    'eux avant nous': (md) => md.use(taskLists).use(alerts).use(markdownItMdLayout).use(markdownItConventions),
    'nous avant eux': (md) => md.use(markdownItMdLayout).use(markdownItConventions).use(taskLists).use(alerts),
  };
  for (const [order, setUp] of Object.entries(orders)) {
    const html = setUp(new MarkdownIt()).render(source);
    assert.equal(count(html, /type="checkbox"/g), 2, `${order} : ${html}`);
    assert.equal(count(html, /\[ \]|\[x\]/g), 0, `${order} : ${html}`);
    assert.equal(count(html, /\[!NOTE\]/g), 0, `${order} : ${html}`);
    // Un seul encadré, le nôtre ou le leur : jamais l'un dans l'autre.
    assert.equal(count(html, /callout note|markdown-alert-note/g), 1, `${order} : ${html}`);
  }
});

test('un fond sans thème : le texte prend le ton qu’il lui faut', () => {
  const frontMatter = (md) =>
    md.block.ruler.before('table', 'front_matter', (state, start, end, silent) => {
      if (start !== 0 || state.src.slice(0, 4) !== '---\n') return false;
      let line = 1;
      while (line < end && state.src.slice(state.bMarks[line], state.eMarks[line]) !== '---') line++;
      if (silent) return true;
      state.push('front_matter', '', 0).meta = state.getLines(1, line, 0, false);
      state.line = line + 1;
      return true;
    });
  const md = new MarkdownIt().use(frontMatter).use(markdownItConventions);
  md.renderer.rules.front_matter = () => '';
  assert.match(md.render('---\nbackground: "#0f172a"\n---\n\nTexte\n'), /class="mdr-themed paper-only dark"/);
  assert.match(md.render('---\nbackground: "#fbf7ee"\n---\n\nTexte\n'), /class="mdr-themed paper-only light"/);
});

test('le tableau d’en-tête de VS Code ne montre plus les réglages de MarkdownRoxor, seulement ce que l’auteur y a mis', () => {
  const frontMatter = (md) =>
    md.block.ruler.before('table', 'front_matter', (state, start, end, silent) => {
      if (start !== 0 || state.src.slice(0, 4) !== '---\n') return false;
      let line = 1;
      while (line < end && state.src.slice(state.bMarks[line], state.eMarks[line]) !== '---') line++;
      if (silent) return true;
      state.push('front_matter', '', 0).meta = { content: state.getLines(1, line, 0, false) };
      state.line = line + 1;
      return true;
    });
  const md = new MarkdownIt().use(frontMatter).use(markdownItMdLayout).use(markdownItConventions);
  // Comme VS Code (son réglage par défaut, « table ») : rien sans meta, sinon une ligne par clé.
  md.renderer.rules.front_matter = (tokens, i) => {
    const meta = tokens[i].meta;
    if (!meta) return '';
    return `<table class="frontmatter">${meta.content.split('\n').filter(Boolean).map((line) => `<tr><th>${line.split(':')[0]}</th></tr>`).join('')}</table>\n`;
  };
  const ours = md.render('---\nformat: a4\ntheme: { name: "N", text: "#f1f5f0" }\nbackground: "#1b3a33"\n---\n\n# Titre\n');
  assert.ok(!ours.includes('frontmatter'), ours);
  assert.match(ours, /mdr-themed/); // le thème, lu avant, s'applique toujours
  const mixed = md.render('---\ntitle: Le phare\nformat: a4\nauthor: Moi\n---\n\nTexte\n');
  assert.match(mixed, /<table class="frontmatter"><tr><th>title<\/th><\/tr><tr><th>author<\/th><\/tr><\/table>/);
  assert.equal(withoutSettings('title: X\r\nformat: a4\r\ntheme: { }\r\nbackground: "#fff"'), 'title: X');
});

test('aperçu Mermaid : le fichier enveloppé dans un bloc que rien du diagramme ne ferme', async () => {
  const { wrapped, MERMAID_FILE } = await import('../src/mermaid.js');
  assert.equal(wrapped('graph TD\n  A-->B\n\n'), '```mermaid\ngraph TD\n  A-->B\n```\n');
  assert.equal(wrapped('a\n````\nb'), '`````mermaid\na\n````\nb\n`````\n');
  assert.ok(MERMAID_FILE.test('/x/flux.MMD') && MERMAID_FILE.test('a.mermaid') && !MERMAID_FILE.test('a.md'));
  // Lu par markdown-it : un seul bloc de code mermaid.
  const html = new MarkdownIt().render(wrapped('a\n```\nb'));
  assert.equal((html.match(/<pre><code class="language-mermaid">/g) || []).length, 1);
});

test('dans une colonne : la note, la figure et son renvoi d’avant gardent leur numéro, la liste des notes est unique', () => {
  const html = reader().render('Voir @fig-carte.\n\n::::canvas{responsive}\n:::a{half}\nUne note[^n] ici.\n:::\n:::b{half}\n![La carte](carte.svg){#fig-carte}\n:::\n::::\n\nEt une autre[^m].\n\n[^n]: Dans la colonne.\n[^m]: Dehors.\n');
  assert.match(html, /Voir <a class="figure-ref" href="#fig-carte">Figure 1<\/a>/);
  assert.match(html, /<figure id="fig-carte" [^>]*>.*Figure 1 — La carte/s);
  assert.match(html, /Une note<sup class="footnote-ref"><a href="#fn-n" id="fnref-n">\d<\/a><\/sup> ici/);
  assert.equal((html.match(/<section class="footnotes">/g) || []).length, 1);
  assert.match(html, /<li id="fn-n">Dans la colonne\./);
  assert.match(html, /<li id="fn-m">Dehors\./);
});

test('comme dans VS Code : lu avec un env, rendu avec un autre — notes, figures et leurs numéros tiennent', () => {
  // markdownEngine.ts de VS Code : engine.parse(texte, envDeLecture) — jetons mis en cache —, puis
  // engine.renderer.render(jetons, options, envDeRendu), un env neuf.
  const md = reader();
  const source = 'Voir @fig-carte.\n\n::::canvas{responsive}\n:::a{half}\nUne note[^n] ici.\n:::\n:::b{half}\n![La carte](carte.svg){#fig-carte}\n:::\n::::\n\nEt une autre[^m] et $x$.\n\n[^n]: Dans la colonne.\n[^m]: Dehors.\n';
  const tokens = md.parse(source, { slugifier: 'lecture' });
  for (const pass of [1, 2]) {
    // Deux rendus des mêmes jetons (VS Code les garde en cache) : le même résultat.
    const html = md.renderer.render(tokens, md.options, { slugifier: `rendu ${pass}` });
    assert.match(html, /Voir <a class="figure-ref" href="#fig-carte">Figure 1<\/a>/, `rendu ${pass}`);
    assert.match(html, /<figure id="fig-carte" [^>]*>.*Figure 1 — La carte/s, `rendu ${pass}`);
    assert.match(html, /Une note<sup class="footnote-ref"><a href="#fn-n" id="fnref-n">\d<\/a><\/sup> ici/, `rendu ${pass}`);
    assert.match(html, /autre<sup class="footnote-ref"><a href="#fn-m" id="fnref-m">\d<\/a><\/sup>/, `rendu ${pass}`);
    assert.equal((html.match(/<section class="footnotes">/g) || []).length, 1, `rendu ${pass}`);
    assert.match(html, /<li id="fn-n">Dans la colonne\./, `rendu ${pass}`);
    assert.match(html, /<li id="fn-m">Dehors\./, `rendu ${pass}`);
  }
});
