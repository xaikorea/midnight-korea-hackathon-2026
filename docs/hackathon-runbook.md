# 심사자용 실행·검증 안내

Node.js 24.11.1, Docker Compose v2, Linux 또는 WSL2 기준. 공개 웹은 NHN의 Next.js / SQLite 배포이며 Sites 계정이 필요하지 않다.

## 웹 체험

공개 주소: https://bizproof.xaikorea.ai.kr/welcome

1. 체험 공간을 시작한다. 준비된 가상 한빛테크 자격 1개를 확인한다.
2. 구매사와 지원사업을 선택하고 공유 내용에 동의한다.
3. 한 번 제출한 뒤 기관별 결과·실제 서버 기록·새로고침 후 보관 여부를 확인한다.

이 경로는 서버가 원본 정보를 처리하는 Ed25519 업무 검증이다. 실제 사업 선정이나 각 방문자의 Midnight 거래 확정을 뜻하지 않는다. 별도의 `/verification` 페이지에서 실제 웹 자격을 Local Devnet으로 연결한 기록을 확인한다.

로컬 웹 실행:

```sh
npm ci
npm run demo:local
```

`http://127.0.0.1:3100`에서 동일한 합성 데이터 체험을 시작한다. 개발용 세션 비밀과 DB는 Git에서 제외된 `outputs/local-web-demo`에 보관한다. 검증에는 관리자 비밀번호가 필요하지 않다.

## 새 환경에서 Compact 컴파일과 SDK 검사

```sh
docker compose -p bizproof-devnet -f contracts/standalone.yml build runner
```

생성 자산이 없는 체크아웃에서 의존성을 설치하고 공식 배포 파일의 SHA-256을 확인한 뒤 Compact 0.31.1로 9개 회로를 컴파일한다. Docker 빌드 안에서 계약·SDK·지갑 어댑터·웹 원본 연결 검사도 실행한다.

고정 조합: Compact 0.31.1 / compact-runtime 0.16.0 / Midnight.js 4.1.1 / ledger-v8 8.1.0 / onchain-runtime-v3 3.0.0 / wallet-sdk 1.2.0. 서로 다른 WASM 런타임 인스턴스가 섞이면 `StateValue` 오류가 나므로 lockfile과 override를 함께 사용한다. 새 버전을 혼합해 설치하지 않는다.

## 실제 Local Devnet 거래

```sh
docker compose -p bizproof-devnet -f contracts/standalone.yml up -d node proof-server indexer
docker compose -p bizproof-devnet -f contracts/standalone.yml ps
docker compose -p bizproof-devnet -f contracts/standalone.yml run --rm --no-deps runner
```

노드·인덱서 준비 후 실행한다. 실행기는 컨트랙트 배포 → 발급자 등록 → 동일 자격으로 구매사/지원사업/미충족 검증 → 자격 취소 → 재사용 차단을 수행한다. 공식 SDK와 증명 서버가 실제 거래를 생성한다. 지갑은 해당 로컬 네트워크에서만 사용하는 공개 genesis 지갑이다. 사용자의 실제 자금이나 실서비스 지갑을 연결하지 않는다.

새 노드에서는 DUST가 조금 생겼더라도 실제 수수료에는 부족할 수 있다. 실행기는 제출 전 잔액 계산이 DUST 부족으로 실패한 경우에만 최대 4분 동안 자원 누적을 기다린다. 노드 오류나 이미 제출한 거래를 자동 재전송하지 않는다. `dust-accumulating`은 성공·거래 확정을 뜻하지 않는다.

출력: `outputs/midnight-devnet/report.json`, `receipts.json`, `events.json`. `private/`는 암호화된 개발용 비공개 상태이며 제출 자료로 배포하지 않는다. 새 실행에서는 새로운 계약과 자격을 만든다.

## 실제 웹 자격·원래 요청 연결

웹 데모가 실행 중이어야 한다. Linux Docker host networking을 사용하므로 WSL에서는 웹 서버도 같은 Linux 호스트에서 실행하거나 아래 공개 합성 데모를 사용한다.

