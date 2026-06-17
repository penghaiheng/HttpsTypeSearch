# HttpsTypeSearch

HttpsTypeSearch is a standalone KeePass plugin that exposes a local HTTPS API for searching open, unlocked KeePass databases.

This project is based on and adapted from AutoTypeSearch. The original AutoTypeSearch plugin focused on popup search and auto-type workflows. HttpsTypeSearch keeps the search core, removes the old hotkey / popup UI flow, and focuses on a token-protected local HTTPS API.

## What It Is

- A KeePass plugin for Windows.
- A local HTTPS API that only accepts loopback requests.
- A standalone project derived from AutoTypeSearch.
- A plugin with an Options tab inside KeePass for runtime configuration.

## What It Is Not

- It is not a cloud service.
- It is not a browser extension.
- It does not expose a remote network API by default.
- It does not keep the original AutoTypeSearch popup / global hotkey workflow.

## Features

- Search across all currently open and unlocked KeePass databases.
- HTTPS only.
- Self-signed certificate provisioning for loopback bindings.
- Bearer token or X-Api-Token authentication.
- Configurable listen addresses, port, token regeneration, and certificate regeneration.
- Optional password return in regular results.
- Optional OTP return in regular results.
- Dedicated password and OTP endpoints.

## Security Model

- Requests are accepted only from loopback addresses.
- All endpoints except /health require authentication.
- HTTPS is required.
- Sensitive values can be limited to dedicated endpoints.

## Endpoints

- GET /health
- GET /search?term=example&limit=20
- GET /entries/{uuid}
- GET /entries/{uuid}/password
- GET /entries/{uuid}/otp

## Authentication

Use one of the following:

- Authorization: Bearer {token}
- X-Api-Token: {token}

## KeePass Options

The plugin adds an HttpsTypeSearch tab to the KeePass Options window.

Available settings include:

- Enable HTTPS API
- Listen addresses
- Port
- Max results
- Enable password endpoint
- Include password in search results
- Include OTP in search results
- API token regeneration
- Certificate regeneration
- Search field toggles
- Search behavior toggles

## Installation

Place one of the following in the KeePass Plugins directory:

- HttpsTypeSearch.dll
- HttpsTypeSearch.plgx

If you are targeting the matching KeePass compatibility binary directly, the compiled DLL is usually sufficient. If you want KeePass to build the plugin source package itself, use the PLGX package.

## Build Documentation

See the dedicated build guide:

- BUILD.md
- BUILD.zh-CN.md

## Chinese Documentation

See:

- README.zh-CN.md

## Chrome Extension

A Chrome extension implementation (Manifest V3 + TypeScript) is available in:

- `chrome-extension/`
- `chrome-extension/README.md`

## Reference

This project is derived from the AutoTypeSearch codebase and keeps parts of the original search implementation while changing the product goal to an HTTPS-first KeePass plugin.
