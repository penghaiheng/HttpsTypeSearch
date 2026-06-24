import type { ExtensionSettings } from './types.js';

export const DEFAULT_SETTINGS: ExtensionSettings = {
  endpoint: 'https://localhost:19456',
  token: '',
  maxResults: 20,
  autoSearchOnLoad: true,
  autoFillSingleResult: false,
  allowOverwrite: true,
  fetchSensitiveOnDemand: true,
  termSource: 'hostnameWithPort',
  matchDefaultUrl: true,
  customFieldKeywords: ['URL']
};

export async function getSettings(): Promise<ExtensionSettings> {
  const data = await chrome.storage.sync.get('settings');
  const merged = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) } as ExtensionSettings;
  return {
    ...merged,
    termSource: merged.termSource === 'hostnameWithPort' ? 'hostnameWithPort' : 'hostname',
    matchDefaultUrl: Boolean(merged.matchDefaultUrl),
    customFieldKeywords: Array.isArray(merged.customFieldKeywords)
      ? merged.customFieldKeywords.map((value) => String(value ?? '').trim()).filter(Boolean)
      : DEFAULT_SETTINGS.customFieldKeywords
  };
}

export async function setSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.sync.set({ settings });
}
