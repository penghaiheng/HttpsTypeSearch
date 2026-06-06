HttpsTypeSearch
================

Standalone KeePass plugin focused on an HTTPS search API.

What it includes:
- Local HTTPS API only.
- Search across open, unlocked KeePass databases.
- KeePass Options tab for configuration.

What it does not include:
- Global hotkey search window.
- IPC-triggered popup search.
- Original AutoTypeSearch UI behavior.

Configuration options:
- Enable or disable the API.
- Listen addresses.
- Port.
- API token regeneration.
- Certificate regeneration.
- Password endpoint enablement.
- Search field and search behavior toggles.

Default endpoints:
- https://127.0.0.1:19456/
- https://localhost:19456/

Endpoints:
- GET /health
- GET /search?term=example&limit=20
- GET /entries/{uuid}
- GET /entries/{uuid}/password

Authentication:
- Authorization: Bearer {token}
- or X-Api-Token: {token}
