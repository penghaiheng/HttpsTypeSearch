interface ContentSearchItem {
  UserName?: string;
  Password?: string;
  OtpCurrent?: string;
  CustomFields?: Record<string, unknown>;
}

chrome.runtime.sendMessage({ type: 'PAGE_LOADED', url: window.location.href }).catch(() => {
  // ignore
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'AUTOFILL_ENTRY') return;

  const item = message.item as ContentSearchItem;
  const allowOverwrite = Boolean(message.allowOverwrite);
  const filled = autofill(item, allowOverwrite);
  sendResponse({ ok: true, filled });
  return true;
});

function autofill(item: ContentSearchItem, allowOverwrite: boolean): number {
  const allInputs = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'));
  const candidates = allInputs.filter(isFillable);

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

function writeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string, allowOverwrite: boolean): boolean {
  if (!allowOverwrite && el.value.trim().length > 0) return false;
  if (el.value === value) return false;

  el.focus();
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function classify(el: HTMLInputElement | HTMLTextAreaElement): 'username' | 'email' | 'password' | 'otp' | 'other' {
  const inputType = 'type' in el ? (el.type || '').toLowerCase() : '';
  const signal = clean([el.name, el.id, el.getAttribute('autocomplete') || '', el.getAttribute('aria-label') || '', el.placeholder || ''].join(' '));
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

function isFillable(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (el.disabled || el.readOnly) return false;
  if (!(el instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  return true;
}
