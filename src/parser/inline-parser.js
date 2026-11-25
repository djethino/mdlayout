// ── Inline Styled Parser ──────────────────────────────────────────────
// Parses `[text]{hints}` inline styled spans within markdown text.
//
// IMPORTANT: Must NOT confuse with links `[text](url)`.
// The difference: `{` after `]` = styled span, `(` after `]` = link.
//
// Supports:
//   - `[bold text]{color:red}` → inline styled
//   - `[text **with markdown**]{size:xl}` → body contains markdown
//   - Multiple occurrences in one string
//   - Nested brackets within the text content
//
// Zero dependencies except hint-parser.

import { parseHints } from './hint-parser.js';

/**
 * @typedef {import('../ast/types.js').InlineStyledNode} InlineStyledNode
 */

/**
 * Parse inline styled spans from a text string.
 *
 * Uses a character-by-character parser to handle nested brackets correctly
 * (e.g. `[text with [nested] brackets]{hints}`).
 *
 * Returns an array of found InlineStyledNodes and a processed string
 * where each `[text]{hints}` is replaced by a placeholder
 * `<!--mdl-inline-N-->` for later rendering.
 *
 * @param {string} text - Source text (a paragraph or line)
 * @returns {{ nodes: InlineStyledNode[], processed: string }}
 *
 * @example
 *   const result = parseInlineStyled('Hello [world]{color:red, size:xl} end');
 *   // result.nodes = [{ type:'inline-styled', text:'world', hints:{color:'red', size:'xl'} }]
 *   // result.processed = 'Hello <!--mdl-inline-0--> end'
 *
 *   // Nested brackets:
 *   const r2 = parseInlineStyled('[text [with] nested]{size:lg}');
 *   // r2.nodes[0].text === 'text [with] nested'
 */
export function parseInlineStyled(text) {
  if (!text || typeof text !== 'string') {
    return { nodes: [], processed: text || '' };
  }

  /** @type {InlineStyledNode[]} */
  const nodes = [];
  let processed = '';
  let nodeIdx = 0;
  let i = 0;

  while (i < text.length) {
    // Look for opening bracket
    if (text[i] === '[') {
      const result = _matchBracketedHint(text, i);
      if (result) {
        const node = {
          type: 'inline-styled',
          text: result.innerText,
          hints: parseHints(result.hintsStr),
        };
        nodes.push(node);
        processed += `<!--mdl-inline-${nodeIdx}-->`;
        nodeIdx++;
        i = result.end;
        continue;
      }
    }

    processed += text[i];
    i++;
  }

  return { nodes, processed };
}

/**
 * Match a `[text]{hints}` span starting at position `start` in the source,
 * handling nested brackets inside the text portion.
 *
 * @param {string} src - Full source text
 * @param {number} start - Index of the opening `[`
 * @returns {{ innerText: string, hintsStr: string, end: number }|null}
 *   Returns null if no valid match, otherwise the parsed parts and
 *   the index past the closing `}`.
 */
function _matchBracketedHint(src, start) {
  let depth = 0;
  let i = start;

  // Walk through brackets counting depth
  for (; i < src.length; i++) {
    if (src[i] === '[') {
      depth++;
    } else if (src[i] === ']') {
      depth--;
      if (depth === 0) break;
    }
  }

  // No matching close bracket found
  if (depth !== 0 || i >= src.length) return null;

  const closeBracketIdx = i;

  // Must be followed immediately by `{`
  if (closeBracketIdx + 1 >= src.length || src[closeBracketIdx + 1] !== '{') {
    return null;
  }

  // Find the matching `}`
  const hintStart = closeBracketIdx + 2;
  const hintEnd = src.indexOf('}', hintStart);
  if (hintEnd === -1) return null;

  const innerText = src.slice(start + 1, closeBracketIdx);
  const hintsStr = src.slice(hintStart, hintEnd);

  // Must have non-empty inner text
  if (!innerText) return null;

  return { innerText, hintsStr, end: hintEnd + 1 };
}
