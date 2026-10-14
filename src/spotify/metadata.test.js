import { describe, it, expect, vi } from 'vitest';
import { parseMetaTags, metadataFromTags, SpotifyMetadataService } from './metadata.js';

const TRACK_HTML = `
<meta property="og:title" content="STORM II"/>
<meta property="og:description" content="GENER8ION, Yung Lean · STORM · Song · 2026"/>
<meta property="og:audio" content="https://p.scdn.co/mp3-preview/abc"/>
<meta property="og:image" content="https://i.scdn.co/image/xyz"/>
<meta name="music:duration" content="173"/>
<meta name="music:song" content="first"/><meta name="music:song" content="second"/>
`;

const GENERIC_HTML = '<meta property="og:title" content="Spotify - Web Player: Music for everyone"/>';

function response(body, ok = true) {
  return {
    ok,
    text: async () => body,
    json: async () => JSON.parse(body),
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  };
}

describe('parseMetaTags', () => {
  it('reads property and name tags, keeping the first of duplicates', () => {
    const tags = parseMetaTags(TRACK_HTML);
    expect(tags['og:title']).toBe('STORM II');
    expect(tags['music:duration']).toBe('173');
    expect(tags['music:song']).toBe('first');
  });

  it('decodes HTML entities', () => {
    const tags = parseMetaTags('<meta property="og:title" content="Rock &amp; Roll &#x27;Live&#39; &quot;Mix&quot;"/>');
    expect(tags['og:title']).toBe(`Rock & Roll 'Live' "Mix"`);
  });
});

describe('metadataFromTags', () => {
  it('builds track metadata with a preview URL and duration', () => {
    expect(metadataFromTags(parseMetaTags(TRACK_HTML))).toEqual({
      title: 'STORM II',
      description: 'GENER8ION, Yung Lean · STORM · Song · 2026',
      imageUrl: 'https://i.scdn.co/image/xyz',
      previewUrl: 'https://p.scdn.co/mp3-preview/abc',
      durationSeconds: 173,
    });
  });

  it('strips the "| Spotify" suffix from album titles', () => {
    const meta = metadataFromTags({ 'og:title': 'Emotion (Deluxe) - Album by Carly Rae Jepsen | Spotify' });
    expect(meta.title).toBe('Emotion (Deluxe) - Album by Carly Rae Jepsen');
  });

  it('returns null for the generic web player page', () => {
    expect(metadataFromTags(parseMetaTags(GENERIC_HTML))).toBeNull();
    expect(metadataFromTags({})).toBeNull();
  });
});

describe('SpotifyMetadataService', () => {
  const link = { url: 'https://open.spotify.com/track/0FZd4IaxB12sUTKSUUGwWq' };

  it('reads the page and caches the result', async () => {
    const fetchFn = vi.fn().mockResolvedValue(response(TRACK_HTML));
    const service = new SpotifyMetadataService({ fetchFn });

    expect((await service.getMetadata(link)).title).toBe('STORM II');
    await service.getMetadata(link);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('falls back to oEmbed when the page is generic', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(response(GENERIC_HTML))
      .mockResolvedValueOnce(response(JSON.stringify({ title: 'Episode 51', thumbnail_url: 'https://img' })));
    const service = new SpotifyMetadataService({ fetchFn });

    const meta = await service.getMetadata(link);
    expect(meta).toMatchObject({ title: 'Episode 51', imageUrl: 'https://img', previewUrl: null });
    expect(fetchFn.mock.calls[1][0]).toContain('/oembed?url=');
  });

  it('returns null instead of throwing when requests fail', async () => {
    const service = new SpotifyMetadataService({ fetchFn: vi.fn().mockRejectedValue(new Error('timeout')) });
    expect(await service.getMetadata(link)).toBeNull();
    expect(await service.downloadPreview('https://p.scdn.co/x')).toBeNull();
  });

  it('downloads the preview as a buffer', async () => {
    const service = new SpotifyMetadataService({ fetchFn: vi.fn().mockResolvedValue(response('mp3data')) });
    const buffer = await service.downloadPreview('https://p.scdn.co/x');
    expect(buffer.toString()).toBe('mp3data');
  });
});
