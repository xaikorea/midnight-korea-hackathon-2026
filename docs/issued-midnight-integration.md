# 별도 발급 자격의 Midnight 작업

이 문서는 구현·운영 설명이다. 공개 합성 체험의 자격 1개와 **이미 제출한 구매사·지원사업 요청 두 개**를 선택하며, 이전 빠른 체험이나 저장된 네트워크 증거로 바꿔 처리하지 않는다.

## 사용 흐름

1. `/issuance`에서 별도 기관 자격을 받고 같은 자격으로 두 기관에 신청한다.
2. `/chain-jobs` 또는 발급 화면 하단에서 90분 유효한 별도 공유 동의를 하고 실행을 요청한다.
3. 서비스 관리자가 `/admin/proof-jobs`에서 정확한 자격·두 요청을 보고 승인한다. 방문자의 업무 역할 전환으로 이 승인을 얻을 수 없다.
4. 별도 환경의 실행기가 승인된 작업만 가져온다. 3분 lease를 30초마다 갱신하며, 만료된 실행은 자동 재전송하지 않는다.
5. 발급기관 원본 서명과 플랫폼 작업 서명을 서로 다른 고정 신뢰 키로 확인한다. 기관 현재 상태를 각 증명 전·제출 전·결과 등록 시 재조회한다.
6. 새 계약에 원래 수신자·정책·nonce·요청을 연결하고 Schnorr attestation을 재사용한다. Compact 회로가 Ed25519 자체를 검증하는 것은 아니다.
7. 실행기는 확정 영수증을 등록한다. 별도 검증기는 지갑 없이 compiled verifier keys, 거래의 계약·호출, 블록, 정책·holder·nonce·결과를 인덱서에서 대조한다. 검증기 서명이 확인되어야 최종 완료로 표시한다.
8. 기관 취소는 웹 재사용을 즉시 막는다. 진행자가 같은 실행기를 다시 실행하면 원래 계약의 취소 거래를 전송하고 별도 검증 후 `체인 취소 확인`으로 바뀐다. 원래 체인이 없으면 대기·미확인 상태를 유지한다.

웹 서버와 실행기는 합성 원본 속성을 처리한다. 실행기와 읽기 전용 검증기는 같은 개발 호스트에서 운영할 수 있지만 서로 다른 자격 증명을 사용한다. 이는 독립 조직의 공증을 의미하지 않는다. Local Devnet을 상시 운영하거나 Preprod/메인넷에 배포한 것으로 표시하지 않는다.

## 실행기 준비

기존 기관·플랫폼 키와 앱 출처 환경을 읽는 **서버 안에서** `node scripts/provision-proof-worker.mjs /srv/bizproof/proof-worker-config`를 실행한다. 생성되는 `proof-jobs.env`만 웹의 `/srv/bizproof/secrets/proof-jobs.env`에 설치한다. `executor.json`, `verifier.json`은 각각 실행 환경으로 비공개 전달한다. 키나 설정을 표준출력·Git·브라우저에 넣지 않는다. 기존 파일 일부를 잃으면 새로 생성하지 않고 해당 백업을 복구한다.

로컬 `npm run demo:issuer`는 `outputs/.../worker-config`에 별도 테스트 설정을 만든다. 계약 SDK는 기존 고정 버전과 `contracts/standalone.yml`을 사용한다.

```sh
export BIZPROOF_PROOF_CONFIG=/private/executor.json
node contracts/sdk/run-issued-job.ts JOB_UUID /private/job-state
export BIZPROOF_PROOF_CONFIG=/private/verifier.json
node contracts/sdk/verify-issued-job.ts JOB_UUID /private/job-state
```

취소 동기화도 같은 두 명령을 **동일한 JOB_UUID와 비공개 저장 디렉터리**로 실행한다. 작업별 `private-journal.json`에는 비공개 저장소 암호가 있으므로 공유하지 않는다. 공개할 자료는 `execution-receipts.json`, `independent-verification.json`, `revocation-verification.json` 등 검토한 출력으로 제한한다.

## 장애와 복구

- 영수증 저장 실패는 비공개 journal의 완료 기록으로 중복 없이 다시 전달한다.
- 전송 이후 중단된 경우 관리자가 `기존 거래 대조 후 이어서 처리`를 승인한다. 실행기는 저장된 거래 ID를 먼저 인덱서에서 확인한다. ID를 잃었거나 확정 여부를 확인할 수 없으면 실패를 유지하고 재전송하지 않는다.
- 키·암호화 저장소·원래 체인을 잃은 경우 새 계약으로 조용히 바꾸지 않는다. 새 동의와 별도의 체험으로 시작한다.
- 취소 상태와 체인 확정은 분산 트랜잭션이 아니다. 취소와 제출이 경합하면 웹 사용을 차단하고 체인 취소 반영 대기를 표시한다. 과거 거래는 삭제되지 않는다.
- 실행 이벤트·영수증·lease는 웹 SQLite 백업에 포함된다. 서버 설정 백업과 실행기의 비공개 저장소 백업은 별도로 관리한다.

## 본인확인과 문서 서명

`lib/identity-provider.ts`의 PortOne V2 어댑터는 서버 조회로 `VERIFIED`, 원래 거래 ID·채널·TEST/LIVE·문서 연결용 customData·시간을 확인한다. CI/DI·이름·전화번호·PG 응답 원문은 반환·저장하지 않고 별도 비밀키로 만든 내부 subject reference만 남긴다. 임시 파일럿 세션은 만료 후 24시간이 지나면 조회/생성 시 정리한다.

`POST /api/identity/sessions`는 공개 체험을 거부한다. 별도 Keycloak 파일럿과 허용 사용자, `BIZPROOF_IDENTITY_PILOT=true`, `BIZPROOF_PORTONE_CONFIG`가 필요하다. 공급자 미설정은 성공으로 대체하지 않는다. 브라우저의 성공 파라미터나 콜백 본문만으로 완료시키지 않는다. 현재 공개 발급기는 **계속 합성 동의만 지원**하며 이 결과를 실제 기업 자격으로 자동 승격하지 않는다.

실제 인증 계정이 없어 공급자 테스트는 계약 fixture로 수행한다. 상용/테스트 채널 발급, 공급자 화면 연결과 인수시험은 계정 준비 후 진행해야 한다. 본인확인은 문서 전자서명·기업 대표권의 증거가 아니며 `DocumentSigningProvider`는 별도 공급자 규격을 연결할 경계만 준비되어 있다. 공동인증서의 유효성·폐지·서명 검증 구현은 공급자 선정 후 남은 작업이다.

공식 규격: [PortOne V2 본인인증](https://developers.portone.io/api/rest-v2/identityVerification), [브라우저 요청 형식](https://developers.portone.io/sdk/ko/v2-sdk/identity-verification-request), [카카오 인증 개요](https://developers.kakao.com/docs/ko/kakao-certification/common).
