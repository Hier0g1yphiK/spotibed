/**
 * /spotifyembed command handler
 * Converts a Spotify link into an embed-player link on demand.
 */

import { MessageFlags } from 'discord.js';
import { extractSpotifyLinks, toEmbedUrl } from '../spotify/links.js';

export const command = {
  name: 'spotifyembed',
  description: 'Post a playable embed preview for a Spotify link',
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
export async function execute(interaction, { settingsStore, webhookSender }) {
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

  const { customUrl } = settingsStore.get(interaction.guildId);
  const url = toEmbedUrl(link, customUrl);

  // Webhooks only work in guild channels the bot can see
  if (!asMyself || !interaction.inCachedGuild() || !interaction.channel) {
    await interaction.reply({ content: url });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const viaWebhook = await webhookSender.sendAsOrFallback(interaction.channel, url, {
    member: interaction.member,
    user: interaction.user,
  });

  await interaction.editReply({
    content: viaWebhook
      ? '✅ Sent.'
      : "✅ Sent, but as the bot — I need the **Manage Webhooks** permission to post as you.",
  });
}
