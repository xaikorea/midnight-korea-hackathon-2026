# BizProof 제출 준비 기록

기술 보완 기준일: 2026-09-25 KST. [공개 구성](public-deployment.md)에서 현재 검증 범위와 운영 예제를 확인한다.

## 프로젝트 설명

**기업 자격 한 번, 구매사 등록과 지원사업 조건을 각각 증명.** BizProof는 같은 기업 자격을 여러 기관에 재사용하는 업무 시제품이다. 기업은 신청 대상과 정보 공유만 확인한다. Compact 회로는 민감한 기업 속성을 비공개 입력으로 받아 각 기관의 서로 다른 정책을 판정한다.

**English:** BizProof reuses one business credential to prove eligibility for supplier onboarding and a support program. The public web demo offers a three-step business flow. A separately executed, reproducible Midnight Local Devnet path binds a real web-issued credential and its original requests to Compact proofs, finalized transactions, a negative eligibility result, and revocation enforcement.

## 정상 완료와 취소 검증

별도 실행 환경에서 동일 합성 자격과 원래 두 신청의 거래 8건, 두 조건 충족을 검증했다. 정상 완료 사례는 취소하지 않았다. 다음 9건은 다른 자격의 취소까지 포함한 사례다.

## 취소 포함 증거 — 공개 발급 원본 9건

공개 NHN의 별도 발급 서버에서 합성 자격을 발급하고 원래 구매사·지원사업 두 신청을 생성했다. 관리자가 작업 `e75cfcb5-92ec-4113-b4f2-f1b356599d5b`를 승인한 뒤 같은 원본/신청으로 실제 Local Devnet 거래 8건을 확인했고, 발급기관 취소와 체인 취소 거래 1건을 추가 검증했다. 두 조건 true, 최종 revoked=true다.

[개인키 없는 9건 증거](evidence/issued-job-public-local-devnet-2026-09-25.json), [구현 설명](issued-midnight-integration.md), [운영 절차](operations-runbook.md). 최신 9건 실행에는 비교 조건 false 거래가 없으며 아래 이전 11건 시나리오에 포함되어 있다. 두 기록의 영상·작업·계약을 혼합하지 않는다.

신청 화면 하단에서 같은 신청의 체인 승인·실행·대조 상태를 연결했다. 일반 웹 신청은 체인 확정과 구분하며, 실제 외부 인증은 별도 공급자 인수시험이 남아 있다.

## 이전 완료 증거 — 웹 자격 11건

공개 저장소: https://github.com/xaikorea/midnight-korea-hackathon-2026

공개 시연 자료: https://github.com/xaikorea/midnight-korea-hackathon-2026/releases/tag/hackathon-demo-2026-09-25

새 환경의 [웹 CI](https://github.com/xaikorea/midnight-korea-hackathon-2026/actions/runs/36021183167)와 [실제 Devnet CI](https://github.com/xaikorea/midnight-korea-hackathon-2026/actions/runs/36019675856)를 모두 통과했다. 아래 웹 연결 기록과 CI의 독립 실행은 서로 다른 합성 시연이다.

| 항목 | 결과와 확인 자료 |
|---|---|
| 실제 네트워크 경로 | 공식 Wallet SDK, proof server, node, indexer를 사용한 Local Devnet 실행 |
| 웹-체인 연결 | 기존 웹 DB의 자격 1개와 원래 두 요청을 그대로 연결. 새 자격을 다른 자격으로 바꿔 성공시키지 않음 |
| 정상/예외 | 구매사 true, 지원사업 true, 비교 조건 false, 취소 후 제출 차단 |
| 확정 거래 | 11개, 각각 거래 ID·해시·블록·SucceedEntirely 포함 |
| 독립 확인 | 지갑을 사용하지 않는 인덱서 재조회로 11개 거래·검증 키·판정·취소 상태 일치 |
| 새 환경 재현 | 생성 자산 없는 Docker 이미지에서 Compact 0.31.1의 9개 회로 컴파일. 초기 22개 계약/SDK 검사와 새 노드 DUST 대기 회귀 검사를 더한 23개 검사 통과 |
| 웹 관제 | 일반 Ed25519 처리 기록과 별도 실제 Midnight 증거를 구분해서 표시 |
| 프라이버시 | 원본 처리 주체·발급기관 신뢰·공개 식별값 연결 가능성 명시 |

실행 완료: `2026-09-24T14:51:50.652Z` (한국시간 23:51). 독립 대조: `2026-09-24T14:56:32.433Z`.

공개 JSON SHA-256: `716f528e9e31aaf6fba1dace11745e5296fc6ec1ae4a75d09769a68fa0ec713c`.

## 이전 11건 자료의 재현 흐름

1. `/welcome`에서 독립 합성 체험 공간 시작 → 같은 자격으로 두 기관 신청 → 결과 저장·재조회.
2. `/verification`에서 별도 실제 Midnight 실행의 거래·판정·취소 기록과 공개 범위 확인.
3. 저장소의 Docker 명령으로 새 계약에서 실제 실행 재현.
4. 같은 Devnet을 유지하고 `verify-evidence.ts`로 거래와 공개 상태 독립 재조회.

웹 체험과 기록된 체인 실행은 별도 합성 체험 공간이다. 영상에서도 두 사례를 구분한다. 기록 재생을 실시간 거래 발생 또는 처리 속도 측정으로 설명하지 않는다.

## 기술 설명에서 지켜야 할 구분

- Midnight의 역할은 기관이 공개 원본 수치를 받지 않고 회로의 조건 판정을 확인할 수 있게 하는 것이다. 일반 웹 경로는 서버 판정·서명에 의존한다.
- Ed25519 원본을 Schnorr attestation으로 연결하는 로컬 실행기는 신뢰 경계 안에 있다. 회로가 원본 문서의 사실성이나 Ed25519 서명을 직접 검증하는 것으로 설명하지 않는다.
- 웹 서버와 로컬 증명 환경은 원본 속성을 처리한다. 서버로부터도 원본이 숨겨지는 구조 또는 기관 간 추적 불가능성을 주장하지 않는다.
- 최신 별도 발급 경로는 기관 취소 시 웹의 새 사용을 막고 원래 계약의 취소 작업을 만든다. 가동 중인 승인 작업 실행기와 별도 검증기가 체인 취소를 확인한다. 순차 반영이며 원자적·양방향 동기화나 무중단 상시 운영을 뜻하지 않는다. 이전 11건 경로의 취소는 별도 시나리오다.
- 공식 GLEIF 인증, SAP 실연동, 실제 지원기관의 승인, 실제 고객의 도입 효과는 아직 입증하지 않았다.
- 이 기록은 Local Devnet 실행이며 Preprod/Preview 또는 메인넷 실행으로 기재하지 않는다.

## 사용자 또는 외부 증거가 필요한 항목

- Luma 참가 등록 완료 여부: 미확인. 자동으로 등록하거나 제출하지 않았다.
- Midnight Academy 수료·증빙: 미확인.
- 실제 구매 담당자·지원기관 인터뷰 및 도입 의향: 미제공. [질문과 기록 양식](customer-validation.md)을 준비했다.
- 업무 시간 절감률·고객 수·매출: 측정 자료 없음. 추정 수치를 실적으로 기재하지 않는다.

마감과 제출 요건은 [공식 한국어 안내](https://www.hackathon.midnightkorea.org/kor)를 최종 확인한다. 코드·시연 자료 준비와 실제 참가 신청/제출 완료는 다른 상태이다.
