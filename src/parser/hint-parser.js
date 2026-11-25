// ── Hint Parser ───────────────────────────────────────────────────────
// Parses hint strings like `{width:half, color:red, underline}` into
// a flat key-value map (HintMap).
//
// Supports:
//   - Key:value pairs: `width:half`, `color:#ff0`
//   - Quoted values: `font:"Fira Code"` or `font:'Fira Code'`
//   - Flags (boolean): `underline`, `responsive`
//   - Shortcuts: `half` → `width:half`, `center` → `position:center`
//   - Separators: comma and/or whitespace
//
// Zero dependencies. Pure JS.

/** @typedef {import('../ast/types.js').HintMap} HintMap */

/**
 * Default shortcut mappings.
 * A bare keyword is expanded to a key:value pair.
 * @type {Object.<string, {key: string, value: string}>}
 */
const DEFAULT_SHORTCUTS = {
  // Width shortcuts
  full:       { key: 'width', value: 'full' },
  'two-thirds': { key: 'width', value: 'two-thirds' },
  half:       { key: 'width', value: 'half' },
  third:      { key: 'width', value: 'third' },
  quarter:    { key: 'width', value: 'quarter' },
  wide:       { key: 'width', value: 'wide' },
  narrow:     { key: 'width', value: 'narrow' },
  small:      { key: 'width', value: 'small' },
  large:      { key: 'width', value: 'large' },

  // Position shortcuts
  top:        { key: 'position', value: 'top' },
  bottom:     { key: 'position', value: 'bottom' },
  left:       { key: 'position', value: 'left' },
  right:      { key: 'position', value: 'right' },
  center:     { key: 'position', value: 'center' },

  // Mode shortcuts
  responsive: { key: 'mode', value: 'responsive' },
  fixed:      { key: 'mode', value: 'fixed' },

  // Flag shortcuts (expand to key:true)
  underline:  { key: 'underline', value: 'true' },
  flow:       { key: 'flow', value: 'true' },
  scale:      { key: 'scale', value: 'true' },
  clip:       { key: 'clip', value: 'true' },
  scroll:     { key: 'scroll', value: 'true' },
  fit:        { key: 'fit', value: 'true' },
};

/**
 * Parse a hint string into a HintMap.
 *
 * @param {string} str - The hint string (with or without surrounding braces)
 * @param {Object.<string, {key: string, value: string}>} [shortcuts] - Custom shortcut map (merged with defaults)
 * @returns {HintMap}
 *
 * @example
 *   parseHints('width:half, color:red, underline')
 *   // → { width: 'half', color: 'red', underline: true }
 *
 *   parseHints('half')
 *   // → { width: 'half' }
 *
 *   parseHints('font:"Fira Code", size:xl')
 *   // → { font: 'Fira Code', size: 'xl' }
 *
 *   parseHints("font:'Fira Code', size:xl")
 *   // → { font: 'Fira Code', size: 'xl' }
 */
export function parseHints(str, shortcuts) {
  if (!str || typeof str !== 'string') return {};

  const allShortcuts = shortcuts
    ? { ...DEFAULT_SHORTCUTS, ...shortcuts }
    : DEFAULT_SHORTCUTS;

  // Strip surrounding braces if present
  let input = str.trim();
  if (input.startsWith('{') && input.endsWith('}')) {
    input = input.slice(1, -1).trim();
  }

  if (!input) return {};

  const tokens = _tokenize(input);
  /** @type {HintMap} */
  const result = {};

  // Relation keywords whose value is a block name (or quoted multi-word value).
  const RELATION_KEYS = new Set(['below', 'above', 'beside', 'right-of', 'left-of', 'overlay']);

  for (let t = 0; t < tokens.length; t++) {
    const token = tokens[t];

    // Key:value pair (e.g. `width:half`, `below:"blockA blockB"`)
    const colonIdx = token.indexOf(':');
    if (colonIdx > 0) {
      const key = token.slice(0, colonIdx).trim();
      let value = token.slice(colonIdx + 1).trim();

      // Strip quotes from value (double or single)
      if (value.length >= 2 &&
          ((value[0] === '"' && value[value.length - 1] === '"') ||
           (value[0] === "'" && value[value.length - 1] === "'"))) {
        value = value.slice(1, -1);
      }

      if (key && value) {
        result[key] = value;
      }
      continue;
    }

    // Bare relation keyword without colon (e.g. `beside hero` as two tokens).
    // The next token is the value.
    if (RELATION_KEYS.has(token.toLowerCase()) && t + 1 < tokens.length) {
      const nextToken = tokens[t + 1];
      // Only consume next token if it is NOT itself a key:value or a known shortcut/relation
      const nextColonIdx = nextToken.indexOf(':');
      const isNextKeyValue = nextColonIdx > 0;
      const isNextRelation = RELATION_KEYS.has(nextToken.toLowerCase());
      const isNextShortcut = !!(allShortcuts[nextToken.toLowerCase()]);

      if (!isNextKeyValue && !isNextRelation && !isNextShortcut) {
        let value = nextToken;
        // Strip quotes (double or single)
        if (value.length >= 2 &&
            ((value[0] === '"' && value[value.length - 1] === '"') ||
             (value[0] === "'" && value[value.length - 1] === "'"))) {
          value = value.slice(1, -1);
        }
        result[token.toLowerCase()] = value;
        t++; // skip consumed token
        continue;
      }
    }

    // Check shortcuts
    const lc = token.toLowerCase();
    const shortcut = allShortcuts[lc];
    if (shortcut) {
      result[shortcut.key] = shortcut.value === 'true' ? true : shortcut.value;
      continue;
    }

    // Bare word = boolean flag
    if (token) {
      result[token] = true;
    }
  }

  return result;
}

/**
 * Tokenize a hint string respecting quoted values.
 * Separators: comma and whitespace (outside quotes).
 *
 * @param {string} input - Hint string without braces
 * @returns {string[]} Array of tokens
 */
function _tokenize(input) {
  const tokens = [];
  let current = '';
  let inQuotes = false;
  /** @type {string|null} The quote character that opened the current quoted section */
  let quoteChar = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    // Support both double and single quotes for values: {font:"Fira Code"}
    // and {font:'Fira Code'} are equivalent.
    if ((ch === '"' || ch === "'") && (!inQuotes || ch === quoteChar)) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = ch;
      } else {
        inQuotes = false;
        quoteChar = null;
      }
      current += ch;
      continue;
    }

    if (!inQuotes && (ch === ',' || ch === ' ' || ch === '\t')) {
      const trimmed = current.trim();
      if (trimmed) tokens.push(trimmed);
      current = '';
      continue;
    }

    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed) tokens.push(trimmed);

  return tokens;
}
