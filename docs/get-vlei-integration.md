# Get a vLEI 페이지 반영 — 2026-09-21

출처: https://www.gleif.org/en/organizational-identity/get-an-lei-vlei/get-a-vlei

- 기존 조직 신원 포털에 `?view=trust#identity-get-vlei` 발급 안내 추가. 상단 버튼 및 좌측 목차에서 접근.
- 원형 노드와 연결 화살표로 법인 vLEI / 공식 조직 역할(OOR) vLEI 두 단계 흐름을 재구성. 상세 원본 도식을 간략화했으며 인증 완료 상태가 아니다.
- 공식 페이지에 게시된 8개 발급기관 이름·웹사이트·LEI·자격 획득일을 서버 디렉터리에 반영.
- `/api/qvi`는 로그인 사용자에게 확인일이 명시된 정적 스냅샷 제공. 이름/LEI 검색, 이름/획득일 정렬, 검색 조건 검사, 기관 LEI 체크섬 및 HTTPS 검증.
- `live:false` 명시. 자동 동기화 또는 암호학적 신뢰 레지스트리가 아니며 BizProof 내부 발급기관 등록에 영향을 주지 않는다.
- 기관 홈페이지와 GLEIF LEI 조회 링크, 최신 공식 목록 링크 제공. 외부 신청 자동 제출/개인정보 전송 없음.
- 기존 LEI 조회로 이동하고 프로젝트 데모 발급 작업실은 별도로 표시.
- TypeScript/ESLint/운영 빌드 통과(기존 번들 크기 경고 유지). `get-vlei.cjs` API 입력/목록/검색/정렬/빈 결과/링크/모바일 통과. 기존 `identity-portal.cjs` 회귀 검증.

화면: outputs/get-vlei-desktop.png, outputs/get-vlei-mobile.png
