interface FieldInteractionResponse {
  ok?: boolean;
  state?: { results?: ContentSearchItem[] };
}

interface ContentSearchItem {
  Title?: string;
  UserName?: string;
  Password?: string;
  OtpCurrent?: string;
  CustomFields?: Record<string, unknown>;
}

type FillableElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement;
const NEGATIVE_USERNAME_TERMS = new Set(['code', 'context', 'search', 'select', 'query', 'comment', 'message', 'note', 'content']);
const TEXT_LIKE_INPUT_SELECTOR = 'input:not([type]),input[type="text"],input[type="email"],input[type="tel"],input[type="number"],textarea';
// Typical login forms are compact: one identifier field plus password.
const MAX_LOGIN_FORM_TEXT_INPUTS = 2;

const INTERACTION_DEBOUNCE_MS = 180;
const INTERACTION_SUPPRESS_MS = 600;

let pendingInteractionTimer: number | undefined;
let lastActivatedElement: FillableElement | null = null;
let lastActivatedAt = 0;
let suppressInteractionUntil = 0;

let currentDropdown: HTMLElement | null = null;
let dropdownAnchor: FillableElement | null = null;
let currentDropdownItems: ContentSearchItem[] = [];

let inlineSuggestionsEnabled = true;
let lastResults: ContentSearchItem[] = [];

// Load persisted toggle state from extension storage
chrome.storage.local.get('inlineSuggestionsEnabled').then((result: Record<string, unknown>) => {
  if (typeof result['inlineSuggestionsEnabled'] === 'boolean') {
    inlineSuggestionsEnabled = result['inlineSuggestionsEnabled'] as boolean;
  }
}).catch(() => {});

chrome.runtime.sendMessage({ type: 'PAGE_LOADED', url: window.location.href }).catch(() => {
  // ignore
});

bindAutomaticDetection();
bindDropdownDismissal();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'AUTOFILL_ENTRY') return;

  const item = message.item as ContentSearchItem;
  const allowOverwrite = Boolean(message.allowOverwrite);
  const filled = autofill(item, allowOverwrite);
  sendResponse({ ok: true, filled });
  return true;
});

function autofill(item: ContentSearchItem, allowOverwrite: boolean): number {
  const candidates = collectFillableElements();

  const usernameValue = pickString(item.UserName, pickCustom(item, ['username', 'user', 'login', 'email']));
  const emailValue = pickCustom(item, ['email', 'mail', 'e-mail']);
  const passwordValue = pickString(item.Password as string | undefined, pickCustom(item, ['password', 'pass']));
  const otpValue = pickString(item.OtpCurrent as string | undefined, pickCustom(item, ['otp', 'totp', '2fa', 'code', 'verificationcode']));

  let count = 0;

  for (const input of candidates) {
    const kind = classify(input);
    if (kind === 'password' && passwordValue) {
      if (writeValue(input, passwordValue, allowOverwrite)) count++;
      continue;
    }

    if (kind === 'otp' && otpValue) {
      if (writeValue(input, otpValue, allowOverwrite)) count++;
      continue;
    }

    if (kind === 'email' && (emailValue || usernameValue)) {
      if (writeValue(input, emailValue || usernameValue, allowOverwrite)) count++;
      continue;
    }

    if (kind === 'username' && usernameValue) {
      if (writeValue(input, usernameValue, allowOverwrite)) count++;
    }
  }

  return count;
}

function pickCustom(item: ContentSearchItem, keys: string[]): string {
  const custom = item.CustomFields ?? {};
  const normalized = new Map<string, string>();
  for (const [key, value] of Object.entries(custom)) {
    if (typeof value === 'string') {
      normalized.set(clean(key), value);
    }
  }
  for (const key of keys) {
    const value = normalized.get(clean(key));
    if (value) return value;
  }
  return '';
}

