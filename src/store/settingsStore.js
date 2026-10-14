/**
 * Settings Store
 * SQLite-backed persistence for per-guild Spotibed settings.
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { DEFAULT_NOTE } from '../spotify/links.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_DB_PATH = join(__dirname, '..', '..', 'data', 'spotibed.db');

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,
  note: DEFAULT_NOTE,
  customUrl: '',
  deleteOriginal: false,
});

/**
 * Initializes the SQLite database and creates tables if they don't exist.
 * @param {string} [dbPath] - Path to the SQLite database file, or ':memory:'
 * @returns {import('better-sqlite3').Database}
 */
export function initDatabase(dbPath = DEFAULT_DB_PATH) {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      custom_url TEXT NOT NULL DEFAULT '',
      delete_original INTEGER NOT NULL DEFAULT 0
    );
  `);

  return db;
}

export class SettingsStore {
  /**
   * @param {import('better-sqlite3').Database} db
   */
  constructor(db) {
    this.db = db;

    this._get = db.prepare(`
      SELECT enabled, note, custom_url, delete_original
      FROM guild_settings WHERE guild_id = ?
    `);

    this._ensure = db.prepare(`
      INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)
    `);

    // Column names can't be bound as parameters, so prepare one update per column
    this._update = {
      enabled: db.prepare('UPDATE guild_settings SET enabled = ? WHERE guild_id = ?'),
      note: db.prepare('UPDATE guild_settings SET note = ? WHERE guild_id = ?'),
      customUrl: db.prepare('UPDATE guild_settings SET custom_url = ? WHERE guild_id = ?'),
      deleteOriginal: db.prepare('UPDATE guild_settings SET delete_original = ? WHERE guild_id = ?'),
    };
  }

  /**
   * Get a guild's settings, falling back to defaults.
   * @param {string|null} guildId - null for DMs
   * @returns {{ enabled: boolean, note: string, customUrl: string, deleteOriginal: boolean }}
   */
  get(guildId) {
    const row = guildId ? this._get.get(guildId) : undefined;
    if (!row) return { ...DEFAULT_SETTINGS };

    return {
      enabled: row.enabled === 1,
      // NULL note means "use default"; empty string means "no note"
      note: row.note ?? DEFAULT_NOTE,
      customUrl: row.custom_url,
      deleteOriginal: row.delete_original === 1,
    };
  }

  /**
   * Set a single setting for a guild.
   * @param {string} guildId
   * @param {'enabled'|'note'|'customUrl'|'deleteOriginal'} key
   * @param {boolean|string|null} value
   */
  set(guildId, key, value) {
    const statement = this._update[key];
    if (!statement) throw new Error(`Unknown setting: ${key}`);

    const stored = typeof value === 'boolean' ? Number(value) : value;
    this.db.transaction(() => {
      this._ensure.run(guildId);
      statement.run(stored, guildId);
    })();
  }

  /**
   * Close the database connection.
   */
  close() {
    this.db.close();
  }
}
