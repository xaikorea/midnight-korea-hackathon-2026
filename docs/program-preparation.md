# 실제 기관·구매사 제출 준비

`신청하기 → 실제 기관·구매사 준비`에서 기업 자료를 재사용하여 공개 조건을 확인한다. 공식 기관과의 제휴나 공식 접수 API가 아니다. 기존 빠른 시연과 별도 발급기관의 Midnight 작업은 그대로 유지한다.

| 참고 대상 | 이번 프로필의 범위 |
|---|---|
| [서울창업허브 성수](https://www.startup-plus.kr/project/PRJ007420) | 2026 하반기, 일반/신산업 업력 경로, 이력, IR 10쪽·20MB, 선택 가점 |
| [서울 AI 허브](https://www.startup-plus.kr/project/PRJ006524) | 종료된 2026 1차 선도기업 회차, 2025 매출 또는 투자, 상주 계획. 정확한 업력 기준일은 담당자 확인 |
| [서울창업허브 공덕](https://hubgongdeok.startup-plus.kr/project/PRJ006640) | 종료된 2026 상반기, 6월 10일 업력 기준, 납세·보험·재무·신청 서류, 대체서류 예외 검토 |
| [현대제철](https://poinfo.hyundai-steel.com/sub/suggest) | 기술제안 준비. 협력사 등록·공장 시험·계약과 구분 |
| [POSCO](https://sustainability.posco.com/S91/S91F10/kor/cmspage.do?mmcd=1750321915001548) | 소싱그룹·신용·재무·공급 역량·ESG 검토 준비. 보편적인 신용등급 합격선 없음 |
| [SK하이닉스](https://gpis.skhynix.com/ui/sp/eportal/pc/bp_regi_info.html) | 품목 분류, 신규 협력사 정보 준비, 구매/TSC 검토 경로 |

프로필은 `lib/program-catalog.ts`에 회차·버전·출처·확인일·접수 기간과 함께 저장한다. `sourceStatus=public-reference`이며 원문 파일의 해시는 확보되지 않아 `sourceDigest=null`이다. `profileHash`는 정규화된 **참고 규칙 객체**의 해시다. 이를 원문 진본성 또는 공식 승인 증거라고 설명하면 안 된다. 규칙 변경 시 기존 버전을 수정하지 말고 새 회차/버전을 추가한다. 과거 신청은 저장 당시 프로필을 유지한다.

## 구현된 흐름

1. 기본·투자 경로·이력 누락·회계연도 불일치·납세 자격 만료·IR 11쪽·미충족 중 합성 사례 선택.
2. 사례별 가상 기업, 별도 스키마 `bizproof:program-facts:1`의 서명 자격 5개, 합성 PDF 13개를 한 번 저장.
3. 기업·발급자·허용 속성·서명·현재 유효기간·취소 상태·파일 해시를 검증하고 `all/any` 조건을 계산.
4. `pass/fail/unknown/manual_review/not_applicable`을 표시. 근거가 없으면 ‘이력 없음’으로 채우지 않는다. 회계연도가 다른 매출은 해당 회차 실적에 사용하지 않는다.
5. 사용자·공간·기업·수신 프로필·자료 지문·공유 범위·nonce·5분 만료를 연결한 서버 서명 동의를 발행. 자료가 달라지면 새 확인이 필요하며 같은 nonce의 재시도는 기존 기록을 반환.
6. 내부 준비 기록 저장. 담당자 검토는 직접 선택한 근거·사유·revision이 필요하다. 수치 미충족이나 자료 미확인을 담당자 버튼으로 덮어쓰지 않는다.
7. 서명된 JSON 제출 준비 목록 다운로드. 현재 유효성을 다시 검사하고 변경 여부를 표시한다. 원본 수치·PDF 본문은 제외한다. 별도 권한 검사 후 PDF 다운로드가 가능하다.

`externalReceipt`는 항상 `null`이다. 모의 검토 후에도 ‘공식 미접수’를 유지한다. 서명은 서버의 처리 기록 서명이며 사용자의 법적 전자서명이 아니다. 패키지에 동봉한 공개키는 독립적인 신뢰 근거가 아니므로 운영 검증자는 별도의 경로에서 플랫폼 공개키를 고정해야 한다.

## API

| 경로 | 용도 |
|---|---|
| `GET /api/programs` | 대상·사용 가능한 기업·권한 내 준비 기록 |
| `POST /api/programs` | 개인 체험에 합성 사례 사전 저장 |
| `POST /api/programs/:id/precheck` | 현재 자료 검사와 서명된 동의 challenge |
| `POST /api/program-applications` | 동의 검증 후 멱등 내부 준비 저장 |
| `POST /api/program-applications/:id/review` | 기관 역할·조직 배정·기업 ACL 검사 후 모의/내부 검토 |
| `GET /api/program-applications/:id/package` | 신청자/관리자의 비공개 준비 목록 |
| `POST /api/program-documents?profileId=...&companyId=...&type=...` | 제한된 실증 PDF 업로드 |
| `GET /api/program-documents/:id` | 기업·증빙 권한, 무결성, 실제 파일 재검사 후 다운로드 |

운영 경로는 Keycloak + OpenFGA를 요구한다. 실증 업로드는 `BIZPROOF_PROGRAM_PILOT=true`인 비공개 환경에서만 가능하며 공개 체험은 계속 차단한다. 기관 심사는 `BIZPROOF_PROGRAM_REVIEWERS`의 `{actor,organization,profileId}` 배정과 해당 역할·기업 쓰기 권한을 함께 확인한다. 이 설정에는 실제 배정을 넣어야 하며 코드 예시로 임의의 담당자를 생성하지 않는다. 확장 자격의 실기관 발급·대표권 검증은 아직 연결되지 않았으므로 운영 모드의 준비 제출은 차단한다.

PDF 입력은 스트림 크기 제한, 실제 PDF 파싱, 페이지 수, 암호화·자동 실행 일부 기능 차단, ClamAV, 파일 해시, 기업 ACL을 거친다. 파일 파서는 완전한 콘텐츠 무해화 도구가 아니다. 실제 파일은 다운로드 때도 재검사하며 스캐너 장애 시 차단한다. 기존 증빙 API의 2MB 제한은 유지하고 새 실증 경로만 20MB를 허용한다. OpenBao 증빙은 같은 포맷의 256KiB 조각을 최대 80개까지 지원한다. ClamAV bridge/clamd 설정도 함께 갱신해야 하며 서버 부하·악성 샘플 인수시험 없이 공개 업로드로 전환하지 않는다.

## 별도 Compact 수치 조건 회로

`contracts/program-core.compact`는 기존 `bizproof.compact`와 독립적이다. 기존 계약 주소·키·원장·영수증은 변경하지 않는다.

- 회계연도가 일치하는 매출 **또는** 투자 조건, 최소 상주 인원, 설립일 하한과 상한.
- 회사 commitment, 자격 묶음 digest, 보유자, 발급·만료 시각을 새로운 Schnorr 메시지 도메인에 연결.
- 요청의 audience·nonce·프로필 digest, trusted time, 발급자 중지, 취소, 중복 제출 차단.
- 새 속성을 모두 가진 집계 자격에 대한 수치 판정이다. 원본 Ed25519 다기관 자격을 회로에서 직접 검증하는 구현은 아니다.
- `lib/program-numeric-source.ts`와 `contracts/sdk/program-source.ts`는 서울 AI 허브 수치 조건에 대한 내부 원본 연결을 구현한다. 신청·동의·프로필 서명, PDF 해시, 발급자별 공개키·허용 속성·현재 취소 상태, 같은 기업·회계연도와 값 충돌을 검증하고 서명된 원본 묶음을 새 회로용 자격에 연결한다. 플랫폼 서명만으로 원본 발급자의 서명을 대체할 수 없다. 브라우저로 원본 묶음을 내보내는 API는 제공하지 않는다.
- 현재는 컴파일·로컬 ledger 실행 검증이다. 실제 proof 생성, 새 계약 배포, 웹 신청과 실행기 연결, 독립 인덱서 대조는 이 새 회로에 대해 수행하지 않았다. 기존 계약의 실제 거래 증거와 혼동하면 안 된다.
- 미확인 입력을 0/false로 바꾸어 회로에 넣으면 안 된다. 구현된 원본 검증기를 사용할 때에도 실행기에서 독립적으로 고정한 키와 현재 취소 상태 조회가 필요하다. 운영 집계 서명자의 신뢰 배정은 별도 설정해야 한다. 사람 심사·문서 적합성·최종 선정은 이 수치 회로의 결과에 포함되지 않는다.

Linux/WSL에서 재현:

```sh
bash scripts/compile-contract.sh
bash scripts/compile-contract.sh "$PWD/contracts/managed-program" "$PWD/contracts/program-core.compact"
npm run test:verification
npm run build:nhn
```

또는 기존 `contracts/standalone.yml` runner 이미지 빌드 시 두 회로를 모두 컴파일·검증한다. 브라우저 테스트는 격리된 로컬 합성 서버에서 `node tests/program-ui.cjs`로 수행한다.

## 외부 준비가 필요한 다음 단계

- 각 기관의 현행 회차·품목별 규칙·예외 승인과 원문 파일 검토. 서울 AI 허브 신규기업 유형은 별도 조건이 확인되기 전 제공하지 않는다.
- 확장 자격 스키마를 실제 발급 서버에 연결하고 항목별 신뢰 발급자·문서 내용 검토·취소 endpoint를 설정.
- 실제 본인확인/전자서명 공급자 테스트 계정, 대표권 검증, 기관의 전자증빙 수용 범위 인수시험.
- 내부 원본 연결기를 승인 작업 실행기에 연결하고 새 계약을 별도 환경에서 실행한 뒤, 승인된 신청과 영수증·독립 인덱서 대조까지 연결.
- 공식 접수 API/협약·계정과 수신증 검증 규격 확보. 그 전에는 외부 접수 상태를 생성하지 않는다.
