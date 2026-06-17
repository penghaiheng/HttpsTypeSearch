import { DEFAULT_SETTINGS, getSettings, setSettings } from './settings.js';
import type { CustomUrlRule } from './types.js';

const endpointEl = required<HTMLInputElement>('#endpoint');
const tokenEl = required<HTMLInputElement>('#token');
const limitEl = required<HTMLInputElement>('#limit');
const autoSearchOnLoadEl = required<HTMLInputElement>('#autoSearchOnLoad');
const autoFillSingleResultEl = required<HTMLInputElement>('#autoFillSingleResult');
const allowOverwriteEl = required<HTMLInputElement>('#allowOverwrite');
const fetchSensitiveOnDemandEl = required<HTMLInputElement>('#fetchSensitiveOnDemand');
const nativeKeysEl = required<HTMLInputElement>('#nativeKeys');
const customRulesEl = required<HTMLTextAreaElement>('#customRules');
const saveBtn = required<HTMLButtonElement>('#saveBtn');
const statusEl = required<HTMLSpanElement>('#status');

void load();

saveBtn.addEventListener('click', () => {
  void save();
});

async function load(): Promise<void> {
  const settings = await getSettings();
  endpointEl.value = settings.endpoint;
  tokenEl.value = settings.token;
  limitEl.value = String(settings.maxResults);
  autoSearchOnLoadEl.checked = settings.autoSearchOnLoad;
  autoFillSingleResultEl.checked = settings.autoFillSingleResult;
  allowOverwriteEl.checked = settings.allowOverwrite;
  fetchSensitiveOnDemandEl.checked = settings.fetchSensitiveOnDemand;
  nativeKeysEl.value = settings.nativeUrlKeys.join(',');
  customRulesEl.value = JSON.stringify(settings.customUrlRules, null, 2);
}

async function save(): Promise<void> {
  try {
    const customRules = parseCustomRules(customRulesEl.value);
    const nativeKeys = nativeKeysEl.value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    const maxResults = Math.max(1, Math.min(500, Number.parseInt(limitEl.value || String(DEFAULT_SETTINGS.maxResults), 10) || DEFAULT_SETTINGS.maxResults));

    await setSettings({
      endpoint: endpointEl.value.trim() || DEFAULT_SETTINGS.endpoint,
      token: tokenEl.value.trim(),
      maxResults,
      autoSearchOnLoad: autoSearchOnLoadEl.checked,
      autoFillSingleResult: autoFillSingleResultEl.checked,
      allowOverwrite: allowOverwriteEl.checked,
      fetchSensitiveOnDemand: fetchSensitiveOnDemandEl.checked,
      nativeUrlKeys: nativeKeys as typeof DEFAULT_SETTINGS.nativeUrlKeys,
      customUrlRules: customRules,
      stopOnFirstHit: true
    });

    setStatus('Saved.', false);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Save failed.', true);
  }
}

function parseCustomRules(raw: string): CustomUrlRule[] {
  if (!raw.trim()) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Custom rules must be a JSON array.');
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Rule ${index} must be an object.`);
    }
    const obj = item as Record<string, unknown>;
    const name = String(obj.name ?? '').trim();
    const mode = String(obj.mode ?? '').trim();
    if (!name) throw new Error(`Rule ${index} missing name.`);
    if (!mode) throw new Error(`Rule ${index} missing mode.`);
    return {
      name,
      mode: mode as CustomUrlRule['mode'],
      value: typeof obj.value === 'string' ? obj.value : undefined,
      source: typeof obj.source === 'string' ? obj.source as CustomUrlRule['source'] : undefined,
      pattern: typeof obj.pattern === 'string' ? obj.pattern : undefined,
      flags: typeof obj.flags === 'string' ? obj.flags : undefined,
      group: typeof obj.group === 'number' ? obj.group : undefined
    };
  });
}

function setStatus(text: string, isError: boolean): void {
  statusEl.textContent = text;
  statusEl.style.color = isError ? '#c62828' : '#2e7d32';
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}
