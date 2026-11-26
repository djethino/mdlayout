// L'aperçu d'un fichier Mermaid seul (`.mmd`, `.mermaid`) : le diagramme enveloppé dans un bloc ```mermaid, pour que
// l'aperçu Markdown de VS Code le dessine avec son Mermaid intégré (rien de plus à embarquer ni à charger).

/** Les fichiers Mermaid. */
export const MERMAID_FILE = /\.(mmd|mermaid)$/i;

/** Le diagramme dans un bloc ```mermaid, dont la barrière est plus longue que toute suite d'accents graves du fichier. */
export function wrapped(text) {
  const longest = Math.max(2, ...(text.match(/`+/g) || []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}mermaid\n${text.replace(/\s+$/, '')}\n${fence}\n`;
}
