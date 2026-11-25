// Les types du greffon markdown-it de mdlayout (`@asymptomatik/mdlayout/markdown-it`).
export interface MarkdownItMdLayoutOptions {
  /** Montrer le nom des blocs (d'office, oui). */
  includeLabels?: boolean;
  blockHeights?: Record<string, number>;
}
/** Le greffon : `new MarkdownIt().use(markdownItMdLayout)`. `md` : l'instance de markdown-it. */
export function markdownItMdLayout(md: unknown, options?: MarkdownItMdLayoutOptions): void;
export default markdownItMdLayout;
