# Keycloak 인증·권한 통합

공식 저장소 https://github.com/keycloak/keycloak 및 OIDC 문서 https://www.keycloak.org/securing-apps/oidc-layers 를 기반으로 구현했습니다. Keycloak 26.7.4 로컬 서버 설정과 jose 6.2.12 검증기를 사용하며 Keycloak 서버 코드를 복사하지 않습니다.

## 적용 기능

- Authorization Code + S256 PKCE, 암호화된 10분 state/nonce 쿠키, ID 토큰과 액세스 토큰의 사용자 연결 검증.
- RS256 서명/JWKS, issuer, audience, azp, 만료, 토큰 종류 검증. 토큰은 HttpOnly/SameSite 쿠키에만 저장합니다. refresh token은 보관하지 않습니다.
- 해당 클라이언트에 배정된 admin/issuer/company/buyer/grant 역할만 UI와 모든 업무 API에서 허용합니다. realm 관리자 역할을 업무 관리자로 자동 승격하지 않습니다.
- issuer와 sub로 사용자별 저장소를 분리합니다. 기존 데모 저장소의 자동 이전이나 조직 공동 워크스페이스는 구현 범위가 아닙니다.
- 계정 콘솔 연결과 POST 로그아웃. 인증 서버 로그아웃 화면에서 추가 확인을 요구할 수 있습니다.
- 서버 로그인/관리 이벤트 및 무차별 로그인 방어를 realm 설정으로 활성화했습니다. 실제 MFA 강제 정책·외부 IdP·LDAP 연결은 운영자가 Keycloak에서 구성해야 합니다.

## 로컬 실행

1. Docker Desktop을 실행합니다. PowerShell에서 `KC_BOOTSTRAP_ADMIN_USERNAME`, `KC_BOOTSTRAP_ADMIN_PASSWORD` 환경변수를 본인이 정한 값으로 설정하고 `docker compose -f integrations/keycloak/compose.yaml up -d`를 실행합니다. 비밀번호를 저장소에 기록하지 마세요.
2. http://localhost:8080 의 관리자 콘솔에서 bizproof realm 사용자를 생성하고 비밀번호를 설정합니다. 사용자 Role mapping에서 **bizproof-web client roles** 중 필요한 역할만 배정합니다. 기업 사용자는 company, 구매사는 buyer를 사용합니다. 모든 사용자에게 admin을 부여하지 않습니다.
3. 루트 `.dev.vars`에 기존 설정을 유지하면서 아래 값을 추가합니다. secret은 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`로 생성한 64자리 hex입니다.

```dotenv
BIZPROOF_AUTH_MODE=keycloak
KEYCLOAK_ISSUER=http://localhost:8080/realms/bizproof
KEYCLOAK_CLIENT_ID=bizproof-web
BIZPROOF_APP_ORIGIN=http://localhost:5173
KEYCLOAK_SESSION_SECRET=생성한_64자리_hex
```

4. 개발 서버를 재시작하고 http://localhost:5173 에서 로그인합니다. localhost와 127.0.0.1을 혼용하지 마세요. 기존 개인 데모를 사용하려면 `BIZPROOF_AUTH_MODE=demo`로 되돌립니다.
5. MFA가 필요하면 사용자 Required actions에서 Configure OTP를 지정하고 인증 flow 정책을 검토합니다. 계정 콘솔의 인증 수단 등록과 실제 MFA 강제 여부는 별도로 확인합니다.

운영에서는 start-dev를 사용하지 않고 HTTPS, 운영 DB, Keycloak hostname/proxy 설정, 고정 redirect URI, 비밀 관리 및 백업을 구성해야 합니다. realm import는 기존 realm을 갱신하지 않으므로 기존 설치는 관리자 콘솔에서 변경을 반영합니다.

## 세션 및 검증 경계

액세스 토큰은 최대 5분의 나이까지만 허용하며 만료 후 재로그인합니다. 역할 제거·계정 비활성화·다른 기기 로그아웃을 즉시 반영하는 introspection/backchannel logout은 연결하지 않았습니다. 이미 발행한 토큰의 잔여 유효기간 동안 기존 권한이 남을 수 있습니다. SSO 쿠키가 유효하면 재로그인에서 비밀번호 입력이 생략될 수 있습니다.

Keycloak 인증은 기업 자격·vLEI·영지식증명 자체를 인증하지 않습니다. 기존 업무 증명 검증은 독립적으로 유지합니다. 잘못된 Keycloak 설정이나 서명 검증 실패 시 데모 헤더로 우회하지 않습니다.

`node tests/keycloak.cjs`는 생성한 RSA 키와 모의 IdP 응답으로 인증 실패·권한 경계를 검증합니다. Docker 엔진 미실행 환경에서는 실제 Keycloak 로그인, MFA, 로그아웃 및 realm import 성공을 검증했다고 간주하지 않습니다.
