# 제출 자료 안내

- [프로젝트 개요](../README.md): 문제, 제품 흐름, 기술과 실제 검증 범위.
- [심사자 실행 안내](hackathon-runbook.md): 로컬 웹·Compact 컴파일·실제 Devnet 재현.
- [제출 설명과 증거](submission-notes.md): 서로 다른 실행 사례, 확인한 결과와 남은 항목.
- [공개 구성](public-deployment.md): 서버 역할과 배포 예제.
- [프라이버시와 신뢰 경계](privacy-architecture.md): 원본 처리 주체, 공개 정보, ZK의 한계.
- [별도 발급·체인 연결](issued-midnight-integration.md): 승인, 원래 신청 연결, 거래 대조, 취소.
- [운영·복구 예제](operations-runbook.md): 비밀 설정 분리, 백업, 중복 실행 방지.
- [브라우저 검증](browser-testing.md): 개인 PC 설정 없이 선택적 화면 시험.
- [실제 인증 연결 조건](identity-provider-acceptance.md): 준비된 코드와 실제 공급자 인수시험의 구분.
- [고객 검증 양식](customer-validation.md): 아직 입증하지 않은 실사용 효과의 검증 계획.

각 `*-integration.md`는 해당 기능과 선택적 오픈소스 어댑터의 사용 범위를 설명한다. 어댑터 코드의 존재를 공식 기관 인증이나 실서비스 연동 완료로 해석하지 않는다. 과거 내부 검토·비용·실제 운영 자산·승인 대화는 제출 자료에 포함하지 않는다.

공개 자료에는 합성 데이터와 허용된 검증 필드만 포함한다. 발급 원본, 세션, 비밀키, 실제 방문자 원장, 배포 상태 파일은 로컬 또는 접근 제한 운영 저장소에서 관리한다.
