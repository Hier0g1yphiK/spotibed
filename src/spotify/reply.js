/**
 * Builds the message the bot posts for a set of Spotify links: a card per
 * link (title, artist, artwork) plus the 30-second preview MP3 as an
 * attachment, which Discord shows with an inline audio player.
 */

import { EmbedBuilder } from 'discord.js';
import { MAX_LINKS_PER_MESSAGE, toEmbedUrl } from './links.js';

const SPOTIFY_GREEN = 0x1db954;

/**
 * Formats seconds as m:ss.
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
}

/**
 * Builds an embed card from Spotify metadata.
 * @param {{ url: string }} link
 * @param {{ title: string, description: string|null, imageUrl: string|null, durationSeconds: number|null }} meta
 * @returns {EmbedBuilder}
 */
export function buildSpotifyEmbed(link, meta) {
  const embed = new EmbedBuilder()
    .setColor(SPOTIFY_GREEN)
    .setAuthor({ name: 'Spotify' })
    .setTitle(meta.title.slice(0, 256))
    .setURL(link.url);

  if (meta.description) embed.setDescription(meta.description.slice(0, 1000));
  if (meta.imageUrl) embed.setThumbnail(meta.imageUrl);
  if (meta.durationSeconds) embed.setFooter({ text: formatDuration(meta.durationSeconds) });

  return embed;
}

/**
 * Makes a safe attachment filename from a title.
 * @param {string} title
 * @returns {string}
 */
export function previewFilename(title) {
  const slug = title.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 60);
  return `${slug || 'preview'}.mp3`;
}

/**
 * Builds the message payload for Spotify links.
 * Links whose metadata can't be fetched fall back to a plain link in the text.
 *
 * @param {Array<{ type: string, id: string, url: string }>} links
 * @param {{ note: string, customUrl: string }} settings
 * @param {import('./metadata.js').SpotifyMetadataService} metadataService
 * @returns {Promise<{ content?: string, embeds: EmbedBuilder[], files: Array<{ attachment: Buffer, name: string }> }>}
 */
export async function buildSpotifyReply(links, { note, customUrl }, metadataService) {
  const limited = links.slice(0, MAX_LINKS_PER_MESSAGE);
  const embeds = [];
  const files = [];
  const plainLinks = [];

  if (customUrl) {
    // A custom player was chosen — just post links to it
    plainLinks.push(...limited.map((link) => toEmbedUrl(link, customUrl)));
  } else {
    const results = await Promise.all(
      limited.map(async (link) => {
        const meta = await metadataService.getMetadata(link);
        const preview = meta?.previewUrl ? await metadataService.downloadPreview(meta.previewUrl) : null;
        return { link, meta, preview };
      }),
    );

    for (const { link, meta, preview } of results) {
      if (!meta) {
        plainLinks.push(link.url);
        continue;
      }
      embeds.push(buildSpotifyEmbed(link, meta));
      if (preview) files.push({ attachment: preview, name: previewFilename(meta.title) });
    }
  }

  const content = `${note}${plainLinks.join('\n')}`.trimEnd().slice(0, 2000);
  return { content: content || undefined, embeds, files };
}
