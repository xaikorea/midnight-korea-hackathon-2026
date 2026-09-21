# ClamAV 증빙 검사

2026-09-21. 공식 저장소와 clamd 프로토콜 문서를 확인해 별도 HTTP→ClamD 어댑터를 독립 구현했다.

공식 자료: https://github.com/Cisco-Talos/clamav / https://docs.clamav.net/manual/Usage/Scanning.html

## 적용한 기능

- `clamd`의 VERSION과 INSTREAM: 파일 경로나 URL 대신 원본 바이트를 64KiB 조각으로 전송한다.
- 저장 전 검사: 최대 2MiB 업로드를 메모리에 보유하고, clean 결과를 받은 뒤에만 OpenBao 암호화 및 R2/D1 등록을 진행한다. 검사 중 파일을 다운로드 가능 상태로 등록하지 않는다.
- 감염 또는 검사 제한 탐지 시 422, 검사 장애/오래된 DB/형식 오류 시 503으로 거절한다. 감염 파일을 정상 증빙으로 저장하지 않는다.
- ClamAV 모드에서 다운로드와 문서 검토 기반 자격 발급 시 복호화·해시 검증 후 **매번 재검사**한다. 과거에 검사 없이 업로드한 파일도 해당 경로에서 검사를 거친다.
- 업로드 검사 기록(status, SHA-256, 엔진/DB 버전, DB 시각, 검사 시각)을 Evidence에 보관하고 감사 기록 및 기업 문서/초안 화면에 표시한다.
- HTTP 브리지는 Bearer 인증, loopback 바인딩, 최대 동시 검사 2개, 입력/출력 크기 및 시간 제한을 사용한다. 파일 이름·기업 식별자·사용자 ID를 브리지에 보내지 않는다. 애플리케이션 브리지는 파일을 디스크에 쓰지 않지만 ClamAV 엔진은 분석용 임시 파일을 만들 수 있다.
- 악성코드 미탐지는 문서 사실성·기관 발급 여부·무해성을 보증하지 않는다.

## 활성화

1. 별도 서버에 ClamAV/clamd와 freshclam을 설치한다. 공식 서명 DB를 freshclam으로 내려받고 정기 갱신을 설정한다.
2. `integrations/clamav/clamd.conf.example`의 경로를 환경에 맞게 변경해 clamd를 실행한다. **AlertExceedsMax / AlertEncrypted 및 스캔 한도 설정을 유지한다.** 그렇지 않으면 엔진이 검사하지 못한 파일을 건너뛰는 경우가 있다. 이 설정 파일은 운영 서버에 자동 적용되지 않는다.
3. clamd TCP는 인증/암호화가 없으므로 외부에 공개하지 않는다. 브리지와 같은 호스트의 loopback 또는 격리된 서비스 네트워크를 사용한다.
4. Node 브리지를 실행한다:

```text
CLAMAV_BRIDGE_TOKEN=<32자 이상의 별도 서버 비밀>
CLAMD_HOST=127.0.0.1
CLAMD_PORT=3310
CLAMAV_BRIDGE_PORT=4012
node integrations/clamav/bridge.mjs
```

5. 앱 서버에 설정한다:

```text
BIZPROOF_MALWARE_SCAN=clamav
CLAMAV_BRIDGE_URL=http://127.0.0.1:4012
CLAMAV_BRIDGE_TOKEN=<브리지와 같은 비밀>
```

원격 배포에서는 서버에서 접근 가능한 HTTPS 프록시를 사용한다. Worker의 localhost는 개발 PC가 아니다. 브리지 URL은 path 없는 origin이다. 업로드 원문이 검사 서버로 전송되므로 신뢰하는 자체 서버에서 운영한다.

DB 버전·날짜를 VERSION 응답에서 읽고 3일보다 오래된 DB, 미래 시각, 누락된 DB 버전은 차단한다. 앱은 응답 SHA-256과 실제 입력을 대조하고 검사 시각도 확인한다. clamd 설정·DB의 공식 서명 출처를 이 프로토콜로 원격 증명하는 것은 아니므로 운영자가 설정과 freshclam을 관리해야 한다.

## 기존 기능과의 관계

OpenFGA 접근 검사 → 검사할 원본 준비 → ClamAV → OpenBao 암호화 → R2 저장 순서다. 읽기에서는 OpenFGA → 복호화/해시 → ClamAV → 반환 순서다. OPA 정책 및 Midnight 증명과는 별개다.

`demo` 또는 미설정 모드는 기존 가상 데이터 시연을 유지하고 `unscanned`로 기록한다. 미설정 상태를 검사 통과로 표시하지 않는다. 기존 scan 필드가 없는 파일은 업로드 검사 미확인으로 표시한다. 화면의 통과 표시는 업로드 당시의 기록이며, 새 다운로드에서는 활성 모드에 따라 다시 검사한다.

## 검증

- `node tests/malware-scan.cjs`: 바이트/해시 연결, 감염 거절, 오래된 DB·잘못된 응답·과대 응답·장애 차단. TCP 프로토콜 fixture로 INSTREAM 길이 프레임과 분할 전송 확인.
- `node tests/clamav-live.cjs`: 공식 Windows ClamAV 1.5.4 실행 파일에서 정상 파일과 **무해한 자체 테스트 서명**을 실제 검사. 실제 악성코드나 EICAR 파일을 사용하지 않는다. 공식 전체 위협 DB 탐지 범위를 검증한 테스트가 아니다.
- `node tests/malware-api.cjs`: 감염/장애 업로드의 저장 전 차단, 검사 기록 저장, 기존 파일 및 다운로드 재검사 확인. 검사 서버와 저장소는 fixture다.
- 기본 단위 테스트 15개 묶음, 타입 검사, 변경 서버 파일 lint, 프로덕션 빌드 통과. 기존 큰 번들 경고는 남아 있다.
- 기존 plan-improvements 브라우저/API 테스트 통과: 증빙 업로드·근거 검토 발급·동일 자격 재사용·취소·모바일. 기본 demo 모드 회귀 테스트다.
- Node 브리지와 Worker 코드는 GPL 라이브러리를 직접 링크하지 않고 별도 ClamAV 서비스와 통신한다. ClamAV 바이너리를 배포할 때는 해당 GPL 고지·소스 제공 의무 등을 별도로 검토한다.

## 남은 범위

현재 앱은 demo 모드이고 운영 clamd/freshclam은 활성화하지 않았다. 최신 공식 DB를 사용하는 실제 clamd→브리지→앱의 전체 운영 E2E는 미실행이다. TCP 프로토콜 테스트는 fixture, 실제 엔진 테스트는 자체 서명을 사용했다.

별도 영구 격리 버킷·비동기 작업 큐·격리 파일 관리자·일괄 재검사 UI는 없다. 이 프로젝트의 2MiB 제한에 맞춰 검사 완료 전 등록하지 않는 동기 방식이다. 기존 파일 전체가 자동으로 재검사되지는 않으며, 다운로드와 문서 근거 검토 때 검사한다. 일반 초안 발급은 증빙 내용을 인증하지 않는 기존 동작을 유지한다.
