/**
 * /spotibed command handler
 * Server settings for auto-embedding Spotify links. Requires Manage Server.
 *
 * Subcommands:
 *   settings               — Show the current settings
 *   enable / disable       — Toggle auto-replying to Spotify links
 *   deleteoriginal <bool>  — Delete the original message after reposting
 *   note <text>            — Text shown before the links ("reset" / "none")
 *   customurl <url>        — Prefix the Spotify link with a custom player URL ("reset")
 */

import { EmbedBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { DEFAULT_NOTE } from '../spotify/links.js';

const SPOTIFY_GREEN = 0x1db954;

export const command = {
  name: 'spotibed',
  description: 'Configure Spotify link auto-embedding for this server',
  default_member_permissions: String(PermissionFlagsBits.ManageGuild),
  dm_permission: false,
  options: [
    {
      name: 'settings',
      description: 'Show the current settings',
      type: 1, // SUB_COMMAND
      options: [],
    },
    {
      name: 'enable',
      description: 'Automatically reply to Spotify links with a playable preview',
      type: 1, // SUB_COMMAND
      options: [],
    },
    {
      name: 'disable',
      description: 'Stop automatically replying to Spotify links',
      type: 1, // SUB_COMMAND
      options: [],
    },
    {
      name: 'deleteoriginal',
      description: 'Delete the original message after reposting the embed',
      type: 1, // SUB_COMMAND
      options: [
        {
          name: 'value',
          description: 'Whether to delete the original message',
          type: 5, // BOOLEAN
          required: true,
        },
      ],
    },
    {
      name: 'note',
      description: 'Text shown before the links. "reset" restores the default, "none" shows nothing',
      type: 1, // SUB_COMMAND
      options: [
        {
          name: 'text',
          description: 'The note text, "reset", or "none" (use \\n for a new line)',
          type: 3, // STRING
          required: true,
          min_length: 1,
          max_length: 200,
        },
      ],
    },
    {
      name: 'customurl',
      description: 'Use a custom player URL; the Spotify link is appended. "reset" restores the default',
      type: 1, // SUB_COMMAND
      options: [
        {
          name: 'url',
          description: 'e.g. https://playsoju.netlify.app/?s= — or "reset"',
          type: 3, // STRING
          required: true,
          min_length: 1,
          max_length: 200,
        },
      ],
    },
  ],
};

/**
 * Executes the /spotibed command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {object} deps
 */
export async function execute(interaction, { settingsStore }) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: 'This command only works in a server.', flags: MessageFlags.Ephemeral });
    return;
  }

  // default_member_permissions can be overridden by server admins, so double-check
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content: 'You need the **Manage Server** permission to change Spotibed settings.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guildId = interaction.guildId;
  const subcommand = interaction.options.getSubcommand();
  let content;

  switch (subcommand) {
    case 'settings':
      await interaction.reply({
        embeds: [buildSettingsEmbed(settingsStore.get(guildId))],
        flags: MessageFlags.Ephemeral,
      });
      return;

    case 'enable':
      settingsStore.set(guildId, 'enabled', true);
      content = '✅ Spotify links will now get a playable preview.';
      break;

    case 'disable':
      settingsStore.set(guildId, 'enabled', false);
      content = '✅ Spotify auto-embedding is disabled.';
      break;

    case 'deleteoriginal': {
      const value = interaction.options.getBoolean('value');
      settingsStore.set(guildId, 'deleteOriginal', value);
      content = value
        ? '✅ Original messages will be deleted after reposting. (Needs **Manage Messages** and **Manage Webhooks**.)'
        : '✅ Original messages will be kept.';
      break;
    }

    case 'note': {
      const text = interaction.options.getString('text');
      const keyword = text.trim().toLowerCase();
      if (keyword === 'reset') {
        settingsStore.set(guildId, 'note', null);
        content = '✅ Note reset to the default.';
      } else if (keyword === 'none') {
        settingsStore.set(guildId, 'note', '');
        content = '✅ No note will be shown before links.';
      } else {
        // Slash command options can't contain newlines, so allow a literal \n
        const note = text.replaceAll('\\n', '\n');
        settingsStore.set(guildId, 'note', note.endsWith('\n') ? note : `${note}\n`);
        content = '✅ Note updated.';
      }
      break;
    }

    case 'customurl': {
      const url = interaction.options.getString('url').trim();
      if (['reset', 'none'].includes(url.toLowerCase())) {
        settingsStore.set(guildId, 'customUrl', '');
        content = '✅ Using the default Spotify card and preview.';
      } else if (!/^https?:\/\/\S+$/i.test(url)) {
        content = 'The custom URL must start with `http://` or `https://`.';
      } else {
        settingsStore.set(guildId, 'customUrl', url);
        content = `✅ Links will be posted as \`${url}https://open.spotify.com/...\``;
      }
      break;
    }

    default:
      content = 'Unknown subcommand.';
  }

  await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

/**
 * Builds an embed showing a guild's current settings.
 * @param {{ enabled: boolean, note: string, customUrl: string, deleteOriginal: boolean }} settings
 * @returns {EmbedBuilder}
 */
export function buildSettingsEmbed(settings) {
  const note = settings.note === '' ? '*(none)*' : `\`${settings.note.replaceAll('\n', '\\n')}\``;
  const noteLabel = settings.note === DEFAULT_NOTE ? `${note} (default)` : note;

  return new EmbedBuilder()
    .setTitle('Spotibed Settings')
    .setColor(SPOTIFY_GREEN)
    .addFields(
      { name: 'Auto-embed', value: settings.enabled ? 'Enabled' : 'Disabled', inline: true },
      { name: 'Delete original', value: settings.deleteOriginal ? 'Yes' : 'No', inline: true },
      { name: 'Note', value: noteLabel },
      { name: 'Custom URL', value: settings.customUrl ? `\`${settings.customUrl}\`` : '*(default: Spotify card + preview)*' },
    );
}
