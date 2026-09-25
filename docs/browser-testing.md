# 선택적 브라우저 검증

기본 설치의 개발 의존성에 Playwright 버전을 고정했다. 개발 PC 경로와 특정 서비스의 IP를 사용할 필요가 없다.

```sh
npx playwright install chromium
# 별도 셸에서 로컬 시연을 시작한다.
npm run demo:local
# 다른 셸에서 로컬 서버의 안내 화면을 검사한다.
SMOKE_BASE=http://127.0.0.1:3100 node tests/identity-pilot-ui.cjs
```

기본 채널은 Playwright Chromium이다. 설치된 Edge를 선택하려면 `PLAYWRIGHT_CHANNEL=msedge`를 설정한다. 별도 환경의 Playwright 패키지를 쓸 때만 `PLAYWRIGHT_PATH`에 모듈 경로를 지정한다. PowerShell에서는 `$env:SMOKE_BASE='http://127.0.0.1:3100'`처럼 환경 변수를 설정한다.

브라우저 검사는 파일마다 전제 조건이 다르다. 전체를 공개 서비스에 일괄 실행하지 않는다. 합성 데이터가 있는 격리된 로컬 서버를 사용하고 해당 파일의 초기 설명과 assertion을 확인한다.

관리자 화면 검사는 `TEST_ADMIN_PASSWORD`로 해당 테스트 환경의 비밀번호를 전달한다. 코드에 값을 적거나 비밀번호 파일을 저장소에 추가하지 않는다. 비밀번호 변경 검사는 기존대로 별도 로컬 시험 주소에서만 가능하다. 승인된 체인 작업의 검사는 실행 동의·관리자 승인·원래 신청의 연결을 유지한다.

`outputs/`에 저장되는 브라우저 상태, 쿠키, 원본 응답, 화면 캡처는 자동으로 공개할 자료가 아니다. 실제 개인정보나 인증정보가 없는지 확인한 합성 자료만 제출 패키지에 포함한다.
