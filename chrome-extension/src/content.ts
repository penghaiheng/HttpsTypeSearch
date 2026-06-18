interface ContentSearchItem {
  UserName?: string;
  Password?: string;
  OtpCurrent?: string;
  CustomFields?: Record<string, unknown>;
}

type FillableElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

const INTERACTION_DEBOUNCE_MS = 180;
const INTERACTION_SUPPRESS_MS = 600;

let pendingInteractionTimer: number | undefined;
let lastActivatedElement: FillableElement | null = null;
let lastActivatedAt = 0;
let suppressInteractionUntil = 0;

chrome.runtime.sendMessage({ type: 'PAGE_LOADED', url: window.location.href }).catch(() => {
  // ignore
});

bindAutomaticDetection();

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
    if (signal.includes('user') || signal.includes('login') || signal.includes('account') || signal.includes('identifier')) return 'username';
    if (!signal.includes('code')) return 'username';
  }
  return 'other';
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

  await chrome.runtime.sendMessage({
    type: 'FIELD_INTERACTION',
    url: window.location.href
  }).catch(() => {
    // ignore
  });
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
