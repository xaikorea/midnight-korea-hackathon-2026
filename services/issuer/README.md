# Independent synthetic issuer

`npm run demo:issuer` starts a Node issuer on loopback 3201 and the Next application on loopback 3120. Open `/issuance`; the separate review page is `/issuer-demo`. `PORT` and `ISSUER_PORT` may override these defaults. Private local runtime data lives under ignored `outputs/independent-issuance-demo/`.

The new path uses synthetic business facts and simulated consent. It does **not** authenticate a person, their employment, corporate authority or a certificate. Real phone/certificate integrations are disabled. No phone number, CI, certificate password or signing private key is collected from visitors.

## Implemented boundary

- Issuer: dependency-free Node HTTP process, dedicated SQLite WAL ledger, issuer-only Ed25519 key file. API service authentication binds method, exact path, body digest, audience, scope, expiry and one-use jti. No public signing oracle or unauthenticated issuance endpoint.
- Platform: pinned issuer public key provisioned out of band. The response's public key is never enrolled automatically. The web container cannot mount the issuer data/key directory. A different platform key signs processing receipts; it does not stand for an issuer or holder signature.
- Visitors: the backend derives a scope from the authenticated demo session. Review/approval/revocation operate only in that scope. This is a synthetic review experience, not production issuer administration. Keycloak/pilot workspaces cannot enter this path.
- Consent: versioned document hash, purpose, scope, ten-minute expiry, confirmed/cancelled/consumed state. An identity session can be consumed once. Each command is idempotent and binds its complete body; reuse with changed content returns 409.
- Issuance: review, supplement, resubmit, reject, withdraw, approve; revision comparisons prevent stale decisions. Credential signing, persistence and issued event are one SQLite transaction. Original credential bytes stay immutable after revocation.
- Receipt: verified original credential and digest stored once. Each subsequent use asks the issuer for a fresh nonce-bound signed status, with a maximum 60-second acceptable freshness window. Issuer outages, tampering and revoked credentials fail closed. Polling retrieves the authoritative ledger after a lost response; no callback is required to mark issuance complete.
- Two-target reuse: same new credential, separate policy snapshots, audiences and nonces; platform signatures use context `bizproof:platform:processing-receipt:v3`. Existing version 1/2 signatures remain unchanged.

This is an internal versioned protocol, **not** an OpenID4VCI implementation. The same host still shares the kernel and host administrator. This flow currently does not submit the newly issued credential to Midnight. The earlier Local Devnet evidence page describes its separately executed scenario.

## API

All `/v1/` routes require service authentication. `/health` reports only liveness and synthetic mode. There are no browser-accessible service credentials.

| Route | Operation |
| --- | --- |
| `GET /v1/catalog` | Fixed synthetic facts and consent document |
| `POST /v1/identity-sessions` | Simulated session start; live mode rejected |
| `GET /v1/identity-sessions/{id}` | Scoped identity status |
| `POST /v1/identity-sessions/{id}/confirm`, `/cancel` | Document-bound consent |
| `GET/POST /v1/issuance-requests` | Scoped queue or new request |
| `GET /v1/issuance-requests/{id}` | Authoritative state and events |
| `POST /v1/issuance-requests/{id}/decisions`, `/resubmit`, `/cancel` | Revision-checked state transitions |
| `GET /v1/issuance-requests/{id}/credential` | Immutable signed original |
| `GET /v1/credentials/{id}/status?nonce=…` | Signed current status |
| `POST /v1/credentials/{id}/revocations` | Durable revocation |

## Verification and operations

`npm run test:issuer` runs a separate issuer child process, concurrent HTTP requests, workspace isolation, signature and status tests, both target applications, revocation, restart and outage. It is included in `test:unit`. `node tests/independent-issuer-ui.cjs` requires Playwright, Edge and a running `demo:issuer`; `SMOKE_BASE` overrides the URL. Screenshots are local under `outputs/independent-issuer/`.

The NHN compose definition adds a 192 MiB issuer container on an internal Docker network, without a published port. Provision `/srv/bizproof/secrets/issuer-service.env` with `ISSUER_SERVICE_SECRET`; `issuer-client.env` contains `BIZPROOF_ISSUER_URL=http://issuer:3201`, the matching client secret, pinned `BIZPROOF_ISSUER_TRUST` and separate `BIZPROOF_PROCESSING_KEY`. Generate keys on the target host; never copy them into Git or container layers. The issuer volume must belong to uid 10002; the web uid is 10001.

`deploy/nhn/backup.py` snapshots both SQLite databases and retains the corresponding keys/configuration in a root-only archive. Backups are sequential, not a distributed atomic snapshot. Restore requires maintenance mode and reconciliation against the issuer ledger; never roll the issuer ledger back merely to roll back an app image. Missing issuer keys with an existing ledger cause startup failure rather than silently replacing the key. Key rotation, a separate issuer operator login, external-provider callbacks, qualified identity, issuer-to-chain revocation jobs and disaster-recovery reconciliation require further implementation before a live pilot. Retain the original issuer volume during rollback.

The local-only development plan is excluded from Git and Docker build context.
