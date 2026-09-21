# JSON Forms 입력 화면 통합

[공식 JSON Forms](https://github.com/eclipsesource/jsonforms)의 React/Core 3.8.0을 직접 사용합니다. React 19와 호환되는 공식 React 통합이며 MIT 라이선스는 설치 패키지에 포함됩니다. 기존 UI와 맞추기 위해 Material UI 패키지 대신 자체 renderer를 구현했습니다.

## 적용 범위

`app/platform.tsx`의 공통 FormDialog를 `app/schema-form-dialog.tsx`로 교체했습니다. 기업 등록, 기업 자격 발급, 검증 요청, 정책 생성, 기관 등록, 연결 요청 및 공통 확인·입력 대화상자에 적용됩니다. 발급 작업실의 별도 초안 편집기, 증빙 검토 화면 및 조직 위임 전용 폼은 기존 구현을 유지합니다.

- `lib/form-schema.ts`: 필드 선언으로 JSON Schema와 UI Schema를 생성합니다. 정수/범위, 필수값, 선택 목록, 이메일, 실제 존재하는 과거 날짜를 검증합니다. 빈 선택값을 유효한 값으로 처리하지 않습니다.
- 최소 매출이 최대 매출보다 큰 경우를 AJV의 `$data` 참조로 검사합니다. 선택 숫자의 공란과 0을 구별하여 기존 API의 null/숫자 의미를 유지합니다.
- JSON Forms SHOW rule로 지역 제한 입력을 표시합니다. 제한을 끄면 숨겨진 기존 지역값은 전송하지 않습니다.
- renderer registry로 기존 Input/Select 및 폼 그리드 디자인을 사용합니다. 한국어 오류, label 연결, aria-invalid/aria-describedby, 저장 중 readonly, 실패 시 입력 보존을 지원합니다.
- 입력 데이터는 JSON Forms 내부에서 관리합니다. 변경 알림의 debounce에 따른 stale feedback을 피하고 layout context의 최신 snapshot으로 제출을 검증합니다. 빠른 입력 직후 저장하는 브라우저 테스트를 포함합니다.
- JSON Schema/AJV는 클라이언트 입력 보조입니다. 기존 백엔드 Zod 검증, 역할 제한, 기업·발급기관 연결, 서명 및 스키마 버전 검사를 그대로 유지합니다. 서버를 우회해 신뢰를 얻는 기능이 아닙니다.

JSON Schema는 저장소 코드의 신뢰된 필드 정의에서만 생성합니다. 외부 스키마 URL, 원격 `$ref`, 사용자가 업로드한 실행 코드, 임의 필드 추가는 지원하지 않습니다. 현재 자격의 4개 속성·Compact 회로·서명 형식을 변경하지 않습니다.

## 검증

`node tests/jsonforms.cjs`로 필수값·숫자 범위·잘못된 날짜·매출 범위·0/공란·숨김 값 처리를 검사합니다. `node tests/jsonforms-ui.cjs`는 실행 중인 localhost:5173에서 실제 오류 표시·조건부 입력·정책 저장과 모바일 배치를 확인합니다. 기존 자격 발급/검증/교환 파일 회귀 테스트도 함께 실행합니다.

## 참고

- [React 통합](https://jsonforms.io/docs/integrations/react/)
- [조건부 UI 규칙](https://jsonforms.io/docs/uischema/rules/)
- [검증](https://jsonforms.io/docs/validation/)

추가 폼은 Field 정의에 타입·범위·선택지·showWhen을 선언하고 기존 서버 API와 명시적으로 연결합니다. 새로운 자격 속성을 도입하는 경우 서버 스키마·서명·Midnight 회로를 별도로 검토해야 합니다.
