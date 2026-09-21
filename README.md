# BizProof — 기업 자격 재사용 플랫폼

한 번 발급받은 기업 자격으로 구매사 등록 조건과 지원사업 신청 조건을 각각 증명하는 한국어 데모입니다.

## 실행

Node.js 22.13 이상 필요. 현재 환경에서는 http://localhost:5173 에서 실행 중입니다.

```powershell
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_marvelous_night_thrasher.sql
npm run dev
```

마이그레이션 SQL은 새 로컬 DB에 한 번만 실행합니다. 이미 만들어진 DB에는 반복 실행하지 마세요. Windows에서 npm shim 문제가 있으면 `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" run install:ci` 및 `node scripts/run-framework.mjs build`를 사용합니다.

화면의 ‘워크스페이스 열기’를 누릅니다. 로컬 로그인은 Sites 개발용 모의 사용자입니다. 상단 역할 선택은 하나의 개인 샌드박스에서 시나리오를 재현하는 기능이며, 실제 서로 다른 기업 계정의 접근제어를 대신하지 않습니다.

## 핵심 시연과 보완 자료

/?view=journey의 **자격 재사용 시연**에서 동일 자격의 구매사·지원사업 결과와 미충족·취소 후 차단을 이어서 확인할 수 있습니다. 기업 자격 지갑에는 증빙 해시·출처·확인자·시점을 서명에 연결하는 문서 검토 발급이 추가됐습니다. 연결 및 설정에는 공식 Midnight 지갑 API 4.0.1 기반의 연결 요청과 로컬 서비스 진단이 있습니다.

- [부족한 기능별 오픈소스 선정](docs/opensource-gap-map-2026-09-20.md)
- [시연·제출 실행 안내](docs/demo-submission-runbook.md)
- [이번 보완 결과와 남은 경계](docs/plan-improvements-2026-09-20.md)

지갑 연결 기능은 실제 확장 지갑에서 확인이 필요하며, 실제 proof·컨트랙트 배포는 아직 미완료입니다.

## 개별 업무 화면의 데모 순서

1. 관리자 역할에서 기업 디렉터리와 발급된 가상 자격을 확인합니다.
2. 구매사 협력사 등록 요청을 만들고 기업 자격 선택 및 공유 동의 후 제출합니다.
3. 서명 및 유효성 확인을 눌러 결과를 확인합니다.
4. 같은 자격으로 지원사업 요청을 만들고 반복합니다.
5. 높은 매출을 요구하는 프리미엄 정책으로 미충족 결과를 확인합니다.
6. 발급기관에서 자격을 취소한 후 재사용이 차단되는지 확인합니다.
7. ‘연결 및 설정’의 Compact 실험실에서 독립적인 실제 컴파일 회로를 실행합니다.

## 구현한 기능

- 기업 프로필·검색·PDF/TXT 증빙 업로드와 다운로드
- Ed25519 서명 자격 발급, 만료 검사, 갱신, 취소, 내보내기 및 위조 검증을 포함한 다시 가져오기
- 발급기관 신뢰 중지·재개, 키 교체와 이전 검증 키 보존
- 버전별 자격 스키마 메타데이터 (증명 속성은 매출·설립일·소재지·인증 4개)
- 구매/지원사업 정책, 불변 요청 정책 스냅샷, nonce·audience·기한 검사
- 공유 동의, 조건별 결과 제출 및 수신 역할 검증, 중복 사용 차단
- 기관 연결 요청·수락·거절, 활동 기록 및 JSON 다운로드
- 로그인 사용자별 D1 저장소, 낙관적 동시성 검사, R2 증빙 저장, 역할별 응답 필터
- 데스크톱/모바일 UI, 로딩·오류·빈 상태, 사용 가능한 환경의 WebMCP 읽기/이동 도구

## 기술 구조와 신뢰 경계

React/TypeScript + Vinext, Cloudflare Worker API, D1, R2를 사용합니다. 주요 화면은 `app/platform.tsx`, 업무 API는 `app/api/platform/route.ts`, 데이터 모델은 `lib/domain.ts`입니다.

업무 데모는 서버에서 원본 속성을 평가하고 결과를 서명합니다. 검증기관 응답에는 원본 속성을 제외하지만 **영지식증명은 아닙니다**. 테스트 발급자 비밀 키와 속성은 서버 DB에 저장됩니다. 실제 고객 데이터는 넣지 마세요. 운영에는 기관별 실제 인증·인가, KMS/HSM, 암호화와 보존정책, 불변 감사 저장소, 보안 검토가 필요합니다. 샌드박스 관리자 및 기업 역할은 해당 개인 워크스페이스 전체를 관리합니다.

별도 `contracts/`에는 Schnorr 서명 자격의 비공개 조건 판정, 소유자 비밀값 확인, 발급자 신뢰/취소, 요청 만료, 중복 방지 기능을 갖춘 **컴파일 가능한 Midnight Compact 컨트랙트**가 있습니다. Compact 0.31.1로 9개 회로의 proving/verifying key를 생성했습니다. 테스트는 컴파일 결과의 로컬 실행이며 ZK proof 생성 또는 온체인 거래 검증이 아닙니다. 업무 지갑의 Ed25519 자격과 실험실의 Schnorr 자격은 자동 호환되지 않습니다.

## Compact 실행

