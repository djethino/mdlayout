// mdlayout dans VS Code : un lecteur des documents écrits avec mdlayout et MarkdownRoxor, dans l'aperçu Markdown intégré.
// - La syntaxe de mise en page (le greffon du paquet `@asymptomatik/mdlayout`, copié ici à la construction,
//   `scripts/build.mjs`) et les conventions de MarkdownRoxor (`src/conventions.js` : encadrés, notes, cases, `[[toc]]`,
//   figures et équations numérotées, thème de document), colorées dans l'éditeur par `syntaxes/`.
// - L'aperçu d'un fichier Mermaid seul (`.mmd`, `.mermaid`) : un document Markdown virtuel qui l'enveloppe dans un bloc
//   ```mermaid, ouvert dans l'aperçu de VS Code, dont le Mermaid intégré dessine le diagramme ; la vue suit le fichier.
// Aucune dépendance, aucun réseau, aucune télémétrie, aucun script dans l'aperçu : un lecteur, pas un éditeur.

const vscode = require('vscode');

/** Le schéma des documents virtuels de l'aperçu Mermaid. */
const SCHEME = 'mdlayout-mermaid';

/** Le document virtuel d'un fichier Mermaid : son chemin suivi de `.md` (l'aperçu le lit comme du Markdown), le fichier
 *  d'origine dans la requête. */
function virtualOf(source) {
  return vscode.Uri.from({ scheme: SCHEME, path: `${source.path}.md`, query: source.toString() });
}

/** @param {vscode.ExtensionContext} context */
async function activate(context) {
  const { markdownItMdLayout } = await import('./mdlayout/adapters/markdown-it-plugin.js');
  const { markdownItConventions } = await import('./src/conventions.js');
  const { MERMAID_FILE, wrapped } = await import('./src/mermaid.js');

  const changed = new vscode.EventEmitter();
  context.subscriptions.push(
    changed,
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, {
      onDidChange: changed.event,
      async provideTextDocumentContent(uri) {
        // 🔴 Seulement l'adresse que la commande fabrique : un fichier Mermaid, au même chemin. Une adresse de ce schéma
        // écrite ailleurs (un lien dans un document) ne fait lire aucun autre fichier.
        const source = vscode.Uri.parse(uri.query);
        if (!MERMAID_FILE.test(source.path) || virtualOf(source).toString() !== uri.toString()) {
          throw new Error('mdlayout: not a Mermaid preview address');
        }
        const document = await vscode.workspace.openTextDocument(source);
        return wrapped(document.getText());
      },
    }),
    // La vue suit le fichier, à chaque frappe.
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (MERMAID_FILE.test(event.document.uri.path)) changed.fire(virtualOf(event.document.uri));
    }),
    vscode.commands.registerCommand('mdlayout.previewMermaid', async (resource) => {
      const source = resource instanceof vscode.Uri ? resource : vscode.window.activeTextEditor?.document.uri;
      if (!source || !MERMAID_FILE.test(source.path)) {
        void vscode.window.showWarningMessage('mdlayout: open a Mermaid file (.mmd or .mermaid) to preview it.');
        return;
      }
      // Un aperçu verrouillé : un aperçu ordinaire suit l'éditeur actif — le fichier .mmd lui-même, qu'il lisait alors
      // comme du Markdown, en texte brut (vu dans VS Code 1.147, 2026-11-26).
      await vscode.commands.executeCommand('markdown.showLockedPreviewToSide', virtualOf(source));
    }),
  );

  return {
    /** @param {any} md - l'instance de markdown-it de l'aperçu */
    extendMarkdownIt(md) {
      // L'aperçu interdit tout cadre (sa politique de sécurité) : une vidéo en ligne y devient un lien vers sa page.
      return md.use(markdownItMdLayout, { embeds: false }).use(markdownItConventions);
    },
  };
}

function deactivate() {}

module.exports = { activate, deactivate };
