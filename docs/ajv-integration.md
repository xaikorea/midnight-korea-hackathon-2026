# Ajv 서버 입력 검증

기존 JSON Forms의 Ajv 8.17.1에 더해 서버용 standalone 검증기를 연결했습니다. [공식 standalone 기능](https://ajv.js.org/standalone.html)을 사용하여 빌드 전에 검증 함수를 생성하며 Cloudflare Worker 요청 처리 중 `new Function`이나 schema compile을 실행하지 않습니다.

## 적용

- `lib/schemas/business-inputs.json`: 버전이 명시된 draft-07 스키마. 기업 정보, 자격의 4개 속성, 구매/지원 정책을 정의합니다. `$ref`로 공통 문자열 규칙을 재사용합니다.
- `scripts/generate-validators.mjs`: strict/allErrors 활성화. coerceTypes/useDefaults/removeAdditional을 모두 끄고 명시적 자료형을 요구합니다. 미등록 keyword나 참조 오류는 코드 생성 시 실패합니다.
- `lib/generated/business-validators.ts`: 생성 파일. 직접 편집하지 않습니다. 검증기와 date/email/문자 길이 runtime helper만 서버에 포함됩니다.
- `lib/input-validation.ts`: 최대 20개의 항목 경로·규칙 코드·한국어 안내를 반환합니다. 오류에 원본 입력값을 담지 않습니다.
- 플랫폼 API의 기업 생성/프로필 정보 변경, 자격 발급/갱신/초안 발행, 초안 claims 저장, 정책 생성에 연결했습니다. 알 수 없는 속성, 문자열 숫자/불리언, 중복 발급기관, 크기 범위, 잘못된 달력 날짜를 거부합니다.
- 클라이언트 폼의 매출 범위와 지역 길이 제한은 같은 스키마 정의에서 읽습니다. UI 문자열→업무 숫자 변환은 기존 명시적 제출 어댑터에서만 수행합니다.

Ajv는 구조와 기본 형식을 검사합니다. 기존 Zod의 trim, 미래 설립일 차단, 최소·최대 매출 관계 및 업무 규칙은 유지합니다. 권한·발급기관 신뢰·기업 소유 관계·서명은 별도 검증합니다. 모든 API를 Ajv로 교체한 것은 아니며 임의 외부 JSON Schema나 원격 `$ref`를 받아 실행하지 않습니다.

## 개발과 검사

```text
npm run generate:validators
npm run check:validators
npm run test:ajv
node tests/ajv-api.cjs
```

생성물과 스키마 불일치를 check 명령으로 감지합니다. dev/build 진입점에서도 check를 실행하므로 스키마만 바꾸고 검증기를 갱신하지 않은 빌드는 차단됩니다. API 테스트는 실행 중인 localhost:5173 데모를 사용합니다. 입력 실패 시 자격 수와 저장 버전이 바뀌지 않는지, 0 매출이 유효하게 발급되는지, 미래 날짜의 기존 검증이 유지되는지 확인합니다.

[Ajv 저장소](https://github.com/ajv-validator/ajv)는 MIT 라이선스이며 설치 패키지에 라이선스가 포함됩니다. 브라우저 JSON Forms는 여전히 런타임 컴파일을 사용합니다. standalone 전환은 서버 검증에 적용됩니다.
