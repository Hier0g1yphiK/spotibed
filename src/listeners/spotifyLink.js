/**
 * Spotify Link Listener
 * When enabled for a guild, detects Spotify links in messages and reposts them
 * as Spotify cards with a playable 30-second preview (as the original author,
 * via webhook). Optionally deletes the original message afterwards.
 */

import { extractSpotifyLinks } from '../spotify/links.js';
import { buildSpotifyReply } from '../spotify/reply.js';
import { logger } from '../utils/logger.js';

/**
 * Registers the Spotify link listener on the given Discord client.
 *
 * @param {import('discord.js').Client} client - The Discord client
 * @param {object} options
 * @param {import('../store/settingsStore.js').SettingsStore} options.settingsStore
 * @param {import('../services/webhookSender.js').WebhookSender} options.webhookSender
 * @param {import('../spotify/metadata.js').SpotifyMetadataService} options.metadataService
 */
export function registerSpotifyLinkListener(client, { settingsStore, webhookSender, metadataService }) {
  client.on('messageCreate', async (message) => {
    // Ignore bots and webhooks (including our own reposts) to prevent loops
    if (message.author.bot || message.webhookId) return;
    if (!message.guildId) return;

    const settings = settingsStore.get(message.guildId);
    if (!settings.enabled) return;

    const links = extractSpotifyLinks(message.content);
    if (links.length === 0) return;

    let sentViaWebhook;
    try {
      const reply = await buildSpotifyReply(links, settings, metadataService);
      sentViaWebhook = await webhookSender.sendAsOrFallback(message.channel, reply, {
        member: message.member,
        user: message.author,
      });
    } catch (error) {
      logger.error({
        command: 'spotify_link_listener',
        input: message.channelId,
        error,
      });
      return;
    }

    // Only delete when the repost carries the author's name, so it's clear who shared it
    if (settings.deleteOriginal && sentViaWebhook) {
      try {
        await message.delete();
        return;
      } catch {
        logger.warn({
          event: 'spotify_link_listener',
          message: 'Failed to delete original message — bot may lack Manage Messages permission',
        });
      }
    }

    // Hide the original's preview so the player doesn't show twice
    try {
      await message.suppressEmbeds(true);
    } catch {
      logger.warn({
        event: 'spotify_link_listener',
        message: 'Failed to suppress embeds — bot may lack Manage Messages permission',
      });
    }
  });
}
