# HttpsTypeSearch Chrome Extension

This folder contains a Manifest V3 Chrome extension that integrates with the local KeePass `HttpsTypeSearch` API.

## Features

- URL-based search against local API endpoint (`/search?term=...`).
- Native URL parameter matching:
  - `scheme`, `host`, `hostname`, `port`, `path`/`pathname`, `query`, `origin`, `fullUrl`.
- Custom URL rules (JSON in options), including:
  - `fixed`, `query`, `template`, `regex`, `hostVariant`, `pathSegment`.
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
- `src/urlMatching.ts`: pure URL parsing and matching term generation logic.
- `src/api.ts`: local API client.
- `test/urlMatching.test.ts`: focused tests for URL parsing/matching.

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

## URL Matching and Custom Rules

In extension options:

- **Native URL keys**: comma-separated keys used directly as search terms.
- **Custom URL rules**: JSON array.

Example:

```json
[
  { "name": "tenant", "mode": "query", "value": "tenant" },
  { "name": "rootDomain", "mode": "hostVariant" },
  { "name": "sitePath", "mode": "template", "value": "{{origin}}{{pathname}}" },
  { "name": "env", "mode": "regex", "source": "hostname", "pattern": "^(dev|test|prod)\\." }
]
```

If any native/custom term returns search results, it is treated as a match.
