# HttpsTypeSearch Chrome Extension

This folder contains a Manifest V3 Chrome extension that integrates with the local KeePass `HttpsTypeSearch` API.

## Features

- URL-based search against local API endpoint (`/search?term=...`).
- `term` is extracted from current tab URL using browser URL parsing:
  - `hostname` or
  - `hostname:port` (only when URL has explicit port and option is enabled).
- Supports filtering display keys:
  - optional default top-level `URL` key,
  - fuzzy matching on `CustomFields` child key names by keywords.
- Autofill for common username/password/email/OTP inputs.
- Safer autofill behavior:
  - only fill visible/editable fields,
  - skip overwriting existing values unless enabled,
  - support single-result auto-fill and multi-result manual selection in popup.

## Project Structure

- `src/background.ts`: service worker, URL-term generation, API search, tab state, autofill dispatch.
- `src/content.ts`: field detection and autofill execution in page context.
- `src/popup.ts` + `popup.html`: run search and select candidate result to fill.
- `src/options.ts` + `options.html`: extension configuration UI.
- `src/urlMatching.ts`: URL parsing and term generation logic.
- `src/resultMatching.ts`: matching/filtering API result fields for display.
- `src/api.ts`: local API client.
- `test/urlMatching.test.ts`: tests for URL parsing/term extraction.
- `test/resultMatching.test.ts`: tests for key matching behavior.

## Build & Test

```bash
cd chrome-extension
npm install
npm run build
npm test
```

`npm run build` outputs unpacked extension files to `chrome-extension/dist/`.

## Load Unpacked Extension

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `chrome-extension/dist`.

## Required KeePass API Configuration

In KeePass plugin options, make sure:

- HTTPS API is enabled.
- Endpoint matches extension config (default example: `https://127.0.0.1:19456`).
- API token is copied to extension options.
- If you want direct password/OTP from search result, enable corresponding plugin options,
  or enable extension option `Fetch password/OTP from dedicated endpoints`.
- If Chrome shows `Failed to fetch` for a local HTTPS endpoint with a self-signed certificate, the extension cannot bypass certificate validation. Either:
  - trust the local certificate in your OS / Chrome, or
  - switch the endpoint to `http://localhost:19456` or `http://127.0.0.1:19456` for local-only use.
  - popup/options will also show Chinese guidance: `扩展无法忽略 HTTPS 证书错误，请信任证书或改用本地 HTTP`.

## Options

- **Term source**:
  - `hostname`
  - `hostname:port` (falls back to `hostname` when URL has no explicit port)
- **Match default `URL` key**: toggle on/off.
- **CustomFields key keywords**: one per line or comma-separated;
  matching is case-insensitive fuzzy contains on key name.
