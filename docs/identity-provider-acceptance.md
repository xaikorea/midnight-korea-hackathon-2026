# 실제 인증 공급자 연결 인수시험

현재 공급자와 테스트 계정은 미준비다. 공개 시연은 합성 인증을 유지한다. `/identity-pilot`은 별도 파일럿에서 브라우저 SDK와 서버 조회를 연결하는 시험 화면이며, 본인확인 결과로 기업 자격이나 대표권을 자동 승인하지 않는다.

## 준비할 설정

공개 데모와 다른 배포에서 `BIZPROOF_PUBLIC_DEMO=false`, `BIZPROOF_IDENTITY_PILOT=true`, 승인된 Keycloak 사용자 ID 목록 `BIZPROOF_IDENTITY_PILOT_USERS`를 설정한다. Keycloak 로그인·issuer/audience/역할·워크스페이스 권한 설정이 먼저 정상이어야 한다.

서버의 `BIZPROOF_PORTONE_CONFIG`에는 `storeId`, `channelKey`, `channelType` (`TEST` 또는 `LIVE`), 서버 전용 `secret`, 48자 이상의 무작위 `subjectSecret`이 필요하다. 값은 서버의 접근 제한 비밀 설정에만 보관한다. 잘못된 설정은 기능을 켜지 않는다. 공급자 허용 URL과 `/identity-pilot` 복귀 URL도 등록한다.

## 검증할 흐름

1. 승인된 계정으로 로그인한 후 기업과 시험 문서를 확인하고 동의한다.
2. 서버가 만든 거래 ID·문서 연결값·10분 유효기간으로 공식 PortOne 브라우저 SDK를 호출한다. 휴대폰·민간 인증 수단은 계약된 채널에 따른다.
3. PC 반환값 또는 모바일 복귀 URL에서 원래 거래를 대조하고 서버에서 결과를 재조회한다. 브라우저 성공 표시·쿼리 문자열만으로 완료하지 않는다.
4. 서버는 채널·TEST/LIVE·거래·원래 intent·시각을 검증한다. CI/DI 원문 대신 별도 키로 만든 비가역 참조를 보관하며 이름·휴대폰·PG 원문은 저장하지 않는다.
5. 정상, 취소, 지연, 모바일 복귀, SDK 차단, 기관 장애, 잘못된 채널, 변조된 복귀 ID, 10분 만료, 다른 계정 조회, 중복 소비를 시험한다. 테스트 채널 결과가 운영 결과로 승격되지 않아야 한다.

브라우저 fixture는 실제 인증 증거가 아니다. 공급자 테스트 계정으로 위 사례를 통과한 뒤, 별도 실증 승인과 데이터 정책 확인을 거쳐 운영 채널을 활성화한다.

## 문서 서명과 기업 권한

`DocumentSigningProvider`는 계약한 공급자가 원문 서명을 검증하는 어댑터 경계다. 공통 검사에서 문서 해시·intent 해시·유효기간·검증 시각·TEST/LIVE 일치를 강제한다. 휴대폰 본인확인 결과를 문서 전자서명으로 사용할 수 없다.

공동인증서·간편 전자서명의 실제 구현에는 공급자의 검증 API, 인증서 용도/폐지 상태, 서명 원문 규칙, 테스트 계정이 필요하다. 기업 재직·대표권·위임과 실제 기업 속성의 근거도 별도로 확인해야 한다. 현재 합성 발급 서버가 실기관으로 전환되었다고 표시하지 않는다.

공식 규격: [PortOne 본인확인 흐름](https://developers.portone.io/opi/ko/extra/identity-verification/readme-v2), [브라우저 요청 형식](https://developers.portone.io/sdk/ko/v2-sdk/identity-verification-request), [공식 SDK 설치](https://developers.portone.io/opi/ko/integration/start/v2/checkout).
