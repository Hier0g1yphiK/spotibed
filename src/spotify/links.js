/**
 * Spotify link parsing and embed URL building.
 */

/**
 * Matches open.spotify.com links, with or without an intl locale segment.
 * Matches: https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=...
 *          https://open.spotify.com/intl-de/album/1DFixLWuPkv3KT3TnV35m3
 * Captures: 1 = type (track, album, playlist, ...), 2 = id
 */
const SPOTIFY_LINK_REGEX =
  /https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?([a-z]{4,12})\/([A-Za-z0-9]{14,26})(?=[?#\s>)]|$)/gi;

/** Max links handled per message, to keep replies short and avoid spam. */
export const MAX_LINKS_PER_MESSAGE = 5;

export const DEFAULT_NOTE = '>>> Play sample: \n';

/**
 * Extracts unique Spotify links from a message string.
 * @param {string} content - Message content
 * @returns {Array<{ type: string, id: string, url: string }>} Canonical links (no locale or query string)
 */
export function extractSpotifyLinks(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const seen = new Set();
  const links = [];

  for (const match of content.matchAll(SPOTIFY_LINK_REGEX)) {
    const type = match[1].toLowerCase();
    const id = match[2];
    const url = `https://open.spotify.com/${type}/${id}`;
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ type, id, url });
  }

  return links;
}

/**
 * Builds the URL to post for a Spotify link.
 * With no custom URL this is Spotify's embed player; otherwise the canonical
 * link is appended to the custom URL (e.g. https://playsoju.netlify.app/?s=).
 *
 * @param {{ type: string, id: string, url: string }} link
 * @param {string} [customUrl]
 * @returns {string}
 */
export function toEmbedUrl(link, customUrl = '') {
  if (customUrl) {
    return `${customUrl}${link.url}`;
  }
  return `https://open.spotify.com/embed/${link.type}/${link.id}`;
}

/**
 * Builds the full message body: the note followed by one embed URL per line.
 *
 * @param {Array<{ type: string, id: string, url: string }>} links
 * @param {{ note: string, customUrl: string }} settings
 * @returns {string}
 */
export function buildEmbedMessage(links, { note, customUrl }) {
  const urls = links.slice(0, MAX_LINKS_PER_MESSAGE).map((link) => toEmbedUrl(link, customUrl));
  return `${note}${urls.join('\n')}`.slice(0, 2000);
}
