import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerSpotifyLinkListener } from './spotifyLink.js';
import { DEFAULT_SETTINGS } from '../store/settingsStore.js';

describe('registerSpotifyLinkListener', () => {
  let handler;
  let message;
  let settings;
  let webhookSender;

  beforeEach(() => {
    settings = { ...DEFAULT_SETTINGS, enabled: true };
    webhookSender = { sendAsOrFallback: vi.fn().mockResolvedValue(true) };

    const client = { on: vi.fn((event, fn) => { handler = fn; }) };
    registerSpotifyLinkListener(client, {
      settingsStore: { get: vi.fn(() => settings) },
      webhookSender,
    });

    message = {
      author: { bot: false },
      webhookId: null,
      guildId: '1',
      channelId: '2',
      channel: {},
      member: {},
      content: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=x',
      delete: vi.fn().mockResolvedValue(undefined),
      suppressEmbeds: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('reposts the clean link as the author', async () => {
    await handler(message);
    expect(webhookSender.sendAsOrFallback).toHaveBeenCalledWith(
      message.channel,
      `${DEFAULT_SETTINGS.note}https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT`,
      { member: message.member, user: message.author },
    );
    expect(message.delete).not.toHaveBeenCalled();
    expect(message.suppressEmbeds).toHaveBeenCalledWith(true);
  });

  it('still reposts if suppressing the original preview fails', async () => {
    message.suppressEmbeds.mockRejectedValue(new Error('Missing Permissions'));
    await expect(handler(message)).resolves.toBeUndefined();
    expect(webhookSender.sendAsOrFallback).toHaveBeenCalled();
  });

  it('does nothing when disabled', async () => {
    settings.enabled = false;
    await handler(message);
    expect(webhookSender.sendAsOrFallback).not.toHaveBeenCalled();
  });

  it('ignores bots, webhooks, DMs and messages without links', async () => {
    for (const patch of [{ author: { bot: true } }, { webhookId: '9' }, { guildId: null }, { content: 'hi' }]) {
      await handler({ ...message, ...patch });
    }
    expect(webhookSender.sendAsOrFallback).not.toHaveBeenCalled();
  });

  it('deletes the original when enabled and sent via webhook', async () => {
    settings.deleteOriginal = true;
    await handler(message);
    expect(message.delete).toHaveBeenCalled();
  });

  it('keeps the original when the webhook fallback was used', async () => {
    settings.deleteOriginal = true;
    webhookSender.sendAsOrFallback.mockResolvedValue(false);
    await handler(message);
    expect(message.delete).not.toHaveBeenCalled();
  });

  it('survives send failures', async () => {
    webhookSender.sendAsOrFallback.mockRejectedValue(new Error('Missing Access'));
    await expect(handler(message)).resolves.toBeUndefined();
  });
});
