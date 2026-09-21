# OpenFGA 적용 및 운영 연결

2026-09-21. 공식 OpenFGA v1.21.0 (`ab557c5592670c899de35297e7aa067015f06502`) Windows 바이너리를 공식 SHA-256 목록과 대조하고 실제 로컬 서버에서 검증했다.

공식 자료: https://github.com/openfga/openfga / https://openfga.dev/docs/getting-started/perform-check

## 적용 범위

1. **워크스페이스 역할 교집합**: Keycloak 인증 → 기존 서버 지정 워크스페이스 멤버십 → OpenFGA 역할 Check. 둘 모두 부여한 역할만 allowedRoles에 남긴다. OpenFGA는 Keycloak에 없는 역할을 새로 부여할 수 없다. 해당 필터는 getChatGPTUser의 공통 경로에 적용된다.
2. **기업별 증빙 권한**: 업로드 직전 can_write_evidence, 다운로드 및 검토 기반 발급의 파일 읽기 직전 can_read_evidence를 확인한다. 관리자로 로그인해도 기업 문서 권한 검사를 우회하지 않는다.
3. **조직 권한 상속**: organization의 member userset을 workspace 역할 및 company의 reader/writer에 지정할 수 있다. member 관계를 삭제하면 조직을 통해 얻은 권한이 제거된다. 별도의 직접 권한이 있으면 그 권한은 별도로 회수해야 한다.
4. **안전한 Check**: 모델 ID 고정, HIGHER_CONSISTENCY, 앱 허용 캐시 없음, 5초 제한, 16KB 응답 제한, redirect 차단. 오류·잘못된 응답·설정 오류 때 접근을 허용하지 않는다.
5. **권한 확인 UI**: 설정 → 조직·증빙 접근 권한. 현재 사용자의 기업별 문서 읽기/업로드 결과를 확인한다. 임의 사용자 조회나 권한 부여 기능은 없다.

Keycloak은 인증, OpenFGA는 접근 관계, OPA는 매출·업력 등의 업무 조건을 담당한다.

## 모델

실제 서버에서 검증한 JSON: `integrations/openfga/authorization-model.json`.

```text
user
organization.member = user
workspace.admin / issuer / company / buyer / grant = user 또는 organization#member
company.reader / writer = user 또는 organization#member
company.can_read_evidence = reader 또는 writer
company.can_write_evidence = writer
```

OpenFGA store를 생성하고 JSON을 `/stores/{storeId}/authorization-models`에 POST한다. 반환된 model ID를 설정에 고정한다. 앱은 모델이나 관계를 자동 생성하지 않는다.

식별자 매핑은 `lib/openfga.ts`의 fgaUser/fgaWorkspace/fgaCompany를 사용한다. 값은 UTF-8 JSON 배열의 base64url이다. 전체 회사 키에 workspace owner를 포함하므로 같은 회사 ID라도 다른 공간에서는 다른 객체다.

```text
user:<base64url(JSON.stringify([userId]))>
workspace:<base64url(JSON.stringify([storageOwner]))>
company:<base64url(JSON.stringify([storageOwner, companyId]))>
```

userId는 Keycloak 검증 결과의 실제 식별자를 사용한다. 이메일·표시 이름을 대신 쓰지 않는다. organization ID도 운영상 워크스페이스별로 구분해 의도치 않은 조직 공유를 피한다. FGA 조직 관계는 기존 workspaceMembership.organization 문자열로 자동 동기화되지 않는다.

## 설정 순서

1. OpenFGA를 별도 서비스로 실행하고 인증 및 영구 저장소를 설정한다. 이번 테스트의 메모리 저장소는 프로세스 종료 시 사라진다.
2. store와 위 모델을 생성한다.
3. 최소 한 명의 운영 계정에 정확한 workspace admin 관계를 부여하고 필요한 기업 문서 reader/writer 관계를 등록한다.
4. Keycloak 실제 계정의 역할과 FGA Check를 확인한 뒤 다음 서버 변수를 적용한다.

```text
BIZPROOF_ACCESS_CONTROL=openfga
OPENFGA_URL=https://fga.your-domain.example
OPENFGA_STORE_ID=<store ULID>
OPENFGA_MODEL_ID=<authorization model ULID>
OPENFGA_TOKEN=<서버 전용 토큰>
```

URL은 경로 없는 origin이며 HTTPS 또는 localhost/127.0.0.1 HTTP만 허용한다. 토큰은 브라우저에 전달하지 않는다. 토큰 방식은 OpenFGA/게이트웨이 설정과 맞아야 한다.

`local` 또는 미설정은 기존 역할 모드다. `openfga`는 Keycloak 계정만 허용한다. 미완성 설정이나 장애 시 demo 계정으로 우회하지 않는다. 모든 FGA 역할이 없어지면 현재 앱은 로그인/접근 거절로 처리하며 서버 장애를 별도의 로그인 화면 상태로 구분하지 않는다.

## 테스트

- `node tests/openfga.cjs`: 설정·식별자·역할 교집합·모델 고정·일관성·잘못된 응답·장애 차단.
- `node tests/openfga.cjs --live`: 실제 로컬 OpenFGA 모델 등록, 조직 권한 상속, 두 회사 읽기/쓰기 분리, 다른 공간 차단, 조직 멤버십 삭제 후 거절. 테스트가 시작한 서버는 종료한다.
- `node tests/openfga-api.cjs`: 실제 증빙 라우트에서 거절/장애가 R2 접근 이전에 차단되는지 검증. 인증·OpenFGA 응답·저장소는 fixture.
- 기본 단위 테스트 13개 묶음 통과.
- 기존 전체 브라우저/API 회귀 테스트 13개 묶음 통과(기본 local 모드).
- 타입 검사, 변경 파일 lint, 프로덕션 빌드 통과. 기존 500KB 초과 번들 경고는 남아 있다.
- `node tests/openfga-ui.cjs`: 실제 기본 모드 조회와 fixture 기반 읽기/쓰기 구분 표시, 모바일 화면 검증 통과.

## 미완료와 범위 제한

- 현재 실행 중인 앱은 기본 local 모드다. 실제 서버 테스트 성공이 운영 활성화 또는 실제 Keycloak→OpenFGA 전체 로그인 E2E 완료를 의미하지 않는다.
- 기업별 증빙 바이트 접근에 추가 권한을 적용했지만, 프로필·원본 자격·초안·메타데이터 전체를 기업별로 필터링한 것은 아니다. 기존 공동 공간의 한 역할당 한 조직 제한을 유지한다. 아직 여러 독립 기업을 한 공간에 넣는 SaaS 격리 모델로 사용할 수 없다.
- API 호출 시작 시 권한을 검사한다. 검사와 파일 작업 사이에 권한이 변경되는 경쟁 조건까지 원자적으로 처리하지 않는다.
- 초대/승인/관계 쓰기·삭제 UI, DB↔FGA outbox 동기화, 변경 감사 수집, 영구 저장소 백업은 별도 구현이다. 관계는 운영자가 관리 API에서 부여·회수한다.
- 권한 엔진은 문서 진위·공인 vLEI·자격 조건·Midnight proof를 검증하지 않는다.
