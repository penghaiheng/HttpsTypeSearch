import type { ExtensionSettings } from './types.js';

export const DEFAULT_SETTINGS: ExtensionSettings = {
  endpoint: 'https://127.0.0.1:19456',
  token: '',
  maxResults: 20,
  autoSearchOnLoad: false,
  autoFillSingleResult: true,
  allowOverwrite: false,
  fetchSensitiveOnDemand: false,
  nativeUrlKeys: ['hostname', 'host', 'origin', 'path', 'query', 'fullUrl'],
  customUrlRules: [],
  stopOnFirstHit: true
};

export async function getSettings(): Promise<ExtensionSettings> {
  const data = await chrome.storage.sync.get('settings');
  return { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) } as ExtensionSettings;
}

export async function setSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.sync.set({ settings });
}
