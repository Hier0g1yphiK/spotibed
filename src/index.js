/**
 * Entry point: load environment, wire all layers together, and start the bot.
 *
 * Wiring order: config → store → services → commands → registry → bot
 */

import { config } from './utils/config.js';
import { initDatabase, SettingsStore } from './store/settingsStore.js';
import { SpotifyMetadataService } from './spotify/metadata.js';
import { loadCommands, registerCommands, buildHandlerMap } from './registry.js';
import { createBot } from './bot.js';
import { logger } from './utils/logger.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Store layer (SQLite persistence) ---
const db = initDatabase();
const settingsStore = new SettingsStore(db);

// --- Service layer ---
const metadataService = new SpotifyMetadataService();

const services = { settingsStore, metadataService };

// --- Command discovery and registration ---
const commandsDir = join(__dirname, 'commands');
const commands = await loadCommands(commandsDir);

await registerCommands(commands, {
  token: config.discordToken,
  applicationId: config.discordApplicationId,
});

// --- Handler map ---
const handlerMap = buildHandlerMap(commands);

// --- Bot creation and login ---
const client = createBot({ handlerMap, services });

client.once('ready', () => {
  logger.info({ message: `Bot logged in as ${client.user.tag}` });
});

// --- Graceful shutdown (pm2 sends SIGINT on stop/restart) ---
async function shutdown(signal) {
  logger.info({ message: `Received ${signal}, shutting down` });
  await client.destroy();
  settingsStore.close();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

await client.login(config.discordToken);
