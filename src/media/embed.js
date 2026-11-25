/**
 * Le lecteur d'un site de vidéos pour une adresse de page (YouTube, Vimeo, Dailymotion), ou `null`.
 * YouTube passe par son domaine sans cookie. Seules les adresses `https:` sont reconnues.
 * @param {string} address
 * @returns {string | null}
 */
export function embedUrl(address) {
  let parsed;
  try {
    parsed = new URL(String(address ?? '').trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.replace(/^www\./, '');
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = parsed.searchParams.get('v');
    return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1);
    return /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === 'vimeo.com') {
    const id = parsed.pathname.split('/').filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (host === 'dailymotion.com') {
    const id = parsed.pathname.match(/^\/video\/(\w+)/)?.[1];
    return id ? `https://www.dailymotion.com/embed/video/${id}` : null;
  }
  return null;
}
