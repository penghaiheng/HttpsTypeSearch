import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

class FakeHTMLElement {
  id = '';
  parentElement: FakeHTMLElement | null = null;
  private attrs = new Map<string, string>();

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  closest(_selector: string): FakeHTMLElement | null {
    return null;
  }
}

class FakeInputElement extends FakeHTMLElement {
  type = '';
  name = '';
  placeholder = '';
  form: FakeFormElement | null = null;
}

class FakeTextAreaElement extends FakeHTMLElement {
  name = '';
  placeholder = '';
  form: FakeFormElement | null = null;
}

class FakeFormElement extends FakeHTMLElement {
  hasPasswordField = false;

  querySelector(selector: string): FakeInputElement | null {
    if (this.hasPasswordField && selector.includes('input[type="password"]')) {
      const input = new FakeInputElement();
      input.type = 'password';
      return input;
    }
    return null;
  }
}

type ClassifyFn = (el: FakeHTMLElement) => 'username' | 'email' | 'password' | 'otp' | 'other';

async function loadClassify(): Promise<ClassifyFn> {
  const contentPath = path.resolve(process.cwd(), 'dist/src/content.js');
  const content = await readFile(contentPath, 'utf8');
  const negativeTermsDeclaration = content.match(/const NEGATIVE_USERNAME_TERMS = new Set\(\[[\s\S]*?\]\);/);
  const textLikeSelectorDeclaration = content.match(/const TEXT_LIKE_INPUT_SELECTOR = '.*?';/);
  const start = content.indexOf('function classify(');
  const end = content.indexOf('function isFillable(');
  assert.ok(negativeTermsDeclaration, 'expected NEGATIVE_USERNAME_TERMS constant in compiled content script');
  assert.ok(textLikeSelectorDeclaration, 'expected TEXT_LIKE_INPUT_SELECTOR constant in compiled content script');
  assert.ok(start >= 0 && end > start, 'expected classify snippet in compiled content script');
  const snippet = `${negativeTermsDeclaration[0]}\n${textLikeSelectorDeclaration[0]}\n${content.slice(start, end)}`;

  const context: Record<string, unknown> = {
    HTMLInputElement: FakeInputElement,
    HTMLTextAreaElement: FakeTextAreaElement,
    HTMLElement: FakeHTMLElement,
    Set,
  };

  vm.runInNewContext(`${snippet}; globalThis._classify = classify;`, context);
  const classify = context._classify as ClassifyFn | undefined;
  assert.ok(typeof classify === 'function', 'classify function should be available');
  return classify;
}

test('generic text input in login form still classifies as username', async () => {
  const classify = await loadClassify();
  const form = new FakeFormElement();
  form.hasPasswordField = true;
  const input = new FakeInputElement();
  input.type = 'text';
  input.form = form;

  assert.equal(classify(input), 'username');
});

test('context input is ignored instead of username', async () => {
  const classify = await loadClassify();
  const input = new FakeInputElement();
  input.type = 'text';
  input.name = 'context';

  assert.equal(classify(input), 'other');
});

test('code input remains ignored instead of username', async () => {
  const classify = await loadClassify();
  const input = new FakeInputElement();
  input.type = 'text';
  input.name = 'code';

  assert.equal(classify(input), 'other');
});
