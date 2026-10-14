/**
 * Spotify Metadata Service
 * Reads title, description, artwork and the 30-second preview MP3 from a
 * Spotify page's Open Graph tags, falling back to Spotify's oEmbed endpoint.
 * Results are cached in memory so repeated links don't refetch.
 */

import { logger } from '../utils/logger.js';

const USER_AGENT = 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)';
const REQUEST_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const MAX_PREVIEW_BYTES = 5 * 1024 * 1024;

/** Title Spotify serves when a page can't be rendered for crawlers. */
const GENERIC_TITLE = /^Spotify\s*[-–]\s*Web Player/i;

const META_TAG_REGEX = /<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"/gi;

/**
 * Decodes the HTML entities Spotify uses in meta content.
 * @param {string} value
 * @returns {string}
 */
function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

/**
 * Extracts meta tags from HTML. First occurrence of each key wins.
 * @param {string} html
 * @returns {Record<string, string>}
 */
export function parseMetaTags(html) {
  const tags = {};
  for (const [, key, content] of html.matchAll(META_TAG_REGEX)) {
    if (!(key in tags)) tags[key] = decodeEntities(content);
  }
  return tags;
}

/**
 * Converts parsed meta tags into metadata, or null if the page was generic.
 * @param {Record<string, string>} tags
 * @returns {{ title: string, description: string|null, imageUrl: string|null, previewUrl: string|null, durationSeconds: number|null }|null}
 */
export function metadataFromTags(tags) {
  const title = tags['og:title'];
  if (!title || GENERIC_TITLE.test(title)) return null;

  const duration = Number(tags['music:duration']);
  return {
    // Album titles look like "Emotion (Deluxe) - Album by Carly Rae Jepsen | Spotify"
    title: title.replace(/\s*\|\s*Spotify$/, ''),
    description: tags['og:description'] || null,
    imageUrl: tags['og:image'] || null,
    previewUrl: tags['og:audio'] || null,
    durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : null,
  };
}

export class SpotifyMetadataService {
  /**
   * @param {object} [options]
   * @param {typeof fetch} [options.fetchFn] - Injected for tests
   */
  constructor({ fetchFn = fetch } = {}) {
    this.fetchFn = fetchFn;
    /** @type {Map<string, { expires: number, value: object|null }>} */
    this.cache = new Map();
  }

  /**
   * Gets metadata for a canonical Spotify link. Never throws; returns null on failure.
   * @param {{ url: string }} link
   */
  async getMetadata(link) {
    const cached = this.cache.get(link.url);
    if (cached && cached.expires > Date.now()) return cached.value;

    let value = null;
    try {
      value = (await this.fromPage(link.url)) ?? (await this.fromOembed(link.url));
    } catch (error) {
      logger.warn({ event: 'spotify_metadata', url: link.url, error: error.message });
    }

    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(link.url, { expires: Date.now() + CACHE_TTL_MS, value });
    return value;
  }

  async fromPage(url) {
    const response = await this.fetchFn(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return metadataFromTags(parseMetaTags(await response.text()));
  }

  async fromOembed(url) {
    const response = await this.fetchFn(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.title) return null;
    return {
      title: data.title,
      description: null,
      imageUrl: data.thumbnail_url || null,
      previewUrl: null,
      durationSeconds: null,
    };
  }

  /**
   * Downloads a preview MP3. Returns null on failure or if it's unexpectedly large.
   * @param {string} previewUrl
   * @returns {Promise<Buffer|null>}
   */
  async downloadPreview(previewUrl) {
    try {
      const response = await this.fetchFn(previewUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      return buffer.length > 0 && buffer.length <= MAX_PREVIEW_BYTES ? buffer : null;
    } catch (error) {
      logger.warn({ event: 'spotify_preview_download', url: previewUrl, error: error.message });
      return null;
    }
  }
}