function pickString(...values: Array<string | undefined>): string {
  for (const value of values) {
    const text = (value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function writeValue(el: FillableElement, value: string, allowOverwrite: boolean): boolean {
  const currentValue = readValue(el);
  if (!allowOverwrite && currentValue.trim().length > 0) return false;
  if (currentValue === value) return false;

  suppressInteractionUntil = Date.now() + INTERACTION_SUPPRESS_MS;
  el.focus();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.value = value;
  } else {
    el.innerText = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function classify(el: FillableElement): 'username' | 'email' | 'password' | 'otp' | 'other' {
  const inputType = el instanceof HTMLInputElement ? (el.type || '').toLowerCase() : '';
  const textualHints = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
    ? [el.name, el.placeholder || '']
    : [];
  const signal = clean([el.id, el.getAttribute('autocomplete') || '', el.getAttribute('aria-label') || '', ...textualHints].join(' '));
  const textLikeTypes = new Set(['text', 'search', 'tel', 'number', '']);

  if (inputType === 'password' || signal.includes('password') || signal.includes('passwd')) return 'password';
  if (inputType === 'email' || signal.includes('email')) return 'email';
  if (signal.includes('otp') || signal.includes('totp') || signal.includes('2fa') || signal.includes('verificationcode') || signal.includes('authcode') || signal.includes('one-time')) return 'otp';
  if (textLikeTypes.has(inputType)) {
    if (containsNegativeUsernameTerm(signal)) return 'other';
    if (signal.includes('user') || signal.includes('login') || signal.includes('account') || signal.includes('identifier')) return 'username';
    if (hasNearbyPasswordField(el)) return 'username';
    if ((inputType === 'text' || inputType === '') && hasLoginLikeContext(el)) return 'username';
  }
  return 'other';
}

function hasNearbyPasswordField(el: FillableElement): boolean {
  for (const root of collectContextRoots(el)) {
    if (!('querySelector' in root) || typeof root.querySelector !== 'function') continue;
    const passwordField = root.querySelector('input[type="password"], input[autocomplete="current-password"], input[autocomplete="new-password"]');
    if (passwordField && passwordField !== el) return true;
  }

  return false;
}

function containsNegativeUsernameTerm(signal: string): boolean {
  for (const term of NEGATIVE_USERNAME_TERMS) {
    if (signal.includes(term)) return true;
  }
  return false;
}

function hasLoginLikeContext(el: FillableElement): boolean {
  for (const root of collectContextRoots(el)) {
    if (!('querySelector' in root) || typeof root.querySelector !== 'function') continue;
    const submitControl = root.querySelector('button[type="submit"], input[type="submit"]');
    if (!submitControl) continue;
    if (!('querySelectorAll' in root) || typeof root.querySelectorAll !== 'function') continue;
    const textLikeCount = root.querySelectorAll(TEXT_LIKE_INPUT_SELECTOR).length;
    if (textLikeCount <= MAX_LOGIN_FORM_TEXT_INPUTS) return true;
  }

  return false;
}

// Collect likely form/container roots around an input so nearby-field heuristics stay local.
function collectContextRoots(el: FillableElement): ParentNode[] {
  if (!(el instanceof HTMLElement)) return [];
  const roots = new Set<ParentNode>();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el.form) roots.add(el.form);
  }
  const formLike = el.closest('form,[role="form"]');
  if (formLike) roots.add(formLike);
  if (el.parentElement) roots.add(el.parentElement);
  return [...roots];
}

function clean(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function isFillable(el: FillableElement): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el.disabled || el.readOnly) return false;
  } else if (!el.isContentEditable) {
    return false;
  }
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  return true;
}

function bindAutomaticDetection(): void {
  const trigger = (target: EventTarget | null, delay = 0, isTrusted = false): void => {
    const candidate = resolveFillableTarget(target);
    if (!candidate) return;
    if (isTrusted) {
      suppressInteractionUntil = 0;
    }
    scheduleFieldActivation(candidate, delay);
  };

  document.addEventListener('focusin', (event) => {
    trigger(event.target, 0, event.isTrusted);
  });

  document.addEventListener('click', (event) => {
    trigger(event.target, 0, event.isTrusted);
  });

  document.addEventListener('input', (event) => {
    // If a dropdown is already open and the user is typing in its anchor field,
    // re-filter the existing results without re-fetching from background.
    if (currentDropdown && dropdownAnchor && event.target === dropdownAnchor) {
      const query = readValue(dropdownAnchor).trim();
      filterAndUpdateDropdown(query);
      return;
    }
    trigger(event.target, INTERACTION_DEBOUNCE_MS, event.isTrusted);
  });

  document.addEventListener('keydown', (event) => {
    trigger(document.activeElement, INTERACTION_DEBOUNCE_MS, event.isTrusted);
  });

  const observer = new MutationObserver(() => {
    trigger(document.activeElement, INTERACTION_DEBOUNCE_MS);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'readonly', 'disabled', 'contenteditable']
  });
}