```powershell
cd contracts
npm ci
# Compact 0.31.1이 설치된 Linux/WSL 환경에서:
# compactc bizproof.compact managed
node --test test.mjs
node bridge.mjs
```

브리지는 127.0.0.1:4011 에서 고정 가상 시나리오와 인증된 업무 API가 전달하는 저장 요청의 로컬 회로를 실행합니다. 웹 API는 로그인된 로컬 개발 환경에서만 이 브리지를 호출합니다. 생성된 managed 파일·키·다운로드한 컴파일러는 Git에서 제외됩니다. Windows 작업 폴더의 현재 설치 경로로 재컴파일하는 명령:

```powershell
wsl -d Ubuntu -- bash -lc 'cd "/mnt/c/Users/USER/Documents/ChatGPT/Midnight Korea Hackathon 2026" && .tools/compiler/versions/0.31.1/x86_64-unknown-linux-musl/extracted/compactc contracts/bizproof.compact contracts/managed'
```

컨트랙트의 공개 holder 식별값과 취소 식별값은 연결 가능하므로 기관 간 추적 불가능성을 보장하지 않습니다. 시간은 관리자 갱신값에 의존합니다. 운영 전 실제 체인 시간/오라클, 키 관리, 악의적 witness 검토와 전문 회로 감사를 완료해야 합니다.

## 참조 및 오픈소스 적용 범위

