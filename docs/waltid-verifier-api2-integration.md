# walt.id Verifier API 2 적용

검토일: 2026-09-21. 공식 소스 기준 commit: `032e507936c962d20809cb19ce465157639d86c7`.

https://github.com/walt-id/waltid-identity/tree/032e507936c962d20809cb19ce465157639d86c7/waltid-services/waltid-verifier-api2

## 구현 범위

Verifier API 2의 OpenID4VP 검증 세션·DCQL·VP/VC 정책을 기존 기업 자격 플랫폼에 연결하는 서버 어댑터와 UI를 구현했다. Kotlin 서버 코드를 복사하지 않았으며, 실제 외부 서비스와의 지갑 상호운용 검증은 아직 하지 않았다.

- `/api/verifier` GET: 서버 설정 여부, 현재 사용자·역할이 만든 세션 목록.
- POST create: 유효한 pending 업무 요청으로 10분 이내 외부 세션 생성. 업무 요청 만료보다 길게 설정하지 않음.
- POST refresh: 저장된 세션만 조회. 사용자·역할·워크스페이스 경계 및 현재 업무 요청 상태/정책 해시 검사.
- 설정 화면에 요청 선택, 원본 속성 처리 확인, 지갑 요청 링크, 검증 결과, 수동 새로고침 추가.
- 원본 VP/VC·정책 상세·키를 브라우저에 전달하거나 로컬 세션에 저장하지 않음. 외부 서버가 제공한 상태만 반환.
- 원래 구매/지원 요청 상태와 presentations는 변경하지 않음. `eligible`는 항상 null.
- 생성 및 상태 확인 감사 기록에 사용자 ID 포함.

## 공식 코드에서 확인한 요청 모델

README의 짧은 `dcqlQuery` 예시 대신 현재 Kotlin `VerificationSessionSetupData.kt` 모델을 따랐다:

```json
{
  "flow_type": "cross_device",
  "core_flow": {
    "sessionId": "앱에서 생성한 UUID",
    "expiration_date": "업무 요청 만료 이내의 ISO 시각",
    "retention_duration": "PT1H",
    "dcql_query": {
      "credentials": [{
        "id": "enterprise",
        "format": "jwt_vc_json",
        "meta": {"type_values": [["VerifiableCredential", "BizProofBusinessCredential"]]},
        "claims": [
          {"path": ["credentialSubject", "id"], "values": ["해당 기업 URN"]},
          {"path": ["issuer"], "values": ["정책에서 허용한 활성 발급기관 DID"]}
        ]
      }]
    },
    "policies": {
      "vp_policies": ["jwt_vc_json/audience-check", "jwt_vc_json/nonce-check", "jwt_vc_json/envelope_signature", "jwt_vc_json/exp-check", "jwt_vc_json/nbf-check"],
      "vc_policies": ["signature", "expiration", "not-before"]
    }
  }
}
```

조건과 정책은 서버가 생성한다. 클라이언트가 정책을 생략하거나 임의의 callback·서버 URL·DCQL을 지정할 수 없다. 생성 응답은 sessionId를 대조하고, 지갑 요청 링크의 request_uri가 설정한 공개 origin 및 해당 세션의 `/request` 경로인지 검증한다. 외부 API는 리디렉션을 따르지 않으며 응답 크기 1MiB와 12초 제한을 둔다.

## 실행 설정

공식 저장소의 해당 commit에서 Java 21/Gradle 환경을 준비하고 다음 서비스를 별도로 실행한다. 이 프로젝트는 Kotlin/JVM 런타임을 Worker에 포함하지 않는다.

```text
./gradlew :waltid-services:waltid-verifier-api2:run
```

서비스 포트, clientId, public URL 등은 공식 `config/`와 실행 환경에 맞춰 설정한다. 아래 값은 예시이며 현재 자동 활성화되지 않는다.

```text
WALTID_VERIFIER_URL=http://127.0.0.1:7003
WALTID_VERIFIER_PUBLIC_ORIGIN=https://verifier.your-domain.example
WALTID_VERIFIER_TOKEN=<관리 API 게이트웨이의 서버 전용 토큰>
```

- URL은 path 없는 origin이다. HTTPS 또는 localhost/127.0.0.1 HTTP만 허용한다.
- 공개 origin은 실제 지갑이 접근할 수 있어야 하며 upstream에서 생성하는 request_uri와 일치해야 한다.
- TOKEN은 upstream 자체의 인증 기능을 켜는 설정이 아니다. 관리 API를 보호하는 프록시/게이트웨이가 Bearer 토큰을 실제로 검증하도록 배포해야 한다.
- upstream은 management와 wallet-facing 라우트를 구분한다. create/info/events 및 VICAL fetch를 공개 인터넷에 무인증으로 노출하지 않는다. 지갑에는 request/response만 공개한다.
- 앱에 설정이 없으면 버튼은 비활성이고, 장애가 나도 모의 성공 결과로 대체하지 않는다.

## 지원하지 않는 범위

1. 현재 `jwt_vc_json` 기업 자격에 한정한다. SD-JWT/mdoc, VICAL, 브라우저 Digital Credentials API는 업무 형식이 없어 추가하지 않았다.
2. JWT VC는 선택적 공개가 아니다. DCQL claims 목록을 좁혀도 전체 JWT가 검증 서버에 전달될 수 있다.
3. 기존 BizProof 내보내기의 기업 subject는 URN이다. 지갑 DID·대표자 권한과의 holder binding을 자동 보장하지 않는다. 기존 내보내기 파일이 임의의 지갑과 호환된다고 주장하지 않는다.
4. 외부 서버 SUCCESSFUL은 해당 서버의 프로토콜/정책 결과이다. 원본 자격의 현재 취소, 담당자 권한, 기업 사실성, 매출·업력 조건 또는 Midnight proof를 인증하지 않는다.
5. SSE 대신 인증된 수동 상태 조회를 구현했다. webhook 수신·원본 토큰 저장·외부 결과 자동 승인 경로는 없다.
6. 앱 세션은 기존 D1 워크스페이스에 저장하며 전체 100개 한도를 둔다. 외부 요청과 D1 저장은 분산 트랜잭션이 아니므로 저장 충돌 때 사용되지 않는 원격 세션이 남을 수 있으며 요청 만료로 제한한다. 자동 재시도하지 않는다.
7. upstream 보존 기간은 요청에서 1시간을 제안한다. 실제 개인정보 보존/삭제 정책은 서비스 설정 및 운영 환경에서 별도로 확인해야 한다.

## 검증

- `node tests/waltid-verifier.cjs`: 고정 모델·정책·DCQL, URL 위조/응답 ID 불일치/과대 응답/redirect 거절, 원본 데이터 제거, 사용자·역할·공간 격리, CSRF, 중복 요청, 확정 상태 재조회, 업무 자동 승인 없음. 모의 외부 서버와 저장소 사용.
- `node tests/waltid-verifier-ui.cjs`: 실제 앱의 미설정 비활성 상태, fixture 기반 동의/생성/결과, 역할 변경 시 화면 제거, 모바일.
- 테스트를 기본 `test:unit`에 포함했다.
- 루트 타입 검사, 변경 파일 lint, 전체 단위 테스트 11개 묶음, 프로덕션 빌드 통과. 기존 큰 번들 경고는 남아 있다.
- 실제 JVM 서버 및 실제 외부 지갑의 nonce·audience·소지자 검증 E2E는 미실행이다.