function scheduleFieldActivation(target: FillableElement, delay: number): void {
  if (pendingInteractionTimer) {
    window.clearTimeout(pendingInteractionTimer);
  }
  pendingInteractionTimer = window.setTimeout(() => {
    pendingInteractionTimer = undefined;
    void activateField(target);
  }, delay);
}

async function activateField(target: FillableElement): Promise<void> {
  if (Date.now() < suppressInteractionUntil) return;
  if (!isFillable(target)) return;

  const activeTarget = resolveFillableTarget(document.activeElement);
  if (!activeTarget || activeTarget !== target) return;

  const now = Date.now();
  if (lastActivatedElement === target && now - lastActivatedAt < INTERACTION_DEBOUNCE_MS) return;

  lastActivatedElement = target;
  lastActivatedAt = now;

  if (!inlineSuggestionsEnabled) return;

  const response = await chrome.runtime.sendMessage({
    type: 'FIELD_INTERACTION',
    url: window.location.href
  }).catch(() => undefined) as FieldInteractionResponse | undefined;

  const results = response?.ok && Array.isArray(response?.state?.results) ? response.state.results : [];
  lastResults = results;
  const kind = classify(target);
  if (results.length > 0 && (kind === 'username' || kind === 'email')) {
    const query = readValue(target).trim();
    showDropdown(target, filterResults(results, query));
  }
}

function resolveFillableTarget(target: EventTarget | null): FillableElement | null {
  if (!(target instanceof Element)) return null;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return target;
  const editableHost = target.closest<HTMLElement>('[contenteditable]');
  if (editableHost?.isContentEditable) return editableHost;
  return null;
}

function collectFillableElements(): FillableElement[] {
  const directInputs = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'));
  const editableHosts = Array.from(document.querySelectorAll<HTMLElement>('[contenteditable]')).filter((el) => el.isContentEditable);
  return [...directInputs, ...editableHosts].filter(isFillable);
}

function readValue(el: FillableElement): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.value;
  }
  return el.innerText;
}

function filterResults(items: ContentSearchItem[], query: string): ContentSearchItem[] {
  if (!query) return items;
  const q = query.toLowerCase();
  return items.filter((item) => {
    const title = String(item.Title || '').toLowerCase();
    const username = String(item.UserName || '').toLowerCase();
    return title.includes(q) || username.includes(q);
  });
}

function filterAndUpdateDropdown(query: string): void {
  if (!currentDropdown || !dropdownAnchor) return;
  const filtered = filterResults(lastResults, query);
  if (filtered.length === 0) {
    hideDropdown();
    return;
  }
  renderDropdownItems(currentDropdown, filtered);
}

function resolveEventElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

function resolveDropdownItemTarget(target: EventTarget | null): HTMLElement | null {
  return resolveEventElement(target)?.closest<HTMLElement>('[data-kp-dropdown-item]') ?? null;
}

function selectDropdownItem(target: EventTarget | null): boolean {
  const row = resolveDropdownItemTarget(target);
  if (!row) return false;

  const index = Number(row.getAttribute('data-kp-dropdown-item-index'));
  const item = !Number.isNaN(index) && Number.isInteger(index) && index >= 0 && index < currentDropdownItems.length
    ? currentDropdownItems[index]
    : undefined;
  if (!item) return false;

  hideDropdown();
  chrome.runtime.sendMessage({ type: 'INLINE_FILL_REQUEST', item }).catch(() => {});
  return true;
}

