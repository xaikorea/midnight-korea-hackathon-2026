# Third-party notices and implementation scope

## Midnight example-zkloan

Source: https://github.com/midnightntwrk/example-zkloan

Reference commit: `eff9030d509f98938914c1b2b721acb88fc1e42c`.

The Schnorr Compact module and wallet initialization pattern are adapted from the Midnight example. Copyright (C) 2025 Midnight Foundation. Licensed under Apache-2.0; the full text is retained at [contracts/LICENSE-APACHE-2.0](contracts/LICENSE-APACHE-2.0). BizProof adds enterprise predicates, request/holder binding, lifecycle guards, web-source linkage and a fixed Local Devnet runner. The final quotient normalization check in the Schnorr module is a local modification.

## Installed libraries

Midnight.js / Wallet SDK / Compact runtime and the React, Next.js, Zod, JSON Forms, AJV, JOSE and other npm packages are installed from their package registries. Package versions and integrity hashes are recorded in the root and contracts lockfiles. Their respective package licenses apply. The toolchain installer downloads the official Compact 0.31.1 release and checks its pinned SHA-256.

Local Devnet containers use the official Midnight node, proof-server and standalone indexer images. Their licenses remain with the corresponding projects. No official institutional certification is implied by these dependencies.

## Workflow references and optional adapters

SAP Supplier Profiles, GLEIF vLEI and Truvity SSI informed the business workflow. Their brands, proprietary application code or certification marks are not presented as BizProof's own implementation. There is no SAP/Truvity production connection or GLEIF QVI status.

walt.id, Privado ID, Keycloak, OpenBao, OPA, OpenFGA, ClamAV and KERI/vLEI are referenced by optional integration adapters or design notes. An adapter in the source is not a claim that every external service is deployed in the public demo. Component-specific notices, including `integrations/vlei/LICENSE-APACHE-2.0`, remain in their directories.

Original background animation and sample-free synthesized demo music are documented with the local media artifacts; no third-party music track is required for the demo video.

PDF parsing and synthetic demonstration documents use [pdf-lib](https://github.com/Hopding/pdf-lib), version 1.17.1, MIT license. Package copyright and license text remain in the installed distribution.
