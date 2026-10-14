/**
 * /spotifyembed command handler
 * Posts a Spotify card with a playable 30-second preview for a link on demand.
 */

import { MessageFlags } from 'discord.js';
import { extractSpotifyLinks } from '../spotify/links.js';
import { buildSpotifyReply } from '../spotify/reply.js';

export const command = {
  name: 'spotifyembed',
  description: 'Post a Spotify card with a playable preview for a link',
  options: [
    {
      name: 'link',
      description: 'A Spotify link (track, album, playlist, artist, episode...)',
      type: 3, // STRING
      required: true,
      min_length: 10,
      max_length: 300,
    },
    {
      name: 'as_myself',
      description: 'Post it under your own name and avatar (via webhook)',
      type: 5, // BOOLEAN
      required: false,
    },
  ],
};

/**
 * Executes the /spotifyembed command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {object} deps
 */
export async function execute(interaction, { settingsStore, webhookSender, metadataService }) {
  const input = interaction.options.getString('link');
  const asMyself = interaction.options.getBoolean('as_myself') ?? false;

  const [link] = extractSpotifyLinks(input);
  if (!link) {
    await interaction.reply({
      content: "That doesn't look like a Spotify link. Try something like `https://open.spotify.com/track/...`",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Webhooks only work in guild channels the bot can see
  const useWebhook = asMyself && interaction.inCachedGuild() && interaction.channel;

  // Fetching metadata and the preview can take a moment, so defer first
  await interaction.deferReply(useWebhook ? { flags: MessageFlags.Ephemeral } : {});

  const { customUrl } = settingsStore.get(interaction.guildId);
  // The note is for auto-replies; on-demand posts don't need it
  const reply = await buildSpotifyReply([link], { note: '', customUrl }, metadataService);

  if (!useWebhook) {
    await interaction.editReply(reply);
    return;
  }

  const viaWebhook = await webhookSender.sendAsOrFallback(interaction.channel, reply, {
    member: interaction.member,
    user: interaction.user,
  });

  await interaction.editReply({
    content: viaWebhook
      ? '✅ Sent.'
      : "✅ Sent, but as the bot — I need the **Manage Webhooks** permission to post as you.",
  });
}
