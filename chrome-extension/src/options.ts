import { getEndpointGuidance, validateEndpoint } from './api.js';
import { DEFAULT_SETTINGS, getSettings, setSettings } from './settings.js';

const endpointEl = required<HTMLInputElement>('#endpoint');
const endpointHelpEl = required<HTMLParagraphElement>('#endpointHelp');
const tokenEl = required<HTMLInputElement>('#token');
const limitEl = required<HTMLInputElement>('#limit');
const autoSearchOnLoadEl = required<HTMLInputElement>('#autoSearchOnLoad');
const autoFillSingleResultEl = required<HTMLInputElement>('#autoFillSingleResult');
const allowOverwriteEl = required<HTMLInputElement>('#allowOverwrite');
const fetchSensitiveOnDemandEl = required<HTMLInputElement>('#fetchSensitiveOnDemand');
const termSourceEl = required<HTMLSelectElement>('#termSource');
const matchDefaultUrlEl = required<HTMLInputElement>('#matchDefaultUrl');
const customFieldKeywordsEl = required<HTMLTextAreaElement>('#customFieldKeywords');
const saveBtn = required<HTMLButtonElement>('#saveBtn');
const statusEl = required<HTMLSpanElement>('#status');

void load();

endpointEl.addEventListener('input', () => {
  renderEndpointGuidance(endpointEl.value);
});

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
  termSourceEl.value = settings.termSource;
  matchDefaultUrlEl.checked = settings.matchDefaultUrl;
  customFieldKeywordsEl.value = settings.customFieldKeywords.join('\n');
  renderEndpointGuidance(settings.endpoint);
}

async function save(): Promise<void> {
  try {
    const maxResults = Math.max(1, Math.min(500, Number.parseInt(limitEl.value || String(DEFAULT_SETTINGS.maxResults), 10) || DEFAULT_SETTINGS.maxResults));
    const endpoint = validateEndpoint(endpointEl.value || DEFAULT_SETTINGS.endpoint);

    await setSettings({
      endpoint,
      token: tokenEl.value.trim(),
      maxResults,
      autoSearchOnLoad: autoSearchOnLoadEl.checked,
      autoFillSingleResult: autoFillSingleResultEl.checked,
      allowOverwrite: allowOverwriteEl.checked,
      fetchSensitiveOnDemand: fetchSensitiveOnDemandEl.checked,
      termSource: termSourceEl.value === 'hostnameWithPort' ? 'hostnameWithPort' : 'hostname',
      matchDefaultUrl: matchDefaultUrlEl.checked,
      customFieldKeywords: parseKeywords(customFieldKeywordsEl.value)
    });

    endpointEl.value = endpoint;
    renderEndpointGuidance(endpoint);
    setStatus('Saved. If HTTPS still shows "Failed to fetch", trust the local certificate or switch to http://localhost / http://127.0.0.1.', false);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Save failed.', true);
  }
}

function parseKeywords(raw: string): string[] {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const token of raw.split(/[\n,]/g)) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    values.push(normalized);
  }

  return values;
}

function setStatus(text: string, isError: boolean): void {
  statusEl.textContent = text;
  statusEl.className = isError ? 'status error' : 'status success';
}

function renderEndpointGuidance(endpoint: string): void {
  endpointHelpEl.textContent = getEndpointGuidance(endpoint);
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}
