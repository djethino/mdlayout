// ── Media Parser ──────────────────────────────────────────────────────
// Parses media elements with optional hints:
//   - `![alt](url){hints}` → image
//   - `!video(url){hints}` → video
//   - `!audio(url){hints}` → audio
//
// Hints are optional. If absent, the media has an empty HintMap.
// Returns null if the line does not match any media pattern.
//
// Zero dependencies except hint-parser.

import { parseHints } from './hint-parser.js';

/**
 * @typedef {import('../ast/types.js').MediaNode} MediaNode
 */

// ── Patterns ──────────────────────────────────────────────────────────
// Image:  ![alt text](url){hints}
// Video:  !video(url){hints}
// Audio:  !audio(url){hints}
//
// The {hints} part is optional.
// Alt text can be empty for images.
// URL must not be empty.

const IMAGE_RE = /^\s*!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]*)\})?/;
const VIDEO_RE = /^\s*!video\(([^)]+)\)(?:\{([^}]*)\})?/;
const AUDIO_RE = /^\s*!audio\(([^)]+)\)(?:\{([^}]*)\})?/;

/**
 * Parse a media element from a line of text.
 *
 * @param {string} line - A single line of markdown
 * @returns {MediaNode|null} Parsed media node or null if no match
 *
 * @example
 *   parseMedia('![photo](https://example.com/img.jpg){width:half, radius:md}')
 *   // → { type:'media', mediaType:'image', url:'https://...', alt:'photo', hints:{width:'half', radius:'md'} }
 *
 *   parseMedia('!video(https://example.com/vid.mp4){width:full, ratio:16:9}')
 *   // → { type:'media', mediaType:'video', url:'https://...', alt:'', hints:{width:'full', ratio:'16:9'} }
 *
 *   parseMedia('Just regular text')
 *   // → null
 */
export function parseMedia(line) {
  if (!line || typeof line !== 'string') return null;

  const trimmed = line.trim();

  // Try image
  const imgMatch = trimmed.match(IMAGE_RE);
  if (imgMatch) {
    return {
      type: 'media',
      mediaType: 'image',
      alt: imgMatch[1],
      url: imgMatch[2],
      hints: parseHints(imgMatch[3] || ''),
    };
  }

  // Try video
  const vidMatch = trimmed.match(VIDEO_RE);
  if (vidMatch) {
    return {
      type: 'media',
      mediaType: 'video',
      url: vidMatch[1],
      alt: '',
      hints: parseHints(vidMatch[2] || ''),
    };
  }

  // Try audio
  const audMatch = trimmed.match(AUDIO_RE);
  if (audMatch) {
    return {
      type: 'media',
      mediaType: 'audio',
      url: audMatch[1],
      alt: '',
      hints: parseHints(audMatch[2] || ''),
    };
  }

  return null;
}
