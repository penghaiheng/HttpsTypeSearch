# HttpsTypeSearch v1.0.0

Initial public standalone release of HttpsTypeSearch.

## Overview

HttpsTypeSearch is a KeePass plugin that exposes a local HTTPS API for searching open, unlocked KeePass databases.

This project is derived from AutoTypeSearch, but focuses on HTTPS API access instead of the original popup / hotkey search workflow.

## Highlights

- Standalone KeePass plugin project
- HTTPS-only local API
- Loopback-only request handling
- Token-based authentication
- Self-signed certificate provisioning support
- Search across all open and unlocked KeePass databases
- Dedicated password endpoint
- Dedicated OTP endpoint
- Optional password return in regular results
- Optional OTP return in regular results
- KeePass Options tab for runtime configuration

## API Endpoints

- GET /health
- GET /search?term=example&limit=20
- GET /entries/{uuid}
- GET /entries/{uuid}/password
- GET /entries/{uuid}/otp

## Notes

- The plugin is intended for local automation scenarios.
- The API accepts only loopback requests.
- Sensitive data exposure can be restricted to dedicated endpoints.

## Build Artifacts

Typical outputs:

- HttpsTypeSearch.dll
- HttpsTypeSearch.plgx

## Documentation

- README.md
- README.zh-CN.md
- BUILD.md
- BUILD.zh-CN.md
