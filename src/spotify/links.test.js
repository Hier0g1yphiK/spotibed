import { describe, it, expect } from 'vitest';
import { extractSpotifyLinks, toEmbedUrl } from './links.js';

const TRACK = 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT';

describe('extractSpotifyLinks', () => {
  it('extracts a track link', () => {
    expect(extractSpotifyLinks(`listen ${TRACK}`)).toEqual([
      { type: 'track', id: '4cOdK2wGLETKBW3PvgPWqT', url: TRACK },
    ]);
  });

  it('strips query strings', () => {
    expect(extractSpotifyLinks(`${TRACK}?si=abc123`)[0].url).toBe(TRACK);
  });

  it('strips intl locale segments', () => {
    const links = extractSpotifyLinks('https://open.spotify.com/intl-de/album/1DFixLWuPkv3KT3TnV35m3');
    expect(links[0].url).toBe('https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3');
  });

  it('handles playlists, artists, episodes and shows', () => {
    const content = [
      'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
      'https://open.spotify.com/artist/0OdUWJ0sBjDrqHygGUXeCF',
      'https://open.spotify.com/episode/512ojhOuo1ktJprKbVcKyQ',
      'https://open.spotify.com/show/2MAi0BvDc6GTFvKFPXnkCL',
    ].join(' ');
    expect(extractSpotifyLinks(content).map((l) => l.type)).toEqual(['playlist', 'artist', 'episode', 'show']);
  });

  it('handles links wrapped in <> to suppress previews', () => {
    expect(extractSpotifyLinks(`<${TRACK}>`)).toHaveLength(1);
  });

  it('deduplicates repeated links', () => {
    expect(extractSpotifyLinks(`${TRACK} ${TRACK}?si=x`)).toHaveLength(1);
  });

  it('ignores existing embed links and non-Spotify URLs', () => {
    expect(extractSpotifyLinks('https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT')).toEqual([]);
    expect(extractSpotifyLinks('https://example.com/track/4cOdK2wGLETKBW3PvgPWqT')).toEqual([]);
  });

  it('returns empty array for empty or non-string input', () => {
    expect(extractSpotifyLinks('')).toEqual([]);
    expect(extractSpotifyLinks(null)).toEqual([]);
    expect(extractSpotifyLinks(123)).toEqual([]);
  });
});

describe('toEmbedUrl', () => {
  const [link] = extractSpotifyLinks(TRACK);

  it('posts the clean canonical link by default', () => {
    expect(toEmbedUrl(link)).toBe(TRACK);
  });

  it('prefixes the canonical link with a custom URL', () => {
    expect(toEmbedUrl(link, 'https://playsoju.netlify.app/?s=')).toBe(`https://playsoju.netlify.app/?s=${TRACK}`);
  });
});
