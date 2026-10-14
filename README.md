# Spotibed

A standalone Discord bot that replies to Spotify links with a link to Spotify's embed player, so people (especially on mobile) can play a preview right inside Discord without a Spotify account.

A standalone port of the [coffee-cogs `spotifyembed`](https://github.com/coffeebank/coffee-cogs/tree/master/spotifyembed) Red-DiscordBot cog. It doesn't need Red.

## Features

- **Auto-embed Spotify links.** When enabled for a server, any `open.spotify.com` link (track, album, playlist, artist, episode, show, including `/intl-xx/` links) is reposted as an embed-player link. The repost uses the original author's name and avatar via a webhook.
- `/spotifyembed <link> [as_myself]`: convert a single link on demand. With `as_myself: true`, the bot posts it under your name.
- `/spotibed ...`: server settings (needs **Manage Server**):
  - `settings`: show the current settings
  - `enable` / `disable`: turn auto-embedding on or off (off by default)
  - `deleteoriginal <true|false>`: delete the original message after reposting
  - `note <text>`: text shown before the links. Default `>>> Play sample:`. Use `reset` for the default, `none` for no text, and `\n` for a new line.
  - `customurl <url>`: post `<url><spotify link>` instead of the embed player, e.g. `https://playsoju.netlify.app/?s=`. Use `reset` for the default.

Settings are stored per server in SQLite at `data/spotibed.db`. The file is created automatically and is gitignored.

## Prerequisites

- Node.js 20+ (and build tools for `better-sqlite3` if no prebuilt binary is available: `sudo apt install build-essential python3`)
- A [Discord application](https://discord.com/developers/applications) with a bot token
- **Message Content Intent** enabled under *Bot → Privileged Gateway Intents*

### Bot permissions

When inviting the bot (OAuth2 → URL Generator, scopes `bot` + `applications.commands`), grant:

| Permission | Why |
|------------|-----|
| View Channels, Send Messages | Reading links and replying |
| Manage Webhooks | Posting as the original author (falls back to a normal bot message without it) |
| Manage Messages | Only needed for `deleteoriginal` |

## Setup

```bash
git clone <repo-url> spotibed
cd spotibed
npm install
cp .env.example .env
# Edit .env with your token and application ID
```

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Discord bot token |
| `DISCORD_APPLICATION_ID` | Discord application ID (for command registration) |

## Running with pm2

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

Useful commands: `pm2 logs spotibed`, `pm2 restart spotibed`, `pm2 stop spotibed`.

To update: `git pull && npm install && pm2 restart spotibed`.

You can also run it in the foreground with `npm start`.

Slash commands are registered globally on startup. New or changed commands can take a few minutes to appear in Discord.

## Testing

```bash
npm test
```

## Architecture

```
src/
├── index.js               # Entry point: wires layers, logs in, handles shutdown
├── bot.js                 # Discord client, interaction dispatch, error boundary
├── registry.js            # Command discovery, validation, registration
├── commands/
│   ├── spotifyembed.js    # /spotifyembed: convert a link on demand
│   └── spotibed.js        # /spotibed: server settings
├── listeners/
│   └── spotifyLink.js     # Auto-embed Spotify links in messages
├── services/
│   └── webhookSender.js   # Post as a user via a cached bot-owned webhook
├── spotify/
│   └── links.js           # Link parsing and embed URL building
├── store/
│   └── settingsStore.js   # SQLite-backed per-guild settings
└── utils/                 # Config, logger
```

## License

ISC
