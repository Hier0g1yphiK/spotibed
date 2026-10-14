import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase, SettingsStore, DEFAULT_SETTINGS } from './settingsStore.js';

describe('SettingsStore', () => {
  let store;

  beforeEach(() => {
    store = new SettingsStore(initDatabase(':memory:'));
  });

  it('returns defaults for unknown guilds and DMs', () => {
    expect(store.get('123')).toEqual(DEFAULT_SETTINGS);
    expect(store.get(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('persists each setting independently', () => {
    store.set('123', 'enabled', true);
    store.set('123', 'deleteOriginal', true);
    store.set('123', 'customUrl', 'https://example.com/?s=');

    expect(store.get('123')).toEqual({
      ...DEFAULT_SETTINGS,
      enabled: true,
      deleteOriginal: true,
      customUrl: 'https://example.com/?s=',
    });
    expect(store.get('456')).toEqual(DEFAULT_SETTINGS);
  });

  it('distinguishes an empty note from a reset note', () => {
    store.set('123', 'note', '');
    expect(store.get('123').note).toBe('');

    store.set('123', 'note', null);
    expect(store.get('123').note).toBe(DEFAULT_SETTINGS.note);
  });

  it('rejects unknown keys', () => {
    expect(() => store.set('123', 'bogus', 1)).toThrow();
  });
});
