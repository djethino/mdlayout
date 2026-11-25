// mdlayout dans VS Code : la syntaxe de mise en page Markdown rendue dans l'aperçu Markdown intégré (et colorée dans
// l'éditeur, par `syntaxes/`). Le greffon est celui du paquet `@asymptomatik/mdlayout`, copié ici à la construction
// (`scripts/build.mjs`) : l'extension n'a aucune dépendance, aucun réseau, aucune télémétrie.
//
// L'aperçu de VS Code construit son markdown-it puis le passe à `extendMarkdownIt` ; le greffon est un module ES, chargé
// une fois à l'activation.

/** @param {import('vscode').ExtensionContext} _context */
async function activate(_context) {
  const { markdownItMdLayout } = await import('./mdlayout/adapters/markdown-it-plugin.js');
  return {
    /** @param {any} md - l'instance de markdown-it de l'aperçu */
    extendMarkdownIt(md) {
      return md.use(markdownItMdLayout);
    },
  };
}

function deactivate() {}

module.exports = { activate, deactivate };
