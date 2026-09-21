# BizProof 로고와 공개 접속 화면

2026-09-22 제작. 기존 자격 시연·인증·데이터 보존 흐름을 유지하며 접속 경험을 추가했다.

- 로고: 기업 자격 카드와 확인 표시를 결합한 벡터 심볼. 주색 #284CE8, 보조색 #B8F298.
- 원본: public/bizproof-logo.svg. 파비콘: public/favicon.svg, favicon.ico, favicon-32.png.
- 모바일 아이콘: public/apple-touch-icon.png (180), public/icon-192.png (192).
- 공유 카드: public/og-image.png (1200×630). Open Graph 및 Twitter large image 메타데이터 사용.
- 공개 홈과 /welcome: 단일 체험 시작 버튼, 데이터·세션 범위 안내, 가이드 연결.
- 접속 중 로고 애니메이션, 경로 로딩 화면, 워크스페이스 데이터 로딩 심볼 제공. prefers-reduced-motion을 존중한다.
- 접속 실패와 체험 한도 초과 시 원래 화면에서 안내 및 재시도 제공.
- /guide#guide-public-demo: 처음 방문한 사람을 위한 5분 시연, 공유 동의, 충족·미충족, 취소와 재사용 차단 설명. 기존 업무 메뉴에서도 가이드 제공.

검증: 타입 검사, ESLint(오류 없음), 배포용 단위 테스트 및 Node 런타임 테스트. 공개 브라우저에서 PC·390px 모바일, 가로 넘침 없음, 애니메이션 및 움직임 줄이기, 접속 로딩·429 안내, 실제 자격 재사용·취소 흐름 확인.

로컬 미리보기: outputs/welcome-desktop.png, outputs/welcome-mobile.png, outputs/welcome-loading.png.
공유 미리보기는 외부 서비스가 이전 이미지를 캐시하면 갱신까지 시간이 걸릴 수 있다.
