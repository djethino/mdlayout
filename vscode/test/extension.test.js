// L'extension elle-même, avec un faux module `vscode` (VS Code ne tourne pas ici) : elle s'active, donne ses greffons à
// l'aperçu, ouvre l'aperçu d'un fichier Mermaid par un document virtuel, et ne lit rien d'autre par ce chemin.
import { strict as assert } from 'node:assert';
import Module, { createRequire } from 'node:module';
import { test } from 'node:test';
import MarkdownIt from 'markdown-it';

// L'extension charge le greffon copié à la construction : la construire d'abord (ce qu'elle écrit est ignoré par git).
await import('../scripts/build.mjs');

class Uri {
  constructor(parts) {
    Object.assign(this, { scheme: 'file', authority: '', path: '', query: '', fragment: '' }, parts);
  }
  static from(parts) {
    return new Uri(parts);
  }
  static file(path) {
    return new Uri({ path });
  }
  static parse(text) {
    const match = text.match(/^([a-z-]+):(?:\/\/([^/]*))?([^?#]*)(?:\?([^#]*))?/);
    return new Uri({ scheme: match[1], authority: match[2] ?? '', path: match[3], query: match[4] ?? '' });
  }
  toString() {
    return `${this.scheme}:${this.authority || this.scheme === 'file' ? `//${this.authority}` : ''}${this.path}${this.query ? `?${this.query}` : ''}`;
  }
}

function fakeVscode(files) {
  const seen = { providers: {}, commands: {}, executed: [], warnings: [], changes: [] };
  return {
    seen,
    api: {
      Uri,
      EventEmitter: class {
        constructor() {
          this.event = (listener) => (this.listener = listener);
        }
        fire(value) {
          seen.changes.push(String(value));
        }
        dispose() {}
      },
      workspace: {
        registerTextDocumentContentProvider: (scheme, provider) => ((seen.providers[scheme] = provider), { dispose() {} }),
        onDidChangeTextDocument: (listener) => ((seen.onChange = listener), { dispose() {} }),
        openTextDocument: async (uri) => ({ getText: () => files[uri.path] ?? '' }),
      },
      commands: {
        registerCommand: (name, run) => ((seen.commands[name] = run), { dispose() {} }),
        executeCommand: async (...args) => void seen.executed.push(args),
      },
      window: { activeTextEditor: undefined, showWarningMessage: async (text) => void seen.warnings.push(text) },
    },
  };
}

test("l'extension : ses greffons, et l'aperçu d'un fichier Mermaid par un document virtuel", async () => {
  const { api, seen } = fakeVscode({ '/projet/flux.mmd': 'graph TD\n  A-->B\n', '/projet/secret.txt': 'secret' });
  const resolve = Module._resolveFilename;
  Module._resolveFilename = function (request, ...rest) {
    return request === 'vscode' ? 'vscode' : resolve.call(this, request, ...rest);
  };
  Module._cache.vscode = { id: 'vscode', filename: 'vscode', loaded: true, exports: api };
  try {
    const require = createRequire(import.meta.url);
    const extension = require('../extension.js');
    const context = { subscriptions: [] };
    const exported = await extension.activate(context);
    assert.ok(context.subscriptions.length >= 4);

    // Les greffons donnés à l'aperçu : mdlayout et les conventions, vidéos en ligne en liens.
    const md = exported.extendMarkdownIt(new MarkdownIt());
    const html = md.render('> [!TIP]\n> Astuce.\n\n!video(https://vimeo.com/123)\n');
    assert.match(html, /callout tip/);
    assert.ok(!html.includes('<iframe') && html.includes('href="https://vimeo.com/123"'), html);

    // La commande, sur un fichier Mermaid : l'aperçu de VS Code ouvert sur le document virtuel, qui enveloppe le fichier.
    await seen.commands['mdlayout.previewMermaid'](Uri.file('/projet/flux.mmd'));
    const [command, virtual] = seen.executed[0];
    assert.equal(command, 'markdown.showLockedPreviewToSide');
    assert.equal(virtual.scheme, 'mdlayout-mermaid');
    assert.match(virtual.path, /flux\.mmd\.md$/);
    assert.equal(await seen.providers['mdlayout-mermaid'].provideTextDocumentContent(virtual), '```mermaid\ngraph TD\n  A-->B\n```\n');
    // Le fichier change : la vue est prévenue.
    seen.onChange({ document: { uri: Uri.file('/projet/flux.mmd') } });
    assert.equal(seen.changes.length, 1);

    // Pas un fichier Mermaid : un message, rien d'ouvert.
    await seen.commands['mdlayout.previewMermaid'](Uri.file('/projet/notes.md'));
    assert.equal(seen.executed.length, 1);
    assert.equal(seen.warnings.length, 1);

    // 🔴 Une adresse de ce schéma fabriquée ailleurs ne fait lire aucun autre fichier.
    const forged = Uri.from({ scheme: 'mdlayout-mermaid', path: '/x.mmd.md', query: 'file:///projet/secret.txt' });
    await assert.rejects(seen.providers['mdlayout-mermaid'].provideTextDocumentContent(forged), /not a Mermaid preview address/);
  } finally {
    Module._resolveFilename = resolve;
    delete Module._cache.vscode;
  }
});
