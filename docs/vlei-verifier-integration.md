# GLEIF vlei-verifier 적용

## 후속 보완 — 2026-09-21

공식 고정 소스의 PresentationResourceEndpoint와 Signify 서명 처리 코드를 다시 대조해 아래 기능을 추가했다.

- POST `/api/vlei`의 `action: status` → 공식 GET `/presentations/{said}`. 202는 처리 기록 있음, 205는 처리 보관 시간 초과, 400/404는 기록 없음으로 구분한다. 공식 응답의 msg를 파싱해 승인·취소 상태를 추정하지 않으며 원문 메시지는 반환하지 않는다. 이 조회에는 기존 권한 서명 헤더를 재전송하지 않는다.
- 서명된 권한 조회는 단일 signify 항목에 @method, @path, signify-resource, signify-timestamp 및 created가 포함되어야 한다. 중복 필드·중복 created, 5분 초과·60초 이상 미래 생성 시각, timestamp와 created의 60초 초과 차이, 만료 expires를 로컬에서 거절한다. 암호학적 서명 검증과 실제 경로 일치는 공식 verifier가 수행한다. 로컬 시간/필드 검사는 서명 검증을 대신하지 않는다.
- compose 설정에 `VERIFIER_SIGNIFY_MAX_SKEW_SEC=300`을 명시했다. 원본 소스의 기본 시간 창을 그대로 사용하지 않는다. 재전송 거절은 원본 verifier의 used_sigs 저장소가 담당한다. 앱에 영구 재전송 방지 저장소를 새로 구현한 것은 아니다.
- 실행 전 검사에 실제 witnessUrlAllowlist 비어 있음 거절을 추가했다. 현재 빈 trustedLeis·witnessUrlAllowlist는 운영자가 실제 값으로 설정해야 한다.
- 화면에 제출 처리 상태 확인과 조회 보고서 다운로드를 추가했다. 보고서는 대조 대상과 확인 시각·상태·경계 표시를 포함하며 CESR 원문이나 서명 헤더는 포함하지 않는다. 입력 변경 시 이전 보고서를 지운다. 화면 종료 시 진행 중 요청을 취소한다.
- report의 `officialVleiVerified`, `rootOfTrustObserved`, `revocationConfigurationObserved`는 계속 false다. 상태 조회나 입력값과의 응답 일치를 공인 vLEI 검증으로 승격하지 않는다.

검증: 확장된 `tests/vlei-verifier.cjs`에서 서명 시간·필수 항목·만료 검사와 202/205/400/404 처리, 원문 오류 제거를 확인한다. `tests/vlei-lifecycle-ui.cjs`는 fixture 기반 상태 조회·보고서·입력 변경 초기화를 검증한다. 원본 verifier 컨테이너·실제 KERI 서명/자격·신뢰 루트·취소 이벤트의 종단 검증은 여전히 미완료다.

2026-09-21. 검토한 공식 소스 커밋: `5850051b52dce24ed59eae486af76e7c73f6012c`.

## 적용 범위

공식 검증기는 KERI 이벤트·ACDC 자격·CESR 서명을 keripy로 처리한다. 이를 기존 Ed25519 업무 데모나 Midnight 회로로 대체하지 않았다. `lib/vlei-verifier.ts`와 인증된 `/api/vlei`를 통해 로컬 공식 검증기와 통신하는 어댑터를 만들었다. 연결 및 설정 화면에 제출·조회 UI를 추가했다.

| 공식 기능 | BizProof 적용 |
| --- | --- |
| CESR 자격 제출 | PUT `/presentations/{said}`, `application/json+cesr`, 원문 그대로 전달. 250KB 상한, 원본 전송 동의, AID·SAID 입력 검사. 202는 수락 대기로 표시한다. |
| AID 권한 조회 | GET `/authorizations/{aid}`에 signature-input, signature, signify-resource, signify-timestamp를 전달한다. AID 소유자가 실제 KERI 키로 만든 서명 헤더가 필요하다. |
| 자격과 조직·역할 연결 | 응답의 AID, SAID, LEI, role을 모두 대조한다. LEI의 문자 형식·mod-97 체크섬을 검사한다. 체크섬 통과는 실제 LEI 등록 상태의 인증이 아니다. |
| AID 로그인과 자격 권한 구분 | 소스는 AID 로그인만으로도 200을 반환할 수 있다. aid=said 또는 LEI/role 누락 응답은 자격 대조 통과로 취급하지 않는다. |
| 비동기·오류 상태 | 수락, 일치, 불일치, 기록 미확인, 권한 미확인을 구분한다. 401을 취소된 자격으로 단정하지 않는다. 자동 제출 재시도·서명 재전송은 하지 않는다. |
| 신뢰 루트·취소·허용 스키마 | 별도 실행 구성에 production 모드, VERIFY_ROOT_OF_TRUST=True, revocationCheck=true, ECR_SCHEMA_PROD/OOR_SCHEMA, 크기 제한을 명시했다. 실제 허용 LEI를 설정해야 실행 스크립트가 통과한다. |
| 서비스 상태 | `/health`와 `/service_status`를 조회한다. 서비스 응답만으로 운영 모드, 신뢰 루트 또는 취소 검사 설정을 검증했다고 표시하지 않는다. |
| 기존 담당자 권한 | 기존 9단계 검사를 유지하면서 실제 스키마 존재, 원본 발급 시점, 자식 권한의 발급·만료 순서, 부모 기업 자격보다 늦게 만료되는 권한 거절을 보강했다. |

