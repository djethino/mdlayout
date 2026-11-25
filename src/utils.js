// ── Shared Utilities ──────────────────────────────────────────────────
// Common helpers used across mdlayout modules.
// Zero dependencies.

/**
 * Parse a relation value into an array of block names.
 * Handles both space-separated strings and boolean flags.
 *
 * @param {string|boolean|undefined} value - Relation hint value
 * @returns {string[]} Array of referenced block names
 *
 * @example
 *   _parseRefs('hero sidebar')  // → ['hero', 'sidebar']
 *   _parseRefs(true)            // → []
 *   _parseRefs(undefined)       // → []
 */
export function parseRefs(value) {
  if (!value || value === true) return [];
  return value.toString().split(/\s+/).filter(Boolean);
}