| 자료 | 적용 | 미포함/구분 |
|---|---|---|
| [SAP Supplier Profiles](https://help.sap.com/docs/business-network-for-procurement/business-network-buyer-administration/viewing-and-downloading-supplier-profiles?locale=en-US&version=2608) | 기업 디렉터리, 프로필 상세, 문서 다운로드의 업무 흐름 | SAP 코드·브랜드 복제 또는 SAP API 연결 없음 |
| [GLEIF vLEI](https://www.gleif.org/en/organizational-identity/lei-vlei/the-verifiable-lei-vlei) | 발급기관 신뢰 및 조직 자격 모델 참고 | GLEIF 인증, 실제 LEI 검증, KERI 자격 발급 없음 |
| [Truvity SSI](https://docs.truvity.com/ssi/) | 발급자·소유자·검증자 생애주기 참고 | Truvity 서비스/API 사용 없음 |
| [Midnight ZKLoan](https://github.com/midnightntwrk/example-zkloan) | Schnorr Compact 모듈 재사용, 기업 조건 회로와 서명 테스트 구현 | 대출·담보·자산 처리 기능은 기업 자격 서비스 범위에서 제외 |
| [Midnight VC](https://github.com/midnightntwrk/midnight-verifiable-credentials) | 공식 credential-model 패키지 적용, family/schema 연결과 서명 용도 분리 | core Compact VC/VP proof 및 표준 적합성 인증 미연결 |
| [walt.id](https://github.com/walt-id/waltid-identity) | 발급·지갑·검증의 기능 분리 참고 | 해당 서버 통합, OID4VCI/OID4VP 및 범용 DID resolution 미구현 |
| [Privado ID](https://github.com/PrivadoID/issuer-node) | 스키마·발급·취소 운영 흐름 참고 | issuer-node, Iden3 상태·회로·체인 미통합 |

서로 다른 DID·서명·체인 체계를 하나의 자격 형식으로 혼합하지 않았습니다. 외부 플랫폼의 모든 기능을 통합한 완성 제품이 아니라 위 업무를 위한 동작 가능한 구현입니다. 범용 자격 수입은 지원하지 않으며, 이 워크스페이스에서 내보낸 자격의 서명과 발급 기록을 재검증합니다.

재사용 원본: midnightntwrk/example-zkloan commit `eff9030d509f98938914c1b2b721acb88fc1e42c`, Apache-2.0. `contracts/LICENSE-APACHE-2.0` 보존. `schnorr.compact`에는 마지막 quotient 구간의 정규화 범위 검사를 추가했습니다.

## 검증

```powershell
node node_modules/typescript/bin/tsc --noEmit
node scripts/run-framework.mjs build
node --test contracts/test.mjs
node tests/workflow.cjs
node tests/extensions.cjs
```

브라우저 테스트는 실행 중인 로컬 서버와 Playwright 및 Edge가 필요합니다. `PLAYWRIGHT_PATH`로 Playwright 설치 위치를 지정할 수 있습니다. 테스트는 가상 샌드박스에 새 기록을 추가합니다. `outputs/`에 화면 캡처가 저장됩니다.

## 현재 연결 상태와 남은 작업

- 로컬 업무 API 및 DB/R2 작동. 실제 SAP/GLEIF/Truvity 등의 외부 자격 연결 없음.
- Compact 컴파일·키 생성·회로 로컬 테스트 구현. Docker Desktop 엔진이 시작되지 않아 노드/인덱서/증명 서버 배포와 실제 네트워크 거래는 검증하지 못했습니다.
- 해커톤에서 블록체인 실행을 보여주려면 devnet 또는 허용 네트워크에 컨트랙트를 배포하고 holder 지갑·proof provider·indexer를 연결한 후, 업무 요청/정책과 체인 결과를 연결해야 합니다. 현재 화면만으로 실제 온체인 실행을 주장하면 안 됩니다.
- Sites 신규 호스팅 생성은 계정 사용량 제한(429)으로 실패했습니다. 공개 URL은 아직 없습니다. 할당량이 회복된 뒤 프로젝트 생성·D1 마이그레이션·배포를 진행해야 합니다.

## SAP 공급업체 프로필 개선 (2026-09-20)

SAP Supplier Profiles 문서의 기본/확장 정보 분리, 관계 기반 공개, CSV 다운로드와 중지 상태 안내를 BizProof에 적용했습니다. 실제 SAP 디자인 자산이나 서버 코드를 복제한 것이 아니며 SAP 계정/API와 연결하지 않습니다.

- 기업 디렉터리: 소재지·업종·거래 관계 필터, 기업명/최근 수정 정렬, 상태 요약 및 빈 결과 안내.
- 기업 상세: 기본/확장 정보 선택, 프로필 편집, 기업 소개·제품/서비스·공급 지역·웹사이트, 기본/확장 CSV.
- 공개 범위: 기업·발급기관만 / 연결 승인된 기관 / 워크스페이스 모든 기관. `connected`는 해당 개인 샌드박스에서 구매사 또는 지원기관 역할의 승인된 연결을 검사합니다. 실제 조직별 ACL은 아닙니다.
- 서버에서 확장 프로필을 필터하고 CSV 다운로드 권한을 재검증합니다. CSV에는 원본 자격 속성·매출·서명·비밀 키·증빙 파일이 포함되지 않습니다.
- 관리자 거래 중지/재개, 중지 중 새 연결 요청 및 수락 차단. 기존 자격/완료 거래에는 자동 취소를 적용하지 않습니다.
- 다운로드·편집·상태 변경 감사 기록, CSV 수식 주입 방어, HTTP(S) 웹사이트 검증.

추가 모델은 선택 필드로 저장되어 기존 워크스페이스와 호환되며 새 DB 마이그레이션은 필요하지 않습니다. `node tests/supplier-profiles.cjs`로 접근제어·수정 저장·CSV 다운로드·거래 중지·모바일을 검증합니다. 다운로드 감사 이벤트는 서버가 파일 내용을 반환한 시점을 의미하며 디스크 저장 완료를 보장하지 않습니다.

참고: https://help.sap.com/docs/business-network-for-procurement/business-network-buyer-administration/viewing-and-downloading-supplier-profiles?locale=en-US

## GLEIF vLEI 구조를 참고한 조직 신원·권한 (2026-09-20)

`?view=trust` 화면에서 발급기관 → 기업 자격 → 담당자 → 업무 범위를 확인합니다. GLEIF 설명 페이지의 조직·개인·역할 연결 및 신뢰 경로 개념을 참고했습니다. GLEIF의 실제 신뢰 루트나 공인 vLEI 자격과 연결된 것은 아닙니다.

- 담당자 이름·역할·구매 등록/지원사업 범위를 기업 자격에 연결한 Ed25519 서명 권한 자격을 발급합니다. 유효기간은 기업 자격 만료일을 넘지 않습니다.
- 발급기관/기업 상태, 기업 자격/권한 서명, 만료·취소, 요청 기업 및 업무 범위를 서버에서 검사합니다. 키 교체 전 공개 키로 기존 권한을 검증합니다.
- 권한 발급·취소·검증 이력을 기록하고 검사 결과 JSON을 다운로드합니다. 결과는 검사 시각 기준이며 이후 취소될 수 있습니다.
- 기업 자격 제출 시 담당자 권한을 선택적으로 첨부합니다. 선택한 기업 자격과 동일한 자격에 연결되어야 하며, 수신 기관 확인 시 현재 상태를 재검증합니다. 선택하지 않은 기존 제출 흐름은 유지됩니다.
- 구매사/지원기관 역할은 자기 업무 범위의 권한만 조회·검증할 수 있습니다. 기업·발급기관 역할의 권한은 개인 샌드박스 단위입니다.

권한 자격의 이름·직책은 샌드박스 입력값입니다. 개인 신원 확인, 해당 개인의 개인키 소유 증명, 재직·대표권 확인, OOR/ECR 표준 자격 발급, LEI 레지스트리 조회, QVI 인증 및 KERI/ACDC 검증은 구현하지 않았습니다. 따라서 실제 대리 권한 인증이나 전자서명 서비스로 사용하면 안 됩니다. 업무 속성 원본이나 서버 비밀 키는 권한 검증 보고서에 포함되지 않습니다.

선택적 `authorities` 저장 필드로 이전 워크스페이스와 호환됩니다. 검증: `node tests/organization-trust.cjs` (업무/기업 일치, 키 교체, 신뢰 중지, 권한 취소 후 제출 무효, 역할 권한, UI 발급·조회, 모바일).

참고: https://www.gleif.org/en/organizational-identity/lei-vlei/the-verifiable-lei-vlei

## Truvity SSI를 참고한 발급 작업실 (2026-09-20)

`?view=studio`에 수정 가능한 초안 → 검토 → 서명 발급 흐름을 추가했습니다. Truvity의 초안/자격 구분, 라벨 검색, 파일 연결 개념을 참고한 자체 구현이며 Truvity SDK/API를 호출하지 않습니다.

- 기업·발급기관·스키마와 필수 기업 속성 4개를 입력해 초안을 저장하고 편집합니다. 불완전한 속성의 임시 저장은 지원하지 않습니다.
- 라벨(최대 8개), 내부 메모, 해당 기업의 업로드 증빙 연결을 지원합니다. 상태 및 라벨로 필터링하고 기업명·라벨·메모를 검색합니다.
- 서명 발급 시 초안과 새 자격을 동일한 DB 갱신으로 저장합니다. 발급 후 초안은 읽기 전용이며 지갑 자격으로 이동할 수 있습니다. 새 자격의 서명 형식은 기존 BizProof와 같습니다.
- 초안 revision 검사 및 DB 낙관적 동시성 검사로 오래된 수정과 중복 발급을 차단합니다. 보관된 초안은 발급할 수 없습니다.
- 초안 편집·발급은 관리자/발급기관 역할에 한정됩니다. 구매사/지원기관 응답에서는 초안을 제외합니다. 기업 역할은 개인 샌드박스의 초안을 조회합니다.
- 연결 증빙은 서버에서 같은 기업 소유인지 검증합니다. 라벨·메모·증빙 링크는 내부 관리 메타데이터이며 서명 payload나 외부 제출 결과에 포함되지 않습니다. 파일 내용의 암호학적 증명/해시 바인딩을 의미하지 않습니다.

새로운 선택적 `drafts` 배열을 사용하므로 DB 마이그레이션은 필요 없습니다. 테스트: `node tests/issuance-studio.cjs` (수정 충돌·발급 상태·중복 방지·증빙 소유·기관 중지·역할 필터·새 자격 서명 검증·UI·모바일).

참고: https://docs.truvity.com/ssi/ 및 https://docs.truvity.com/ssi/sdk/credential-lifecycle/user-defined-types

## ZKLoan 핵심 기능의 실제 업무 요청 연결 (2026-09-20)

기존 고정 데이터 실험실에 더해, 검증 요청 상세에서 선택한 기업 자격을 사용해 ‘이 요청을 회로로 확인’을 실행할 수 있습니다.

| ZKLoan 핵심 | BizProof 적용 |
|---|---|
| Attestation API / Jubjub Schnorr | 기존 Ed25519 기업 자격을 서버에서 검증하고 로컬 실험용 Schnorr 서명으로 변환 |
| Private witnesses / score predicates | 기업 매출·설립일·소재지·인증 보유를 Compact private witness로 전달하고 조건 충족 결과만 반환 |
| Provider registry | 등록된 로컬 회로 발급 키로 서명 확인. 업무 서버는 원본 자격의 실제 테스트 발급자 키·신뢰·취소를 먼저 검사 |
| Holder secret binding | 회로의 비밀값에서 유도한 holder에 자격 서명을 연결. 이번 로컬 실험의 holder secret은 서비스가 생성하며 사용자 지갑 소유 증명이 아님 |
| Request binding / replay guard | 저장된 요청 ID·수신기관·nonce·정책 hash를 회로 요청으로 변환. 동일 회로 실행 컨텍스트 안의 중복 제출 차단 확인 |
| Public/private result separation | 결과에는 요청/자격 식별값·정책 hash·판정·실행 시각만 기록. 매출 원본·witness·비밀 키 제외 |
| CLI/UI execution states | 요청별 실행 중·오류·판정 및 보고서 다운로드, 실제 proof/네트워크 상태를 분리해서 표시 |

구현 경로: `app/api/midnight/route.ts` → `contracts/bridge.mjs` → `contracts/request-runner.mjs` → 컴파일된 `contracts/managed/contract/index.js`.

- 클라이언트는 요청 ID와 자격 ID만 보냅니다. 원본 속성·정책은 서버 DB에서 읽고 기업 일치·현재 상태·발급기관 신뢰·자격 서명·정책 hash를 검사합니다. 원본 속성을 직접 보낸 요청은 거절합니다.
- 서버의 `evaluate` 결과와 회로 결과를 비교하고 불일치하면 저장하지 않습니다. 실행 중 DB 변경이 발생하면 낙관적 잠금으로 저장을 거절합니다.
- 지역은 정확한 문자열 비교를 회로 내부의 로컬 코드로 매핑합니다. 표준 지역 코드 체계가 아닙니다. 업력은 UTC 개월수 규칙을 단일 설립일 경계로 변환하되, 월말 rollover로 동등 변환이 불가능한 정책/시점은 명시적으로 거절합니다.
- 원본과 회로 결과를 대조한 최근 100개 실행 기록 및 감사 이벤트를 저장합니다. 기록은 당시 실행 결과이며 향후 취소·정책 변경을 반영하는 실시간 인증서가 아닙니다.
- 실행 결과는 업무 요청의 제출/승인 상태를 변경하지 않습니다. 원본 자격·권한의 수신 검증은 기존 제출 경로에서 다시 수행합니다.
- 브리지는 loopback에만 bind하고 브라우저 Origin을 거절합니다. 입력 크기·형식·정수 범위를 검사합니다. 같은 호스트의 프로세스를 막는 인증 시스템은 아닙니다.

**중요한 경계**: 매 실행은 독립적인 로컬 회로 상태와 임시 키를 사용합니다. 세션 간 replay 방지 또는 지속적인 체인 상태가 아닙니다. 서버와 로컬 브리지는 원본 속성을 볼 수 있습니다. 원본 Ed25519 자격의 서명 검증은 회로 밖에서 수행되고, 회로는 로컬 브리지의 새 Schnorr 서명을 검증합니다. 따라서 원래 발급자의 체인 attestation, 영지식 proof 생성, 사용자의 지갑 서명, 온체인 확정과 동일하지 않습니다.

ZKLoan의 대출 실행·자산 지급·상환 기능은 기업 자격 서비스에 불필요하여 제외했습니다. 실제 Midnight 지갑·증명 서버·indexer·배포 연결은 Docker 엔진이 실행되지 않아 여전히 미완료입니다. 암호화된 지속 private-state provider도 이번 임시 실행 경로에는 사용하지 않습니다.

검증 명령:

```powershell
node --test contracts/test.mjs contracts/request-runner.test.mjs
node tests/compact-policy.cjs
node tests/compact-request.cjs
```

최종 확인: 회로/adapter 10개 테스트, 업력 경계 변환, 실제 저장된 자격·정책 API, 고객 입력 위조 거절, 역할 제한, 취소된 요청 거절, 요청 상세 브라우저 실행 및 모바일 검사 통과.

## Midnight Verifiable Credentials 코어 적용 (2026-09-20)

공식 `@midnight-ntwrk/credential-model@0.1.0-rc3`를 실제 npm 의존성으로 추가했습니다. 검토한 저장소 커밋은 `2073f4abedd6a76f8f344b513f219e9f65c32b59`입니다. GitHub main과 배포된 rc3의 API가 다르므로 설치된 공개 API를 기준으로 구현했으며, 상위 저장소 내부 소스/생성물을 import하지 않습니다.

### 적용한 핵심

- 기업 자격 family 식별자·semantic version·스키마 ID/버전·claim path·필수 속성·공개 방식·기능 metadata를 정의하고 `defineCredentialFamily` / `assertCredentialFamilyDefinition`으로 검사합니다.
- 스키마 화면의 ‘Family 메타데이터’ 버튼으로 직렬화 가능한 정의와 descriptor hash를 다운로드합니다. `predicate-only`는 BizProof 업무 공개 정책을 설명하는 metadata이며 패키지 자체가 ZK 비공개를 강제하는 것은 아닙니다.
- 새 자격은 `proofVersion: 2` 및 서명된 `familyBinding`을 포함합니다. family ID/version, schema version, descriptor hash가 정확히 일치해야 합니다. 신규 스키마 버전 발행은 기존 자격을 바꾸지 않습니다.
- 발급 서명은 `bizproof:credential:issuance:v2`, 제출 서명은 `bizproof:credential:presentation:v2` context로 분리합니다. 명세의 용도 구분 원칙을 BizProof Ed25519 서명에 적용했으며 Midnight 코어의 canonical binary/Schnorr proof와 동일한 형식은 아닙니다.
- 새 제출 결과는 원본의 schema ID와 서버가 계산한 credential payload digest를 서명에 포함합니다. 검증 시 원본 전체로 재계산하여 대조합니다. 호출자가 제공한 root/hash만으로 승인하지 않습니다.
- 자격 상세의 ‘자격 무결성 검사’에서 원본 서명, 발급기관 신뢰, 취소/만료, 시간 순서, 스키마 연결, 기업 연결을 별도로 검사하고 결과를 다운로드합니다. 결과는 검사 시점 기준입니다.
- 기존 V1 자격은 기존 payload로 검증하고 구형 형식임을 표시합니다. V2의 version/스키마/속성을 바꾸면 서명 검증에 실패합니다.
- 스키마 연결 검사를 일반 제출·담당자 권한·로컬 Compact 요청 경로에 적용했습니다.

### 적용 범위

이 저장소는 앱이나 교환 프로토콜을 제공하지 않습니다. 이번에 직접 사용하는 것은 공개 model 패키지와 그 family validation입니다. `credential-compact`의 전체 canonical VC/VP 회로, status/holder/signer-authorization proof를 기존 ZKLoan 회로에 이식한 것은 아닙니다. 서로 다른 서명 체계를 동일한 형식으로 취급하지 않습니다. 실제 사용자 지갑 소유 증명, 외부 trust registry, W3C/OpenID 교환 적합성 및 실제 온체인 proof는 여전히 미연결입니다. rc3 codec은 JSON 직렬화/역직렬화용이며 자격 수락은 별도 서버 검증 경로를 통과해야 합니다.

구현: `lib/credential-family.ts`, `lib/domain.ts`, `app/api/platform/route.ts`, `app/credential-integrity.tsx`.

검증: `node tests/credential-family.cjs`, `node tests/credential-domains.cjs`. V1 호환, V2 발급, metadata 연결, 스키마/속성/버전 위조 거절, VP 원본 연결, 키 교체, 취소와 서명 상태 분리, 서명 context 혼용 방지, 공식 패키지의 중복 claim 거절, 브라우저·모바일 확인을 통과했습니다.

참고: https://github.com/midnightntwrk/midnight-verifiable-credentials


## walt.id Wallet v2 기능을 참고한 지갑·제출 개선 (2026-09-20)

waltid-identity의 발급자/지갑/검증자 분리와 Wallet v2의 credential management/matching/presentation 흐름을 참고해 기존 BizProof 내부에 구현했습니다.

- 지갑: 즐겨찾기, 최대 30자 분류, 보관함과 복원, 분류·상태 필터, 분류 포함 검색. 원본 자격을 변경하지 않는 별도 `walletEntries` 데이터로 저장합니다.
- 보관은 표시 설정이므로 자격의 법적/암호학적 취소를 의미하지 않습니다. 보관 자격은 추천 목록 선택에서 제외하지만 다른 경로의 유효성 자체는 바뀌지 않습니다.
- 요청 상세의 ‘맞는 자격 찾기’는 같은 기업의 자격만 대상으로 서버에서 원본 서명·스키마·현재 상태·발급자 신뢰·정책 허용 발급자를 확인합니다.
- 사용할 수 없는 자격과 조건만 미충족인 자격을 구분합니다. 미충족 결과도 기존 업무 정책에 따라 제출할 수 있습니다. 추천 결과는 참고용이며 실제 제출/수신 확인에서 다시 검증합니다.
- 자격 선택 시 이전 동의와 담당자 권한 선택을 초기화하고, 수신기관·공유 정보·원본 제외 범위를 미리 보여줍니다.
- 구매/지원기관 역할은 지갑 개인 정리 정보를 받지 않으며 매칭 API도 호출할 수 없습니다. 기업 역할은 개인 샌드박스 단위 관리입니다.
- 신규 API 작업: `wallet-organize`, `match-request`. 변경과 검색은 감사 이력에 기록됩니다.

**프로토콜 범위**: walt.id의 Kotlin 서비스, DID resolver, SD-JWT/mdoc, OID4VCI/OID4VP, DCQL 파서, 외부 지갑 교환, KMS를 연결한 것은 아닙니다. 코드 복사나 패키지 직접 사용 없이 기능 원칙을 BizProof의 기존 TypeScript/API에 맞춰 구현했습니다. 특히 ‘맞는 자격 찾기’는 BizProof 정책 평가로 동작하며 DCQL 호환 구현으로 주장하지 않습니다.

검증: `node tests/wallet-matching.cjs`. 즐겨찾기/분류 저장, 보관/복원, 자격 상태 보존, 개인정보 역할 필터, 기업 범위 검색, 신뢰 중지, 원본 수치 제외, 취소 요청 거절, 브라우저 및 모바일 통과.

참고: https://github.com/walt-id/waltid-identity 및 https://docs.walt.id/community-stack/wallet2/getting-started

## Privado ID Issuer Node를 참고한 발급기관 운영 (2026-09-20)

기존 발급·취소·기관 키 관리에 더해, 신뢰 발급기관 화면에 ‘발급기관 운영 센터’를 추가했습니다. issuer-node의 issuer state 관리와 자격 운영 UI를 BizProof에 맞게 적용했습니다.

- 발급기관별 전체·유효·취소·만료·30일 내 만료 자격 집계.
- 최대 20개 자격의 일괄 취소: 대상 기업/자격과 사유를 검토하는 화면. 서버에서 권한·동일 발급기관·중복 ID·현재 취소 상태를 확인하고 전부 함께 저장합니다.
- 검토 당시 상태 hash를 서버에서 재계산해 변경이 있으면 409로 거절합니다. DB 버전 동시성 검사도 유지합니다. 취소한 자격은 기존 제출·담당자 권한 검증 경로에서도 사용할 수 없습니다.
- 발급기관의 공개 키·신뢰 상태, 자격 본문/서명 hash·취소 상태, 담당자 권한 상태를 해시로 묶어 Ed25519 서명 상태 기록을 생성합니다. 원본 속성·개인 키는 내려받는 파일에 포함하지 않습니다.
- 상태 기록은 순번과 이전 기록 hash로 연결합니다. 같은 저장 상태의 반복 기록은 기존 결과를 반환합니다. 신뢰 중지 기관은 새 기록에 서명할 수 없습니다.
- 기록 검사에서는 서명, 바로 이전 기록 연결, 현재 저장 상태 일치, 현재 발급기관 신뢰를 각각 표시합니다. 키 교체 전 기록은 보존 공개 키로 검사합니다. 검증은 서버에 저장된 기록을 대상으로 하며 임의 외부 파일 업로드 검증은 제공하지 않습니다.
- 상태 기록은 로그인한 관리자/발급기관에게만 검사 기능을 제공하며, 구매/지원기관 API 응답에서는 제외합니다. 개인 샌드박스의 발급기관 역할은 해당 워크스페이스 내 기관들을 관리합니다.

저장 상태 hash는 발급·취소·키·권한 등의 데이터 변경을 감지합니다. 시간 경과에 따른 만료는 각 자격 검증에서 별도로 검사합니다. 현재 hash가 같다고 모든 자격이 유효하다는 뜻은 아닙니다. DB 운영자가 전체 이력을 다시 쓰는 공격에 대한 외부 불변성은 보장하지 않습니다.

**실제 연동 범위**: Privado ID의 Go issuer-node, Iden3 Merkle tree/revocation proof, RHS, Polygon state transition, KMS/Vault, 외부 지갑 연결을 실행한 것은 아닙니다. 자체 TypeScript 구현이며 상태 기록은 로컬 감사용입니다. Midnight/Polygon 온체인 게시가 아닙니다. 기존 Midnight 조건 회로와 서로 다른 체인/자격 형식을 혼합하지 않았습니다.

구현: `lib/issuer-operations.ts`, `app/issuer-operations.tsx`, `app/api/platform/route.ts`. 선택적 `issuerSnapshots` 배열로 기존 저장소와 호환됩니다.

검증: `node tests/issuer-operations.cjs`. 서명 기록 연결·중복 기록 방지·기록 이후 변경 감지·키 교체·일괄 취소 원자성/중복/오래된 상태 거절·권한 분리·브라우저 취소 및 기록 검증·모바일을 확인했습니다.

참고: https://github.com/PrivadoID/issuer-node

### SAP classic supplier workspace fidelity (2026-09-20)
- Reference: SAP Business Network buyer administration, Viewing and Downloading Supplier Profiles (2608), including its official Active Relationships screenshot. Recreated the dark shell, horizontal work navigation, alerts, dense supplier table, relationship tabs, row More Actions and profile Actions menus using BizProof branding and real workspace fields.
- `/\?view=companies` opens the supplier workspace; `?view=companies&supplier=<id>` opens a full-page profile with basic/extended information, credentials, evidence and relationships. History navigation and reload retain the selected company. The profile editor and original permission-checked APIs remain shared.
- Existing backend supports basic/extended CSV, profile visibility by accepted relationship and role, profile edits, suspension guards, credentials and private evidence. No SAP backend, SAP network account, DUNS service or purchase-order routing integration is implied. The full-page detail is an adaptation of the documented workflow, since the source screenshot shows the supplier list only.
- Tests: `tests/supplier-profiles.cjs` exercises server privacy, CSV injection protection, profile updates/downloads, suspension and responsive UI. `tests/supplier-navigation.cjs` exercises search, empty result, direct links, reload, browser history and mobile detail.

### GLEIF-inspired organizational identity portal (2026-09-20)
- Inspected the live GLEIF vLEI page visually and its published explanation. `/\?view=trust` now uses a light utility bar, horizontal navigation, dark-teal to pale-green title banner, left section navigation, article column, and resource rail. BizProof branding and actual workspace data remain explicit.
- Interactive Organization / Person / Role diagram links to existing workflows. Search is shared between header and authority list; the page includes trust-chain counts, authority issuance/verification/revocation, FAQ and official resources.
- `checkAuthority` now returns a three-node trace (issuer, credential, authority) including identifiers, relevant key identifiers and record status. The existing nine server-side checks remain authoritative. The trace is visible in the verification dialog and included in downloaded JSON; record status alone is not a verification verdict.
- This is an adaptation of a public informational page, not an implementation of GLEIF's internal backend or a qualified vLEI issuer. LEI lookup, personal identity assurance, KERI/ACDC validation, and the GLEIF root of trust are not connected.
- Validation: TypeScript and production build; `tests/organization-trust.cjs` for signed authority lifecycle and permissions; `tests/identity-portal.cjs` for interactive model, synchronized search, report trace/export and desktop/mobile layout. Screenshots in `outputs/gleif-portal-desktop.png` and `outputs/gleif-portal-mobile.png`.

### Truvity-inspired SSI workspace (2026-09-20)
- Visually inspected https://docs.truvity.com/ssi/. Recreated its white header, blue brand accent, product selector, left grouped navigation, breadcrumb, large article headings and right table of contents on `?view=studio`. The reference is a documentation site, not an operational console; BizProof's actual issuance workflow is embedded in that layout.
- Linked Draft / Issue / Hold / Verify navigation, shared header/list search, schema/evidence/connection navigation and mobile menu. Existing draft editing, labels, evidence references, revision conflict handling, immutable issuance and credential detail remain connected.
- Added authenticated `GET /api/platform?export=draft&id=<id>` with issuer/company/admin authorization and `Cache-Control: no-store`. The JSON includes the selected latest stored draft and an explicit unsigned/private-data notice. No issuer keys or binary attachments are exported. The UI supports preview, copy and JSON download; changing role clears the preview, and selectors are locked during the fetch.
- Truvity SDK/DIDComm integration and actual Midnight network proofs are not connected. This is an independent implementation using the existing BizProof backend.
- Validation: TypeScript and production build; `tests/issuance-studio.cjs` (lifecycle, conflicts, signatures, role isolation and mobile), `tests/ssi-portal.cjs` (draft export authorization, no-store, invalid ID, JSON download, synchronized search and mobile role change). Screenshots: `outputs/truvity-portal-desktop.png`, `outputs/truvity-portal-mobile.png`.

### Review fixes (2026-09-20)
The five reproduced issues in `docs/project-review-2026-09-20.md` have been addressed. See `docs/review-fixes-2026-09-20.md` for the changes and checks. Use `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:regression` (local demo server required), and `npm run test:contracts`. Browser regression tests use fictional workspace records and some lifecycle tests modify those records.

### Midnight.js SDK 적용 (2026-09-20)

공식 Midnight.js 4.1.1의 배포·기존 컨트랙트 재연결·회로 거래 호출, HTTP proof provider, 인덱서 조회, Node 산출물 로딩, 암호화 비공개 상태 저장을 `contracts/sdk/`에 적용했습니다. 기존 서명 업무 API와 분리한 Node.js 24 이상 전용 SDK 계층입니다.

연결 및 설정 화면에서 컴파일 산출물 검사, 실제 SDK의 미증명 배포 거래 준비 검사, 배포 주소의 공개 상태 조회를 실행할 수 있습니다. 실제 proof 생성·지갑 승인·체인 배포는 별도이며, 준비 검사를 배포 성공으로 표시하지 않습니다.

- [적용 기능·실행 방법·신뢰 경계](docs/midnight-js-integration.md)
- SDK 검증: `npm run typecheck:sdk`, `npm run test:sdk`
- SDK 화면 검증: `node tests/midnight-sdk-ui.cjs` (최신 로컬 브리지 실행 필요)
- 오프라인 준비: `node contracts/sdk/cli.ts prepare`

암호화 키·상태는 `.midnight-private/` 등 Git 제외 경로에 보관합니다. SDK에서 만든 Schnorr 자격과 웹 업무의 Ed25519 자격은 아직 자동 동기화되지 않습니다. 실제 네트워크 재사용 시나리오는 `contracts/sdk/reuse-scenario.ts`에 구현했으며, 실행 가능한 지갑 제공자와 노드·증명 서버가 필요합니다.

### DApp Connector 적용 (2026-09-20)

연결 및 설정 화면에 API 4.x 지갑 검색, 필요한 기능별 권한 안내, 계정·네트워크 변경 감지, 화면 연결 종료, 선택적 DUST·거래 내역 조회를 추가했습니다. SDK는 지갑 증명 제공자와 지갑 인덱서를 명시적으로 선택할 수 있습니다. 화면 연결 종료는 지갑의 사이트 권한을 철회하지 않으며 실제 거래 서명·전송은 아직 웹 화면에 연결하지 않았습니다.

- [적용 범위·SDK 설정·실제 지갑 검증의 한계](docs/dapp-connector-integration.md)
- `npm run test:connector` (로컬 앱과 테스트용 Edge 필요), `npm run test:sdk`

### VC-JWT 교환 및 GLEIF vLEI 검증기 어댑터 (2026-09-21)

기업 자격 화면에 서명된 VC-JWT 교환 파일·공개 did:jwk 문서 내보내기, 현재 발급 기록과 상태를 대조하는 검증을 추가했습니다. walt.id 구조를 참고한 독립 구현이며 walt.id 서버·OpenID4VCI/VP 또는 SD-JWT는 아직 연결하지 않았습니다. 교환 파일은 원본 기업 속성을 포함하므로 생성 동의를 받습니다.

연결 및 설정 화면에는 공식 GLEIF verifier의 CESR 제출·서명된 권한 조회 어댑터를 추가했습니다. AID·SAID·LEI·역할을 모두 대조하며, 202나 AID 로그인만으로 자격을 승인하지 않습니다. 현재 Docker 엔진·실제 CESR·KERI 요청 서명이 준비되지 않아 공인 vLEI 종단 검증은 미완료입니다.

- [walt.id 적용 범위](docs/waltid-integration.md)
- [GLEIF 검증기 소스 분석·실행 설정·검증 한계](docs/vlei-verifier-integration.md)
- `npm run test:identity-exchange` (로컬 앱과 테스트용 Edge 필요)
# Keycloak 로그인 및 역할 관리

선택형 Keycloak OIDC 로그인, PKCE, 서버 JWT 검증, 클라이언트 역할 제한과 계정 관리 화면을 연결했습니다. 기본 모드는 기존 데모 인증입니다. 로컬 서버·환경변수·MFA 설정과 현재 검증 범위는 [Keycloak 통합 가이드](docs/keycloak-integration.md)를 참고하세요. 인증 단위 테스트: `node tests/keycloak.cjs`.
# OpenBao 저장 데이터 보호

워크스페이스 JSON의 개인키·기업 속성을 OpenBao Transit으로 암호화하고 키 회전 후 rewrap할 수 있습니다. 기본 데모 모드에서는 외부 서버를 요구하지 않습니다. [설치·전환·복구 및 보호 범위](docs/openbao-integration.md)를 참고하세요. `npm run test:openbao`는 모의 Transit 저장 테스트와 실행 중인 데모 UI 테스트를 수행합니다.
# JSON Forms 입력 화면

공통 기업 등록·자격 발급·검증 정책 입력창을 JSON Forms 3.8.0으로 전환했습니다. 필드별 오류와 조건부 지역 입력을 제공하며 서버 검증은 유지합니다. [적용 범위와 확장 방법](docs/jsonforms-integration.md)을 참고하세요.
# Ajv 서버 검증

기업·자격 속성·정책 입력은 미리 생성한 Ajv 검증기로 형식과 범위를 검사합니다. 스키마 변경 후 `npm run generate:validators`를 실행하세요. [서버 적용 범위와 테스트](docs/ajv-integration.md)를 참고하세요.
# OPA 정책 평가

구매 등록·지원사업 자격 제출에 선택형 OPA/Rego 평가를 연결했습니다. OPA 모드에서는 기존 판정과 항목별 결과가 일치해야 저장합니다. [실행 방법·적용 범위·테스트](docs/opa-integration.md)를 참고하세요.
# 재검토 보완 및 기관 공동 업무

OPA 검색 전송·평가 시각·회귀 테스트를 수정하고, Keycloak 사용자 멤버십으로 기관 공동 공간을 연결했습니다. 실제 Keycloak/OpenBao 실행 검증과 Midnight 준비 상태는 [보완 결과 및 활성화 방법](docs/review-remediation-2026-09-21.md)을 참고하세요.