### 소스에서 확인한 README와의 차이

- README의 Root of Trust 기본값 설명과 달리, 검토한 `start.py`는 기본 `VERIFY_ROOT_OF_TRUST=True`이다. 기본 public JSON의 `revocationCheck`는 false이다. 따라서 기본값을 추정하지 않고 실행 구성에 두 값을 명시했다.
- `trustedLeis=[]`는 조직 제한을 끈다. 우리 실행 전 검사는 빈 목록을 거절한다.
- production의 권한 조회는 서명 헤더를 요구한다. 권한 조회를 쉽게 만들기 위해 test 모드로 낮추거나 Root of Trust 추가 API를 웹에 노출하지 않았다.
- `/service_status`의 `mode: verifier`는 production/test 운영 모드를 알려주는 값이 아니다.
- 현재 커밋의 200에는 단순 AID 로그인도 포함될 수 있다. 상태 코드만으로 자격을 승인하지 않는다.

## 실행 준비

소스는 `integrations/vlei-verifier-upstream`에 내려받았고 검토한 커밋을 실행 전에 확인한다. 개발 실행 파일은 `integrations/vlei/`에 있다. 재현 시 다음과 같이 소스를 준비한다.

```powershell
git clone https://github.com/GLEIF-IT/vlei-verifier.git integrations/vlei-verifier-upstream
git -C integrations/vlei-verifier-upstream checkout 5850051b52dce24ed59eae486af76e7c73f6012c
```

1. `integrations/vlei/verifier-config.json`의 `trustedLeis`에 실제 허용할 기업 LEI를 넣는다. 가상 테스트 LEI를 운영 목록으로 자동 추가하지 않았다.
2. 실제 배포 환경에 맞게 witness/OOBI·schema 접근, 신뢰 루트와 취소 이벤트 수신을 확인한다. 가져온 OOBI 주소가 계속 가용하다는 보장은 없다.
3. Docker 엔진을 실행하고 Node.js 24에서 `node integrations/vlei/run.mjs`를 실행한다. 검증기는 127.0.0.1:7676에만 노출한다. 컨테이너의 127.0.0.1은 호스트 앱과 다르므로 원격/컨테이너 배포에는 별도의 네트워크 설계가 필요하다.
4. 실제 ACDCs와 KERI 이벤트·서명이 포함된 CESR를 준비한다. 기존 BizProof JSON, VC-JWT, Midnight 주소를 임의로 변환해 넣지 않는다.
5. 설정 화면에서 대조할 AID/SAID/LEI/role과 CESR를 입력하고 제출한다. 각 권한 조회 시 `GET /authorizations/{aid}` 경로에 대한 새 Signify 서명 헤더를 사용한다. timestamp나 서명을 앱에서 임의 생성하지 않는다.

## 현재 검증 수준

- 실제 WebCrypto 서명 테스트와 기존 담당자 권한 검사 보강은 실행했다.
- vLEI 어댑터의 미디어 타입, 식별자 연결, 202/200 구분, AID-only 거절, 400/401/403/404, 리디렉션 차단, 응답 크기 제한, 서명 헤더 검사는 테스트용 응답으로 검증했다. 이것은 KERI 암호 검증 성공 증거가 아니다.
- 실제 앱의 로그인·역할·출처 제한과 서비스 미연결 표시, 모바일 UI를 검증했다.
- Docker 엔진 파이프가 없어 공식 verifier 컨테이너를 실행하지 못했다. 실제 CESR·AID 서명·GLEIF 루트·취소 이벤트로 종단 검증하지 않았다.
- 따라서 결과에 `officialVleiVerified:false`, `rootOfTrustObserved:false`, `revocationConfigurationObserved:false`를 유지한다. `authorizationMatched:true`는 외부 응답과 입력 기준이 일치한다는 뜻이며, BizProof 업무 권한을 자동 부여하지 않는다.

원문 CESR와 서명 헤더는 기존 워크스페이스 DB·감사 로그에 저장하지 않는다. 실제 공식 검증기는 제출한 자격을 자신의 저장소에서 처리하므로 데이터 보관 정책은 별도로 적용해야 한다. 연결 URL은 서버에 고정되어 있고 사용자가 임의 witness URL·OOBI URL·신뢰 루트를 전달할 수 없다.

## 관련 파일과 검증 명령

- 어댑터 `lib/vlei-verifier.ts`, 응답 스키마 `lib/vlei-schema.ts`
- 인증 API `app/api/vlei/route.ts`, 화면 `app/vlei-verifier-panel.tsx`
- `node tests/vlei-verifier.cjs`
- `node tests/portable-credential.cjs` — 담당자 권한의 부모 만료 상한 검사 포함
- `node tests/identity-exchange-ui.cjs` — 로컬 앱·Edge 필요
- `node integrations/vlei/check-config.mjs` — 현재 빈 LEI 목록에서는 의도적으로 실패

출처: [공식 저장소](https://github.com/GLEIF-IT/vlei-verifier), [검토한 HTTP API 소스](https://github.com/GLEIF-IT/vlei-verifier/blob/5850051b52dce24ed59eae486af76e7c73f6012c/src/verifier/core/verifying.py), [신뢰 경로 소스](https://github.com/GLEIF-IT/vlei-verifier/blob/5850051b52dce24ed59eae486af76e7c73f6012c/src/verifier/core/authorizing.py). 공식 코드와 구성의 Apache-2.0 라이선스는 `integrations/vlei/LICENSE-APACHE-2.0`에 보존했다.
