# Midnight.js 핵심 기능 적용

적용일: 2026-09-20. 기준은 [공식 Midnight.js](https://github.com/midnightntwrk/midnight-js)와 실제 설치한 4.1.1 패키지의 타입·구현이다. 기존 ZKLoan 기반 Compact 0.31.1 / runtime 0.16.0과 맞춰 버전을 고정했다.

## 적용한 기능

| SDK 기능 | 실제 코드 | 적용 내용 |
|---|---|---|
| CompiledContract | `contracts/sdk/contract.ts` | 기존 BizProof의 회로·witness·컴파일 산출물을 공식 SDK 계약 객체로 구성 |
| deployContract | `contracts/sdk/client.ts` | 관리자 비밀값 생성, 생성자 시간 인자, 비공개 상태·유지보수 키 저장, 확정 영수증만 반환 |
| findDeployedContract | 같은 파일 | 주소·현재 검증 키 확인, 기존 계정의 상태 복원, 기존 비밀값 덮어쓰기 방지 |
| submitCallTx | 같은 파일 | 발급자 등록·중지·재개, 요청 생성·취소, 보유자 제출, 자격 취소, 관리자 기준 시간 갱신 |
| HTTP proof provider | 같은 파일 | SDK의 prove/balance/submit/확정 흐름에 실제 proof provider 연결. 5분 증명 타임아웃 |
| NodeZkConfigProvider | `contracts/sdk/public-state.ts` | 9개 회로의 prover/verifier/IR 파일 실제 로딩, 검증 키 SHA-256·크기 검사 |
| Indexer public data provider | 같은 파일 | 실제 계약 상태 조회, 요청 결과 조회, 공개 상태 구독과 오류 콜백 |
| verifyContractState | 같은 파일 | 조회·구독 상태의 검증 키가 현재 BizProof 회로와 일치하는지 검사 |
| Level private state provider | `contracts/sdk/storage.ts` | SDK 암호화 저장 사용, 네트워크·계정·역할별 경로, 계약별 상태 범위, 명시적 종료 |
| 지속적인 발급자 신원 | `contracts/sdk/issuer.ts` | 암호화 저장소에 Schnorr 발급자 키 저장·복원, 같은 키로 보유자에 묶인 자격 발급 |
| WalletProvider / MidnightProvider | `contracts/sdk/wallet-adapter.ts`, `facade-adapter.ts` | DApp Connector 및 초기화된 WalletFacade 어댑터, 거래 균형 조정·전송, 계정/네트워크 변경 검사 |
| 거래 결과 공개 DTO | `publicReceipt` | 전체 성공 확정 거래의 ID·해시·블록 정보만 반환. SDK의 private·tx·witness를 응답에 섞지 않음 |
| 실제 재사용 orchestration | `contracts/sdk/reuse-scenario.ts` | 공급된 지갑으로 배포→발급자 등록→자격 1건→구매/지원/미충족→취소 및 재사용 차단을 순차 실행 |

계약의 유지보수 권한·검증 키를 제거/교체하는 일반 관리 인터페이스는 공개하지 않았다. 현재 기업 자격 사용 흐름에 필요하지 않고 계약의 신뢰 규칙을 변경하기 때문이다. 관리자 비밀값 교체 회로도 안전한 인계·복구 절차가 갖춰지기 전 자동화하지 않는다.

## 웹에서 사용하는 기능

`http://localhost:5173/?view=settings`의 **Midnight.js 실행 및 체인 조회**:

1. **컴파일 산출물 검사**: 실제 파일 9세트와 검증 키 해시를 조회한다.
2. **SDK 배포 거래 준비 검사**: 공식 SDK로 생성자와 미증명 배포 거래를 구성한다. 임시 가상 키만 사용하며 실제 proof·지갑 거래·배포는 수행하지 않는다.
3. **체인 공개 상태 조회**: 64자리 컨트랙트 주소와 선택적인 체인 요청 식별값으로 조회한다. 다른 계약의 검증 키이면 결과를 표시하지 않는다. 체인 요청 식별값은 웹 업무 requestId 문자열과 다르다.

웹 API `/api/midnight-sdk`는 로그인·로컬 호스트·출처·역할을 확인한다. 임의 서비스 URL·파일 경로·회로 이름·거래 전송 명령을 입력받지 않는다. 브리지 응답도 Zod 허용 필드로 제한한다. 원본 비공개 상태, 서명 비밀키, 미증명 거래, SDK 객체 전체는 전송하지 않는다.

현재 웹의 지갑 연결 패널과 Node SDK 거래 실행 계층은 아직 자동 연결되지 않았다. 웹 패널은 지갑 주소·설정 확인까지이고, 실제 거래 실행은 개발자가 제공한 WalletBinding을 사용한다. 브라우저 어댑터가 있다는 이유로 Node에서 브라우저 확장 지갑을 직접 사용할 수 있다고 가정하지 않는다. 브라우저 전체 SDK 실행 또는 인증된 지갑 전달 계층을 연결하는 작업이 남아 있다.

## 실행

SDK 브리지와 CLI는 **Node.js 24 이상**이 필요하다. TypeScript 파일을 Node의 타입 제거 기능으로 실행한다. 웹 앱만 실행하는 기존 Node 버전 요구와 구분한다.

```powershell
npm --prefix contracts ci
# 컴파일 산출물이 없으면 Compact 0.31.1로 기존 contracts/bizproof.compact를 컴파일
node contracts/bridge.mjs
```

별도 터미널:

```powershell
node contracts/sdk/cli.ts manifest
node contracts/sdk/cli.ts prepare
node contracts/sdk/cli.ts inspect undeployed <64자리-컨트랙트-주소> [64자리-요청-ID]
npm run typecheck:sdk
npm run test:sdk
node tests/midnight-sdk-ui.cjs
```

기본 브리지 네트워크는 `undeployed`이다. `BIZPROOF_MIDNIGHT_NETWORK=preprod`로 설정하고 브리지를 재시작하면 고정된 공식 preprod 인덱서를 조회한다. proof server는 로컬 6300을 사용한다. SDK는 전역 network-id를 사용하므로 한 거래 실행 프로세스에서는 네트워크 변경을 거절한다.

Docker 실행 구성은 `contracts/standalone.yml`을 사용한다. 현재 컴퓨터에서는 Docker Linux 엔진 파이프가 응답하지 않아 실제 노드·인덱서·proof server 실행을 검증하지 못했다.

## 실제 거래를 실행하는 개발 API

`BizProofClient`에는 `network`, `WalletBinding`, `role`, `storageDirectory`, `passwordProvider`를 제공한다. 암호를 코드에 하드코딩하거나 지갑 주소에서 파생하지 않는다. SDK의 암호 강도 정책을 그대로 적용한다. `.midnight-private/` 등 Git 제외 경로를 사용한다.

- Node Wallet SDK를 사용할 때는 이미 초기화·동기화한 WalletFacade를 `bindWalletFacade`에 제공한다. `assertReady`에서 계정·네트워크·동기화 상태를 확인한다. 지갑 생성, 자금 준비, 시작/종료는 지갑 소유자가 관리한다.
- DApp Connector를 사용할 때는 확장이 승인한 ConnectedAPI를 `bindDappWallet`에 제공한다. 서명 요청 전과 이후에 네트워크·계정이 유지되는지 확인한다.
- 관리자 클라이언트로 `deploy()` 후 반환된 공개 영수증을 보관한다. 이미 배포한 계약은 `join(address)`을 사용한다. 개인 상태가 없으면 임의로 새 관리자 비밀값을 만들어 덮어쓰지 않는다.
- 보유자는 `enrollHolder(address)`로 계약별 비밀값과 공개 holder를 만든다. 발급자는 `IssuerVault`의 공개키를 등록한 뒤 해당 holder에 묶인 자격을 한 번 발급한다. 보유자는 `storeAttestation`으로 저장하고 여러 `submit` 호출에 재사용한다.
- `storeAttestation`은 저장 단계이며 서명 검증 성공이라고 표시하지 않는다. 서명은 실제 submit 회로에서 검증한다.
- `runNetworkReuse`는 가상 매출 3억 원 등의 고정 의미 데이터를 사용해 전체 흐름을 실행한다. `onReceipt`로 각 확정 거래의 공개 정보만 저장한다. 이 함수는 테스트 지갑의 실제 거래를 발생시키므로 준비된 환경에서 명시적으로 실행한다. 이번 작업에서는 실행하지 않았다.
- 네트워크 오류가 난 실제 거래를 자동 재전송하지 않는다. 지갑·인덱서의 거래 ID와 현재 계약 상태를 대조한 후 복구해야 한다. SDK 호출이 대기하는 동안 같은 클라이언트의 다른 변경 작업을 거절한다.

## 중요한 경계

웹 업무 자격은 Ed25519이고 SDK 경로는 Schnorr이다. 두 경로의 기업/발급자 신원, credentialId, 정책 스냅샷, 취소 상태를 자동 동기화하는 어댑터는 아직 없다. `IssuerVault`는 입력 값의 서명과 보유자 결합을 제공하며 기업 매출의 사실성을 확인하지 않는다.

컨트랙트의 시간은 관리자 `advanceTime` 값이다. 실제 네트워크에서 적절히 갱신해야 하며 체인 시간 오라클로 완성된 설계가 아니다. 공개 holder·자격 취소 식별값은 연결 가능하다. 공개 상태 조회에서 발견한 eligible은 해당 체인 기록이며 현재 모든 업무 요건을 새로 검증한 결과로 표현하지 않는다.

SDK의 Level provider는 개발 단계의 암호화 저장소로 사용했다. 디스크·암호를 잃으면 복구할 수 없다. `exportEncryptedState`는 비공개 상태의 암호화 내보내기이며 유지보수 signing key 전체 백업을 대신하지 않는다. 운영에는 별도의 키·백업·복구 체계가 필요하다.

## 검증 결과

- 공식 SDK가 실제 컴파일된 생성자와 registerIssuer 회로를 실행하고 미증명 거래를 구성하는 것 확인.
- 9개 산출물 로딩 및 공식 SDK의 계약 검증 키 대조 확인.
- 암호화 저장소 종료·재열기, 발급자 키 유지, 계정/계약 분리, 잘못된 암호 거절, 암호화 내보내기와 디스크 평문 노출 방지 확인.
- 지속 발급자의 자격 1건을 기존 실제 Compact 회로에서 구매·지원 조건에 재사용하고 속성 변조를 거절하는 것 확인.
- 지갑 어댑터의 공개키 변환, 네트워크·계정 변경 거절, 잘못된 거래 응답 거절 확인. 실제 지갑 확장 연결 검증은 아님.
- 실제 웹→브리지→SDK의 산출물/준비 검사, 인증·출처·역할 제한, 잘못된 입력, 모바일 확인.
- TypeScript(앱/SDK), ESLint, 웹 프로덕션 빌드 통과. 기존 Compact 10개 + SDK 5개 테스트 통과.
- 실제 proof 생성, 지갑 승인, 체인 배포·거래 확정 및 live subscription은 미검증. offline/in-memory 테스트를 이 항목의 완료 근거로 사용하지 않는다.

## 호환성 보완과 라이선스

wallet-sdk-address-format 3.1.2의 `parse`가 scure 기본 90자 제한으로 긴 shielded 주소를 거절하는 문제를 테스트에서 재현했다. 어댑터에서 길이를 200자로 제한하고 checksum·정확한 네트워크 prefix·64바이트 본문 검사를 유지한 뒤 공식 주소 codec으로 검증하도록 보완했다. 의존성 소스 자체는 수정하지 않았다.

SDK 패키지군은 Apache-2.0이다. Schnorr 재사용 고지는 `contracts/LICENSE-APACHE-2.0`를 유지한다. 설치한 패키지의 LICENSE/NOTICE도 배포 시 보존한다. 의존성 검사에서 발견한 ws 문제는 8.21.3으로 수정했으며 최종 contracts npm audit에서 알려진 취약점 0건을 확인했다. 이는 전체 서비스 보안 감사를 의미하지 않는다.
