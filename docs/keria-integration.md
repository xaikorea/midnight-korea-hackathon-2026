# KERIA integration

## Applied scope

The enterprise-credential reuse workflow now has a local Signify edge tool and a KERIA import panel inside Settings → vLEI external verifier. KERIA manages identifiers/ACDC credentials; the GLEIF verifier remains the separate verifier. Neither imported files nor completed agent operations approve supplier registration, grants, or organization roles.

| KERIA capability | Implementation |
| --- | --- |
| Signing at the edge | Official `signify-ts@0.4.0`, isolated in `integrations/keria`; no passcode/secret API in BizProof |
| Managed identifiers | SDK identifiers list, 25-item pages, public name/AID only |
| ACDC credential query | SDK credential query, minimal subject LEI/role/holder and SAID/schema/issuer; no person-name or encrypted key export |
| CESR export | SDK credentials.get(SAID, true), selected credential only; blocked for locally revoked credentials |
| Holder authorization | SDK createSignedRequest for fixed `GET http://127.0.0.1:7676/authorizations/{aid}`; matches holder AID and rejects group/multi-key identifiers |
| Async operation status | SDK operations.get; pending/completed/failed only, no private response/error payloads, no automatic retries or deletion |
| Existing vLEI flow | Strict JSON import → explicit selection → separate submission consent → external verifier; signature file validated against holder and freshness before use |

## Local use

Requires an **existing** KERIA agent, its original Signify passcode/tier, and its trusted agent AID. This tool does not boot accounts, create identities, rotate keys, issue/revoke credentials, resolve arbitrary OOBIs, or orchestrate multisig/IPEX. These lifecycle operations need a separate designed issuer/governance workflow.

```powershell
cd integrations/keria
npm ci --ignore-scripts
$env:KERIA_ADMIN_URL = 'http://127.0.0.1:3901'
$env:KERIA_AGENT_AID = '<trusted agent AID from your existing setup>'
$env:KERIA_TIER = 'low' # Must match the original controller.
node edge.mjs --help
node edge.mjs snapshot private-output/snapshot.json
node edge.mjs snapshot private-output/page-2.json 25
node edge.mjs presentation '<credential SAID>' private-output/presentation.json
node edge.mjs sign '<identifier name>' '<holder AID>' private-output/headers.json
node edge.mjs operation '<operation name>' private-output/operation.json
```

Each command prompts for the passcode **without echo in the local terminal**. Do not place it in CLI arguments, shell history, browser inputs, environment variables, source files, or screenshots. JS cannot guarantee physical memory zeroization; the short-lived process exits after the command. SDK initialization can approve the initial controller-to-agent delegation, but this tool never calls `/boot`. Agent AID is pinned before that connection step. This is not independent validation of the entire KERI key-event history.

The process-local HTTP transport permits only the configured HTTPS (or loopback HTTP) origin, disables redirects, and imposes a 12-second request deadline and 2MB response limit. The SDK authenticates signed admin responses. The SDK's signed headers do not provide an independent body-integrity/trust-chain verdict; use HTTPS for remote agents. No BizProof web server route receives the passcode or calls the KERIA admin API.

Files are created without overwriting existing paths. `private-output/` and node_modules are ignored. Output files still contain identity information and CESR may contain personal data. Keep them in a restricted local folder, delete after use, and create a new filename for refreshed exports. Windows ACLs must be managed by the local user; Unix mode 0600 alone does not configure Windows ACLs.

Import snapshot or presentation JSON into the KERIA panel. A snapshot supports selecting the expected holder/SAID/LEI/role, but has no CESR. A presentation file populates those fields and CESR; it **does not** check the submission-consent box. Sign headers just before authorization, import them into “KERIA 권한 조회 서명 파일”, then explicitly click “서명된 권한 조회”. They expire under the existing five-minute check and are cleared after use. The operation report is local CLI output, not an importable credential.

## Trust and limitations

- Imported files are untrusted and explicitly labeled as unverified. No server persistence, localStorage, or automatic upload was added.
- Local `iss`/`bis` events are observations; they do not establish current revocation or GLEIF root trust. The existing verifier is responsible for live authorization. No automatic relationship is established with Keycloak/OpenFGA or Midnight.
- Supports this project's existing 44-character AID/SAID subset and role-bearing ACDCs with `a.i`, `a.LEI`, and `a.engagementContextRole`/`a.officialRole`. Other CESR encodings and multi-key/group signing are rejected.
- The UI never generates a vLEI from a BizProof VC-JWT. A real vLEI issuer, witness network, KERIA service, and credentials remain prerequisites.
- KERIA and Signify README architecture was inspected at KERIA `a442d91d7764ecce571ecaad5246b4f49da5718d` and Signify `5a174b5456c2d256493f9991ac4ae73857ff4fce`. Executable API integration is against the **published 0.4.0 package**, not assumed identical to current main. Dependencies and integrity are pinned in the isolated package lock.

## Verification

`node tests/keria.cjs` runs offline behavior/schema tests and is in `npm run test:unit`.

`node --test integrations/keria/sdk.test.mjs` uses real SDK cryptography with ephemeral test keys to verify valid signatures and reject altered method/path/resource and unsigned agent responses. Network responses are fixtures: this is not a live KERIA test.

`node tests/keria-ui.cjs` exercises import, revoked selection, explicit submission consent, signature binding, and mobile layout against the running application with upstream fixtures.

The current environment has no running Docker engine or provisioned KERIA credentials. Live KERIA → CESR → GLEIF verifier end-to-end validation remains unperformed. Do not describe this as a live connected or officially verified vLEI service.

Sources: [KERIA](https://github.com/WebOfTrust/keria), [Signify TS](https://github.com/WebOfTrust/signify-ts), [published Signify 0.4.0](https://www.npmjs.com/package/signify-ts/v/0.4.0), [GLEIF verifier](https://github.com/GLEIF-IT/vlei-verifier).
