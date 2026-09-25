# 운영·복구 예제

공개 코드의 운영 원칙과 재현 방법이다. 실제 접속 정보, 운영 원장, 비밀 설정과 복구 파일은 포함하지 않는다. 확인된 실행 범위는 [공개 구성](public-deployment.md)을 참고한다.

## 승인 작업 실행

`contracts/sdk/worker-service.mjs`는 승인된 작업을 순서대로 처리한다. 실행기와 검증기는 서로 다른 인증·서명 설정과 상태 디렉터리를 사용한다.

```sh
# 설치 환경에서 준비한 비밀 설정과 기존 상태를 지정한다.
export BIZPROOF_PROOF_CONFIG=/private/executor.json
export BIZPROOF_PROOF_STATE_DIR=/private/executor-state
node contracts/sdk/worker-service.mjs executor --watch
# 별도 프로세스·계정에서 검증기를 실행한다.
export BIZPROOF_PROOF_CONFIG=/private/verifier.json
export BIZPROOF_PROOF_STATE_DIR=/private/verifier-state
node contracts/sdk/worker-service.mjs verifier --watch
```

- 일반 신청 접수와 체인 확정은 별도 상태다. 원래 동의·신청과 관리자 승인이 있어야 실행한다.
- 별도 검증기만 원래 신청, 계약 코드, 확정 영수증과 판정을 대조해 최종 확인을 등록한다.
- 실행기 하나는 체인 쓰기를 순차 처리한다. Linux kernel flock은 비정상 종료 후 잠금을 해제한다. 상태 저장소·거래 journal·서버 lease는 유지한다.
- 실패·만료 lease·불확실한 거래는 자동 재전송하지 않는다. 기존 거래를 대조하고 운영자의 재개 승인을 받는다.
- 발급 원장이 취소한 자격은 새 사용을 차단한다. 체인 취소 전파는 별도 단계이며 과거 성공 기록을 현재 자격 유효성으로 해석하지 않는다.

Compose와 systemd 예제는 `deploy/nhn/`에 있다. 노드·인덱서·증명 API는 인터넷에 직접 공개하지 않는다. 배포 시 계정별 주소와 접근 정책을 입력한다. 키와 원본 속성을 로그로 출력하지 않는다.

## 백업과 분리 복원

`deploy/nhn/backup.py`, `check-backup.py`, `encrypted-backup.py`, `restore-drill.py`는 다음을 지원한다.

1. 웹·발급 SQLite를 읽기 전용으로 snapshot하고 무결성·파일 manifest를 검사한다.
2. 작업의 발급 자격·취소 상태 연결을 확인한다. 필수 파일이 없으면 빈 DB를 만드는 대신 실패한다.
3. RSA-OAEP-SHA256/AES-256-GCM으로 외부 보관 사본을 암호화한다. 복호화 키는 별도 접근 제한 위치에 보관한다.
4. 암호화 사본만 전송하고 크기·해시·형식·중복 여부를 확인한다. 전송 실패는 성공으로 처리하지 않는다.
5. 기존 서비스를 덮어쓰지 않는 격리 환경에서 복원하고 발급·신청·취소·접근 격리를 검증한다.

두 DB는 순차 snapshot이며 분산 원자적 백업은 아니다. 웹 DB 복원만으로 체인 원장·인덱서·실행기 비밀 상태·모든 세션·자동 서비스 전환의 복원을 입증하지 않는다. 실제 복구 시 해당 시점의 체인과 실행기 journal을 대조하기 전 거래를 재개하지 않는다. 앱 이미지 롤백만을 위해 발급 원장의 취소 이력을 과거로 되돌리지 않는다.

`ship-backups.py`, `receive-backup.py`, 각 systemd timer와 health 스크립트는 설치 예제다. 예제가 있다는 사실만으로 특정 환경에서 자동 복제·외부 알림·고가용성이 보장되지는 않는다. 디스크·백업 신선도·프로세스 상태와 복구 가능성을 설치 환경에서 확인한다.

## 외부 연결과 남은 조건

공개 체험 수용량은 `BIZPROOF_DEMO_MAX_ACTIVE`(기본 5), 네트워크별 시간당 새 체험은 `BIZPROOF_DEMO_PER_IP_HOUR`(기본 10)로 설정한다. 두 값은 1~100의 정수만 허용하고 잘못된 값으로 무제한 개방하지 않는다. NHN에서는 `runtime.env`에 주입한다. 실제 서버 부하 검증 후 조정하며 이 설정 변경만으로 처리 용량이 보장되지는 않는다. SQLite의 원자적 세션 할당에도 같은 상한을 사용한다. 한도에 도달하면 사유와 대략적인 재시도 시간을 안내하고 기존 체험은 유지한다.

정책 편집에서 최대 업력과 고정 기준일·미만/이내를 함께 입력할 수 있다. 기준일은 원문에 정한 한국 달력 날짜이며 공고일 또는 입주 예정일일 수 있다. 기존 정책을 덮어쓰지 말고 새 정책을 생성한다. 원문 주소·회차는 정책 hash에 포함하지만 등록자의 참고 정보이며 기관의 공식 승인이나 원문의 자동 검증을 뜻하지 않는다. 기준일을 고정해도 자격·동의·요청의 만료 검사는 현재 시각을 사용한다.

현재 승인 작업은 `undeployed` Local Devnet을 사용한다. 공개 네트워크로 전환하려면 네트워크·계약·검증 영수증·지갑 출처를 함께 버전 관리하고 실제 거래를 검증해야 한다. 기존 기록의 네트워크 이름만 바꾸지 않는다.

실제 본인확인·문서 전자서명·기업 권한은 별도 공급자와 인수시험이 필요하다. [연결 조건](identity-provider-acceptance.md)과 [고객 검증 양식](customer-validation.md)을 참고한다. 공급자 미설정, 장애와 검증 실패를 성공으로 대체하지 않는다.
