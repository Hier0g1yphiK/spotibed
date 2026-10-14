/**
 * Spotify Link Listener
 * When enabled for a guild, detects Spotify links in messages and reposts them
 * as embed-player links (as the original author, via webhook). Optionally
 * deletes the original message afterwards.
 */

import { extractSpotifyLinks, buildEmbedMessage } from '../spotify/links.js';
import { logger } from '../utils/logger.js';

/**
 * Registers the Spotify link listener on the given Discord client.
 *
 * @param {import('discord.js').Client} client - The Discord client
 * @param {object} options
 * @param {import('../store/settingsStore.js').SettingsStore} options.settingsStore
 * @param {import('../services/webhookSender.js').WebhookSender} options.webhookSender
 */
export function registerSpotifyLinkListener(client, { settingsStore, webhookSender }) {
  client.on('messageCreate', async (message) => {
    // Ignore bots and webhooks (including our own reposts) to prevent loops
    if (message.author.bot || message.webhookId) return;
    if (!message.guildId) return;

    const settings = settingsStore.get(message.guildId);
    if (!settings.enabled) return;

    const links = extractSpotifyLinks(message.content);
    if (links.length === 0) return;

    const content = buildEmbedMessage(links, settings);

    let sentViaWebhook;
    try {
      sentViaWebhook = await webhookSender.sendAsOrFallback(message.channel, content, {
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
      } catch {
        logger.warn({
          event: 'spotify_link_listener',
          message: 'Failed to delete original message — bot may lack Manage Messages permission',
        });
      }
    }
  });
}
