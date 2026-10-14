import { describe, it, expect, vi } from 'vitest';
import { buildSpotifyReply, formatDuration, previewFilename } from './reply.js';
import { extractSpotifyLinks, MAX_LINKS_PER_MESSAGE, DEFAULT_NOTE } from './links.js';

const TRACK = 'https://open.spotify.com/track/0FZd4IaxB12sUTKSUUGwWq';
const ALBUM = 'https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3';

const TRACK_META = {
  title: 'STORM II',
  description: 'GENER8ION, Yung Lean · STORM · Song · 2026',
  imageUrl: 'https://i.scdn.co/image/xyz',
  previewUrl: 'https://p.scdn.co/mp3-preview/abc',
  durationSeconds: 173,
};

function mockService(metaByUrl) {
  return {
    getMetadata: vi.fn(async (link) => metaByUrl[link.url] ?? null),
    downloadPreview: vi.fn(async () => Buffer.from('mp3')),
  };
}

describe('formatDuration', () => {
  it('formats m:ss', () => {
    expect(formatDuration(173)).toBe('2:53');
    expect(formatDuration(65)).toBe('1:05');
  });
});

describe('previewFilename', () => {
  it('makes a safe .mp3 name', () => {
    expect(previewFilename('STORM II')).toBe('STORM_II.mp3');
    expect(previewFilename('Beyoncé / "Live" ?')).toBe('Beyoncé_Live.mp3');
    expect(previewFilename('???')).toBe('preview.mp3');
  });
});

describe('buildSpotifyReply', () => {
  const settings = { note: DEFAULT_NOTE, customUrl: '' };

  it('builds a card and attaches the preview MP3 for tracks', async () => {
    const service = mockService({ [TRACK]: TRACK_META });
    const reply = await buildSpotifyReply(extractSpotifyLinks(TRACK), settings, service);

    expect(reply.content).toBe('>>> Play sample:');
    expect(reply.embeds).toHaveLength(1);
    expect(reply.embeds[0].toJSON()).toMatchObject({
      title: 'STORM II',
      url: TRACK,
      description: TRACK_META.description,
      thumbnail: { url: TRACK_META.imageUrl },
      footer: { text: '2:53' },
    });
    expect(reply.files).toEqual([{ attachment: Buffer.from('mp3'), name: 'STORM_II.mp3' }]);
    expect(service.downloadPreview).toHaveBeenCalledWith(TRACK_META.previewUrl);
  });

  it('builds a card without a file when there is no preview', async () => {
    const service = mockService({ [ALBUM]: { ...TRACK_META, title: 'Emotion', previewUrl: null, durationSeconds: null } });
    const reply = await buildSpotifyReply(extractSpotifyLinks(ALBUM), settings, service);

    expect(reply.embeds).toHaveLength(1);
    expect(reply.files).toEqual([]);
    expect(service.downloadPreview).not.toHaveBeenCalled();
  });

  it('falls back to the plain link when metadata is unavailable', async () => {
    const reply = await buildSpotifyReply(extractSpotifyLinks(`${TRACK} ${ALBUM}`), settings, mockService({ [TRACK]: TRACK_META }));
    expect(reply.content).toBe(`${DEFAULT_NOTE}${ALBUM}`);
    expect(reply.embeds).toHaveLength(1);
  });

  it('posts custom player links without fetching metadata', async () => {
    const service = mockService({});
    const reply = await buildSpotifyReply(extractSpotifyLinks(TRACK), { note: '', customUrl: 'https://x/?s=' }, service);

    expect(reply).toEqual({ content: `https://x/?s=${TRACK}`, embeds: [], files: [] });
    expect(service.getMetadata).not.toHaveBeenCalled();
  });

  it('omits content when there is no note and every link has a card', async () => {
    const reply = await buildSpotifyReply(extractSpotifyLinks(TRACK), { note: '', customUrl: '' }, mockService({ [TRACK]: TRACK_META }));
    expect(reply.content).toBeUndefined();
  });

  it('limits the number of links', async () => {
    const content = Array.from({ length: 8 }, (_, i) => `https://open.spotify.com/track/AAAAAAAAAAAAAAAAAAAAA${i}`).join(' ');
    const service = mockService({});
    await buildSpotifyReply(extractSpotifyLinks(content), settings, service);
    expect(service.getMetadata).toHaveBeenCalledTimes(MAX_LINKS_PER_MESSAGE);
  });
});
