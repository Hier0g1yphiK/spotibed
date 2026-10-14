/**
 * Webhook Sender
 * Posts messages that look like they came from a guild member, by sending
 * through a bot-owned webhook with the member's name and avatar.
 * Webhooks are cached per channel so we only fetch/create them once.
 */

import { logger } from '../utils/logger.js';

const WEBHOOK_NAME = 'Spotibed';

export class WebhookSender {
  /**
   * @param {import('discord.js').Client} client
   */
  constructor(client) {
    this.client = client;
    /** @type {Map<string, import('discord.js').Webhook>} channelId → webhook */
    this.cache = new Map();
  }

  /**
   * Finds or creates a bot-owned webhook for a channel.
   * Threads don't own webhooks, so the parent channel's webhook is used.
   *
   * @param {import('discord.js').GuildTextBasedChannel} channel
   * @returns {Promise<import('discord.js').Webhook>}
   */
  async getWebhook(channel) {
    const hookChannel = channel.isThread() ? channel.parent : channel;
    if (!hookChannel || typeof hookChannel.fetchWebhooks !== 'function') {
      throw new Error('Channel does not support webhooks');
    }

    const cached = this.cache.get(hookChannel.id);
    if (cached) return cached;

    const hooks = await hookChannel.fetchWebhooks();
    let webhook = hooks.find((wh) => wh.owner?.id === this.client.user.id && wh.token);

    if (!webhook) {
      webhook = await hookChannel.createWebhook({ name: WEBHOOK_NAME });
    }

    this.cache.set(hookChannel.id, webhook);
    return webhook;
  }

  /**
   * Sends content into a channel as the given member/user.
   * Throws if the webhook can't be used (e.g. missing Manage Webhooks).
   *
   * @param {import('discord.js').GuildTextBasedChannel} channel
   * @param {string} content
   * @param {{ member?: import('discord.js').GuildMember|null, user: import('discord.js').User }} as
   */
  async sendAs(channel, content, { member, user }) {
    const webhook = await this.getWebhook(channel);

    try {
      await webhook.send({
        content,
        username: member?.displayName ?? user.displayName ?? user.username,
        avatarURL: member?.displayAvatarURL() ?? user.displayAvatarURL(),
        threadId: channel.isThread() ? channel.id : undefined,
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      // The webhook may have been deleted by an admin — forget it so the next call recreates it
      this.cache.delete(webhook.channelId);
      throw error;
    }
  }

  /**
   * Sends as the user via webhook, falling back to a normal bot message.
   *
   * @returns {Promise<boolean>} True if sent via webhook, false if the fallback was used
   */
  async sendAsOrFallback(channel, content, as) {
    try {
      await this.sendAs(channel, content, as);
      return true;
    } catch (error) {
      logger.warn({
        event: 'webhook_send_failed',
        channelId: channel.id,
        message: 'Falling back to a normal message — bot may lack Manage Webhooks permission',
        error: error.message,
      });
      await channel.send({ content, allowedMentions: { parse: [] } });
      return false;
    }
  }
}
