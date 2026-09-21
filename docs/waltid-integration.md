# walt.id 핵심 기능의 BizProof 적용

2026-09-21. walt.id의 발급자·지갑·검증자 분리와 VC-JWT, DID 및 정책별 검증 구조를 현재 TypeScript/Cloudflare 앱에 맞게 독립 구현했다. Kotlin/JVM 기반 walt.id 서비스를 앱 안에서 실행하거나 SDK를 설치한 것은 아니다.

## 추가한 기능

- 기업 자격에서 VC-JWT 교환 파일 생성: 기존 원본 서명·스키마·현재 상태 검사가 먼저 통과해야 한다. 현재 발급기관 키로 EdDSA JWS에 서명하며 최대 24시간, 원본 만료일 이내로 제한한다. 원본 속성 전송 동의가 필요하다.
- 공개키 기반 `did:jwk` 및 DID 문서: Ed25519 공개키의 kty/crv/x만 포함한다. 개인키는 응답에 포함하지 않는다. 기존 가상 did:web를 외부에서 해석 가능한 DID라고 주장하지 않는다.
- 엄격한 `jwt_vc_json` 프로필: W3C VC Data Model 1.1 JWT 매핑의 iss/sub/jti/nbf/exp와 vc 필드를 연결한다. 이 버전은 기존 JWT 호환용이며 최신 VC 2.0 지원 또는 표준 적합성 인증을 주장하지 않는다. BizProof 확장 어휘와 sourceDigest로 원본 서명 본문을 연결한다.
- 정책별 검사 결과: 형식·알고리즘, 등록 발급키, JWT 서명, 시간, VC/JWT 매핑, 원본 내용, 원본 서명, 현재 취소·만료, 발급기관 신뢰, 스키마·보유기업의 10단계를 분리한다.
- 신뢰 분리: 서명된 JWT의 did:jwk만으로 발급기관을 신뢰하지 않는다. 현재 인증된 워크스페이스의 발급 기록과 현재/이전 키를 대조한다. 다른 워크스페이스의 자격, 임의 외부 자격은 자동 등록하지 않는다.
- 키 교체 후 기존 JWT 검증, 원본 취소 후 파일 거절, 발급기관 중지 후 거절을 연결했다. JWT 자체에는 공개 revocation/status-list 서비스가 없으므로 외부 수신자는 현재 취소 상태를 독립적으로 확인해야 한다.
- 기업 자격 화면에 내보내기 동의, JWT·DID 문서 다운로드, 붙여넣기 검사, 상세 검사 결과와 입력 지우기를 추가했다. 구매사·지원기관 역할에는 원본 파일 기능과 API를 제공하지 않는다.

`export-portable-credential`, `verify-portable-credential`은 기존 인증·역할·동시 변경 검사·감사 로그를 사용한다. JWT 내용이나 원본 속성은 새 감사 항목에 저장하지 않는다. 검증 보고서는 원본 속성이나 JWT를 반환하지 않는다. 별도 영구 자격 레코드를 생성하거나 기존 구매/지원사업 제출 형식을 변경하지 않는다.

## 현재 연결하지 않은 부분

OpenID4VCI 발급 제안, OpenID4VP의 holder binding과 nonce/session, SD-JWT 선택적 공개, mdoc, 외부 KMS, walt.id API2 서버, 외부 지갑 호환 시험은 미완료다. VC-JWT 내보내기는 암호화·선택적 공개·ZK 증명이 아니며 원본 기업 속성을 포함한다. 파일 검증을 담당자 소유 증명이나 구매·지원사업 자격 승인으로 사용하지 않는다.

walt.id의 기존 verifier API는 draft 14/20용이고, API2는 OpenID4VP 1.0/DCQL을 대상으로 한다. 따라서 예전 Presentation Definition endpoint를 새 표준 연동이라고 붙이지 않았다. 실제 서비스 연결 시 API2 및 호환 지갑과 세션·소유 증명·취소 상태를 포함한 상호운용 시험이 필요하다.

## 검증 및 파일

- `lib/portable-credential.ts`: 실제 WebCrypto Ed25519 JWS 생성·검증과 워크스페이스 검증 정책
- `app/portable-credentials.tsx`: 교환 화면
- `node tests/portable-credential.cjs`: 변조, alg=none, 비정상 시각, 다른 워크스페이스, 키 교체, 중지, 취소 검사
- `node tests/identity-exchange-ui.cjs`: 실제 앱/API·동의·역할 제한·다운로드·취소 검사

근거: [walt.id 저장소](https://github.com/walt-id/waltid-identity), [Verifier API2](https://github.com/walt-id/waltid-identity/tree/main/waltid-services/waltid-verifier-api2), [W3C VC 1.1 JWT 매핑](https://www.w3.org/TR/vc-data-model-1.1/#json-web-token). walt.id 소스의 Apache-2.0 라이선스를 확인했으며 이번 TypeScript 구현에 Kotlin 소스 코드를 복사하지 않았다.