function buildItemRow(item: ContentSearchItem): HTMLElement {
  const row = document.createElement('div');
  row.setAttribute('data-kp-dropdown-item', '');

  const title = String(item.Title || '(untitled)');
  const username = String(item.UserName || '');

  const titleEl = document.createElement('div');
  titleEl.textContent = title;
  Object.assign(titleEl.style, {
    fontWeight: '600',
    fontSize: '13px',
    color: '#1a1a1a',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as Partial<CSSStyleDeclaration>);
  row.appendChild(titleEl);

  if (username) {
    const usernameEl = document.createElement('div');
    usernameEl.textContent = username;
    Object.assign(usernameEl.style, {
      fontSize: '11px',
      color: '#777777',
      marginTop: '2px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    } as Partial<CSSStyleDeclaration>);
    row.appendChild(usernameEl);
  }

  Object.assign(row.style, {
    padding: '8px 12px',
    cursor: 'pointer',
    borderRadius: '3px',
    margin: '2px 4px',
  } as Partial<CSSStyleDeclaration>);

  row.addEventListener('mouseenter', () => {
    row.style.backgroundColor = '#e8f0fe';
  });
  row.addEventListener('mouseleave', () => {
    row.style.backgroundColor = '';
  });

  return row;
}

function renderDropdownItems(dropdown: HTMLElement, items: ContentSearchItem[]): void {
  currentDropdownItems = items;
  while (dropdown.firstChild) {
    dropdown.removeChild(dropdown.firstChild);
  }
  for (const [index, item] of items.entries()) {
    const row = buildItemRow(item);
    row.setAttribute('data-kp-dropdown-item-index', String(index));
    dropdown.appendChild(row);
  }
}

function showDropdown(anchor: FillableElement, items: ContentSearchItem[]): void {
  hideDropdown();
  if (items.length === 0) return;

  const dropdown = document.createElement('div');
  dropdown.setAttribute('data-kp-dropdown', '');

  Object.assign(dropdown.style, {
    position: 'fixed',
    zIndex: '2147483647',
    background: '#ffffff',
    border: '1px solid #cccccc',
    borderRadius: '6px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
    maxHeight: '260px',
    overflowY: 'auto',
    padding: '4px 0',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    lineHeight: '1.4',
    minWidth: '200px',
    boxSizing: 'border-box',
  } as Partial<CSSStyleDeclaration>);

  dropdown.addEventListener('mousedown', (e) => {
    if (e.button !== 0) {
      e.stopPropagation();
      return;
    }
    if (selectDropdownItem(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
  });

  renderDropdownItems(dropdown, items);

  positionDropdownNear(dropdown, anchor);
  document.body.appendChild(dropdown);
  currentDropdown = dropdown;
  dropdownAnchor = anchor;
}

function positionDropdownNear(dropdown: HTMLElement, anchor: FillableElement): void {
  const rect = (anchor as HTMLElement).getBoundingClientRect();
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.top = `${rect.bottom + 2}px`;
  dropdown.style.width = `${Math.max(rect.width, 180)}px`;
}

function hideDropdown(): void {
  if (currentDropdown) {
    currentDropdown.remove();
    currentDropdown = null;
    dropdownAnchor = null;
  }
  currentDropdownItems = [];
}

function bindDropdownDismissal(): void {
  document.addEventListener('mousedown', (e) => {
    if (!currentDropdown) return;
    const target = resolveEventElement(e.target);
    if (target?.closest('[data-kp-dropdown]')) return;
    if (dropdownAnchor && target && (dropdownAnchor === target || dropdownAnchor.contains(target))) return;
    hideDropdown();
  }, { capture: true });

  document.addEventListener('keydown', (e) => {
    // Alt+K: toggle inline suggestions on/off
    if (e.altKey && e.key === 'k') {
      e.preventDefault();
      inlineSuggestionsEnabled = !inlineSuggestionsEnabled;
      chrome.storage.local.set({ inlineSuggestionsEnabled }).catch(() => {});
      if (!inlineSuggestionsEnabled) hideDropdown();
      return;
    }
    if (e.key === 'Escape' && currentDropdown) {
      hideDropdown();
    }
  }, { capture: true });

  window.addEventListener('scroll', () => {
    if (currentDropdown) hideDropdown();
  }, { capture: true, passive: true });
}
