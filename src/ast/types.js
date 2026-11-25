// ── AST Type Definitions & Factories ──────────────────────────────────
// Pure data structures for mdlayout AST nodes.
// No dependencies, no DOM, no side effects.

/**
 * @typedef {Object.<string, string|boolean>} HintMap
 * A map of hint keys to their values.
 * Boolean `true` represents a flag (key without value).
 * String values represent key:value pairs.
 */

/**
 * @typedef {Object} CanvasNode
 * @property {'canvas'} type
 * @property {HintMap} hints - Canvas-level hints (mode, aspect ratio, etc.)
 * @property {BlockNode[]} children - Child block nodes
 * @property {string} raw - Original raw markdown source
 */

/**
 * @typedef {Object} BlockNode
 * @property {'block'} type
 * @property {string|null} name - Block name (null for anonymous blocks)
 * @property {HintMap} hints - Block hints (width, position, relations, style)
 * @property {string} body - Raw markdown body content
 */

/**
 * @typedef {Object} MediaNode
 * @property {'media'} type
 * @property {'image'|'video'|'audio'} mediaType
 * @property {string} url - Media source URL
 * @property {string} alt - Alt text (images) or label
 * @property {HintMap} hints - Style/layout hints
 */

/**
 * @typedef {Object} InlineStyledNode
 * @property {'inline-styled'} type
 * @property {string} text - Inner text (may contain markdown)
 * @property {HintMap} hints - Style hints (color, size, weight, etc.)
 */

// ── Factory Functions ─────────────────────────────────────────────────

/**
 * Create a CanvasNode.
 * @param {HintMap} hints
 * @param {BlockNode[]} children
 * @param {string} [raw='']
 * @returns {CanvasNode}
 */
export function createCanvas(hints, children, raw = '') {
  return { type: 'canvas', hints, children, raw };
}

/**
 * Create a BlockNode.
 * @param {string|null} name
 * @param {HintMap} hints
 * @param {string} body
 * @returns {BlockNode}
 */
export function createBlock(name, hints, body) {
  return { type: 'block', name, hints, body };
}

/**
 * Create a MediaNode.
 * @param {'image'|'video'|'audio'} mediaType
 * @param {string} url
 * @param {string} alt
 * @param {HintMap} hints
 * @returns {MediaNode}
 */
export function createMedia(mediaType, url, alt, hints) {
  return { type: 'media', mediaType, url, alt, hints };
}

/**
 * Create an InlineStyledNode.
 * @param {string} text
 * @param {HintMap} hints
 * @returns {InlineStyledNode}
 */
export function createInlineStyled(text, hints) {
  return { type: 'inline-styled', text, hints };
}
