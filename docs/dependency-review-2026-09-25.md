# 의존성 점검 — 2026-09-25

공개 저장소 전환 후 GitHub Dependabot과 npm audit 결과를 점검했다. 실제 폼에서 `$data`를 사용하는 Ajv를 8.18.0으로 수정했고, Vite 8.0.16 및 호환 범위 내 Babel·Browserslist·YAML·브라우저 매핑 등의 수정 버전을 반영했다. 생성된 검증기의 일치 여부와 전체 업무 회귀 검사를 통과했다.

- 루트 `npm audit --omit=dev`: 알려진 경고 **0개**.
- 루트 전체 `npm audit`: **13개 패키지 경고**(high 5, moderate 8). 개발 의존성을 포함한 수치이며 GitHub의 개별 보안 권고 건수와는 집계 기준이 다르다.
- 남은 경로: 현재 NHN 실행에 사용하지 않는 Cloudflare/Vinext·Wrangler 개발 스택과 Drizzle 개발 도구의 전이 의존성. 전체 개발 도구 경고가 해소된 것으로 표시하지 않는다.
- 실제 배포는 `next build --webpack`의 standalone 이미지다. 개발 서버는 loopback에만 바인딩한다.

후속 유지보수에서는 별도 Cloudflare/Vinext 빌드 검증과 함께 해당 스택을 올리거나 제거 여부를 결정해야 한다. `npm audit fix --force`가 제안하는 Drizzle 이전 버전 전환은 적용하지 않았다. 이 점검은 전체 애플리케이션 보안 감사를 대체하지 않는다.

재확인 명령: `npm audit --omit=dev`, `npm audit`, `npm run test:verification`.
