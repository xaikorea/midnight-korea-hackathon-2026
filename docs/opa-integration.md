# OPA 업무 조건 평가

[Open Policy Agent](https://github.com/open-policy-agent/opa)의 Rego 정책과 [Data REST API](https://www.openpolicyagent.org/docs/rest-api)를 실제 자격 제출 경로에 연결했습니다. 테스트한 실행 파일/컨테이너 버전은 1.20.2이며 Windows 바이너리는 공식 릴리스의 SHA-256 파일과 대조했습니다. 서버 코드를 복사하지 않고 별도 프로세스로 실행합니다. OPA는 Apache-2.0 라이선스입니다.

## 적용 범위

- `integrations/opa/eligibility.rego`: 최소·최대 매출, 업력 기한, 소재지, 인증 보유를 개별 규칙으로 분리합니다. 선택하지 않은 조건은 통과하며 모든 활성 조건을 충족해야 eligible=true입니다.
- `lib/opa.ts`: 고정 REST 경로로 평가를 요청하고 반환값의 revision, 요청 binding, 전체 결과와 5개 조건 결과를 검증합니다. 5초 timeout, 16KB 응답 제한, 리디렉션 차단, 안전한 오류 메시지를 적용합니다.
- `lib/policy-engine.ts`: 기본 local 모드와 선택형 opa 모드를 제공합니다. 알 수 없는 모드는 거부합니다.
- `present` API: 기존 기업·발급기관·서명·위임 검증 후 OPA 모드에서 원격 평가를 수행합니다. 결과가 기존 로컬 계산과 항목별로 일치해야 제출과 감사 기록을 저장합니다. OPA 오류/미정의 결과/잘못된 형식/정책 버전 불일치/판정 불일치는 503으로 실패하며 로컬 결과로 우회하지 않습니다.
- 평가 시점은 서명된 presentation.issuedAt과 동일합니다. 업력 기한은 기존 JavaScript UTC 월 계산 규칙으로 산출해 전달합니다. OPA가 이 기한과 현재 시점을 비교합니다. 월말 넘침 규칙을 별도 변경하지 않습니다.
- 원래 검증 단계는 제출 시점의 정책 snapshot과 서명을 다시 검사합니다. 과거 제출의 검증을 현재 OPA 정책으로 소급 변경하지 않습니다.
- 관리자 설정 화면에서 현재 모드를 확인할 수 있습니다. 이 표시는 연결 성공 검사 결과가 아닙니다. 제출 감사 기록에 사용한 엔진 모드를 추가했습니다.

OPA로 Keycloak 역할, vLEI 신뢰 체계, Midnight 증명 검증을 대체하지 않습니다. 이 통합은 정책 코드를 외부화하고 동등성을 확인하는 단계이며 앱 화면에서 임의 Rego를 업로드하거나 독립적인 새 조건을 추가하는 기능은 제공하지 않습니다. 새 조건 도입에는 계약 revision, 로컬 검증, 증명 모델의 일관된 변경이 필요합니다.

## 실행

Docker 사용 시:

```text
docker compose -f integrations/opa/compose.yaml up -d
```

Windows 실행 파일 사용 시(다운로드된 파일은 gitignore 대상 `.tools/opa`에 있습니다):

```powershell
& ./.tools/opa/opa.exe test integrations/opa -v
& ./.tools/opa/opa.exe run --server --addr=127.0.0.1:8181 --disable-telemetry integrations/opa/eligibility.rego
```

기존 `.dev.vars` 설정을 유지하면서 다음을 추가하고 앱 서버를 재시작합니다.

```dotenv
BIZPROOF_POLICY_ENGINE=opa
OPA_ADDR=http://localhost:8181
```

기본 local로 복귀하려면 `BIZPROOF_POLICY_ENGINE=local`을 사용합니다. 운영 배포에서는 앱에서 접근 가능한 HTTPS 주소와 인증된 프록시 또는 OPA 인증/권한 정책을 구성해야 합니다. 필요하면 Worker secret인 `OPA_TOKEN`을 설정할 수 있지만 이 변수를 넣는 것만으로 OPA 서버에 인증이 활성화되지는 않습니다. 제공된 로컬 구성은 loopback에만 노출하며 운영용 인증 설정이 아닙니다.

## 정보 전달 및 로그

OPA에는 매출·지역·인증 여부·시점·업력 기한과 해당 정책 조건을 전달합니다. 개인키·서명·기업 ID·담당자 이름은 보내지 않습니다. 이는 영지식 평가가 아니며 OPA 운영 환경도 원본 속성을 처리하는 신뢰 경계입니다. 고정 revision과 binding은 응답 대조 장치이며 OPA 서명 증명이나 코드 무결성 인증서가 아닙니다. 현재 bundle 서명, 원격 bundle 갱신, 배포 승인 워크플로는 구현하지 않습니다.

기본 구성은 decision log 수집을 활성화하지 않습니다. 운영자가 활성화할 때는 입력 속성이 로그에 노출되지 않도록 마스킹/보관 정책을 함께 설정해야 합니다. 기존 업무 감사 기록에는 평가 엔진만 기록하며 원격 입력/응답 원문을 저장하지 않습니다.

## 확인 결과

- 실제 OPA 1.20.2: Rego 테스트 4/4 통과.
- `node tests/opa-live.cjs`: 실제 loopback OPA 서버에서 42개 입력 조합의 REST 평가와 로컬 결과 일치. 프로세스는 테스트 후 종료합니다. `OPA_BIN` 환경변수로 실행 파일 경로를 지정할 수 있습니다.
- `node tests/opa.cjs`: binding/버전/항목 불일치, 잘못된 응답, 과대 응답, 장애 차단.
- `node tests/opa-ui.cjs`: 관리자 설정 화면과 접근 제한.

기본 앱 설정은 local을 유지합니다. 실제 OPA 프로세스와 어댑터 간 통신은 검증했지만, 배포 환경의 TLS·인증 프록시 및 앱 전체를 opa 모드로 전환한 운영 배포는 검증 범위가 아닙니다.