```sh
docker compose -p bizproof-devnet -f contracts/standalone.yml run --rm --no-deps \
  -e BIZPROOF_WEB_ORIGIN=https://bizproof.xaikorea.ai.kr \
  runner node contracts/sdk/run-web-devnet.ts outputs/midnight-web-devnet
```

로컬 웹이라면 `BIZPROOF_WEB_ORIGIN=http://127.0.0.1:3100`으로 바꾼다. 이 실행기는 자신만의 신규 합성 체험 공간을 생성하고 다른 방문자의 공간은 조회하지 않는다.

1. 실제 웹 DB의 준비된 Ed25519 자격과 대기 중인 두 요청을 읽는다.
2. 인증된 API로 계약·보유자·요청에 묶인 서명 원본을 발급받는다.
3. 인증된 웹 상태에서 확보한 발급자 공개키로 서명을 검증한다. 실행 단계마다 원본 취소·만료·요청 변경을 다시 검사한다.
4. 원본 digest에 묶인 Schnorr attestation을 발급하고 두 기관의 원래 조건을 실제 체인에서 검증한다.
5. 같은 자격·원래 요청의 일반 웹 제출을 완료하고 연결을 대조한다. 웹 결과를 자동으로 ‘ZK 방식’으로 바꾸지 않는다.
6. 미충족과 체인 자격 취소 후 차단을 검사한다. 웹 원본 자격 취소와 체인 attestation 취소는 별도이다.

완료 보고서: `outputs/midnight-web-devnet/report.json`. 서명 원본에는 민감한 속성이 포함되므로 공개 보고서에 넣지 않는다. 단기 원본의 유효기간은 10분이며, 초과 시 실패한다. 기존 거래를 성공으로 추정하거나 자동 재전송하지 않는다.

## 증거 해석

원래 Devnet을 유지한 상태에서 지갑·개인 상태 없이 인덱서를 독립적으로 대조할 수 있다.

```sh
docker compose -p bizproof-devnet -f contracts/standalone.yml run --rm --no-deps \
  runner node contracts/sdk/verify-evidence.ts \
  outputs/midnight-web-devnet/report.json outputs/midnight-web-devnet/independent-verification.json
```

이 명령은 모든 거래의 상태·해시·블록, 컴파일된 검증 키, 세 요청의 판정, 원본 digest의 취소 등록을 조회한다. 저장된 공개 기록의 원래 노드가 사라졌다면 새 실행으로 생성한 보고서를 사용한다.

공개 파일을 갱신하려면 `node scripts/publish-midnight-evidence.cjs outputs/midnight-web-devnet/report.json`을 실행한다. 허용된 공개 필드만 내보내며 원본 속성과 개인 상태를 복사하지 않는다.

- `SucceedEntirely`와 블록 정보를 가진 영수증은 그 실행에서 확정된 거래이다.
- 제출 API 응답·애니메이션·컴파일 테스트만으로 거래 확정을 대신하지 않는다.
- 미충족은 정상적인 false 판정이다. 취소 자격은 회로 실행에서 차단되므로 성공 영수증이 생기지 않는다.
- 정적 보고서는 기록 당시의 증거이다. 로컬 체인을 삭제하거나 새로 시작하면 과거 주소가 조회되지 않을 수 있다.
- `/verification`의 로컬 현재 상태 대조는 로그인된 로컬 웹 + `node contracts/bridge.mjs` + 동일 Devnet이 필요하다. 공개 사이트에서는 이 로컬 브리지에 접근하지 않는다.

검증을 마쳤다면 컨테이너를 중지한다. 기록을 재조회하려면 같은 노드를 유지한다.

```sh
docker compose -p bizproof-devnet -f contracts/standalone.yml stop
```

## CI

`Core verification`은 웹 타입·단위 검사·Node 런타임·Next 빌드를 수행한다. `Compact verification`은 새 Docker 환경의 컴파일과 SDK 검사를 수행한다. GitHub Actions의 수동 실행에서 `network_demo`를 켜면 별도 Local Devnet의 실제 거래 검사도 수행한다.
