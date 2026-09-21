# OpenBao 저장 데이터 보호

## 적용한 기능과 선택 이유

현재 BizProof는 Ed25519 발급 개인키, 기업 속성, 검증 기록을 하나의 D1 워크스페이스 JSON에 보관합니다. 이 저장 경로에 OpenBao Transit의 AES-256-GCM 암호화, 사용자별 context, 키 버전 관리, rewrap을 연결했습니다. 저장소 유출 시 개인키와 원본 기업 속성이 그대로 노출되는 문제를 줄이는 것이 목적입니다.

OpenBao를 Keycloak 로그인이나 Midnight 증명 엔진으로 사용하지 않습니다. KV 비밀 배포, 동적 DB 계정 발급, PKI 인증서 발급은 현재 Cloudflare D1/R2 binding 구조에 바로 필요한 기능이 아니어서 추가하지 않았습니다. 서명을 OpenBao Transit 내부로 이동하는 작업도 이번 범위에 포함하지 않습니다. 기존 Ed25519/JWT 서명 호환성을 유지합니다.

## 동작

- `BIZPROOF_STORAGE_PROTECTION=openbao`에서 모든 새 워크스페이스 및 저장 작업을 Transit으로 암호화합니다. `lib/store.ts`에 연결하여 자격·담당자 권한·증빙 메타데이터 등 기존 저장 경로에 동일하게 적용합니다.
- AES 키는 OpenBao에 남고 D1에는 `bizproof-openbao-v1` envelope와 `vault:vN:` 암호문만 기록됩니다. owner 식별자와 SQL version은 평문 메타데이터입니다.
- 사용자 ID를 도메인 구분 후 SHA-256한 값을 context로 사용합니다. 다른 사용자 행으로 암호문을 옮겨도 정상 복호화되지 않습니다. 이는 애플리케이션의 소유자 접근 제어를 대체하지 않습니다. 서비스 토큰 자체는 전체 워크스페이스용 권한입니다.
- 쓰기 전 키가 aes256-gcm96, derived=true, exportable=false, allow_plaintext_backup=false인지 확인합니다.
- 기존 평문 행은 읽기를 유지하고 다음 성공적인 저장에서 암호화됩니다. 관리자는 설정의 **기존 데이터 암호화**로 현재 워크스페이스를 즉시 전환할 수 있습니다. 다른 사용자 행의 일괄 마이그레이션은 수행하지 않습니다.
- **최신 키로 암호문 갱신**은 Transit rewrap을 호출합니다. 이 작업은 앱 서버에 평문을 반환하지 않으며 D1 버전을 비교하여 동시 변경을 덮어쓰지 않습니다. 일반 업무 읽기는 복호화가 필요합니다.
- 오류 시 평문 저장으로 대체하지 않습니다. 암호화된 행은 demo 모드로 되돌리기만 해서 열 수 없습니다. 앱에는 암호화 해제/키 삭제 기능을 제공하지 않습니다.

## 로컬 설치 및 활성화

Docker Desktop이 필요합니다. OpenBao 2.6.0 이미지와 파일 저장소를 사용하는 로컬 구성입니다. 자동 초기화·자동 unseal·root token 커밋은 하지 않습니다.

```powershell
docker compose -f integrations/openbao/compose.yaml up -d
docker compose -f integrations/openbao/compose.yaml exec openbao bao operator init
```

init 출력의 unseal 키와 초기 root token은 별도 안전한 장소에 보관합니다. 로그나 채팅에 붙여넣지 마세요. 기본 quorum을 충족할 때까지 아래 명령을 반복하고 프롬프트에서 서로 다른 unseal 키를 입력합니다.

```powershell
docker compose -f integrations/openbao/compose.yaml exec openbao bao operator unseal
docker compose -f integrations/openbao/compose.yaml exec openbao bao login
docker compose -f integrations/openbao/compose.yaml exec openbao bao audit enable file file_path=/bao/logs/audit.json
docker compose -f integrations/openbao/compose.yaml exec openbao bao secrets enable transit
docker compose -f integrations/openbao/compose.yaml exec openbao bao write transit/keys/bizproof-workspaces type=aes256-gcm96 derived=true exportable=false allow_plaintext_backup=false
docker compose -f integrations/openbao/compose.yaml exec openbao bao policy write bizproof-app /bao/config/app-policy.hcl
docker compose -f integrations/openbao/compose.yaml exec openbao bao token create -policy=bizproof-app -no-default-policy -ttl=24h
```

login 프롬프트에 초기 관리자 token을 입력합니다. 마지막에 발급한 **제한된 앱 토큰**을 루트 `.dev.vars`에 설정합니다. root token을 앱에 넣지 마세요. 설정 파일은 gitignore 대상입니다.

```dotenv
BIZPROOF_STORAGE_PROTECTION=openbao
OPENBAO_ADDR=http://localhost:8200
OPENBAO_TOKEN=제한된_앱_토큰
OPENBAO_TRANSIT_MOUNT=transit
OPENBAO_TRANSIT_KEY=bizproof-workspaces
```

개발 서버를 재시작하고 관리자 역할의 설정 화면에서 연결과 현재 데이터 상태를 확인한 뒤 암호화 버튼을 사용합니다. mount/key 이름을 변경하면 정책도 함께 조정해야 합니다. 이미 저장한 데이터가 사용하는 키 이름은 임의로 변경하지 마세요.

앱 토큰은 자동 갱신하지 않습니다. 만료 전에 운영자가 갱신 또는 재발급하고 Worker secret을 교체해야 합니다. 컨테이너 재시작 후에는 다시 unseal해야 합니다. 감사 장치 쓰기 실패나 sealed 상태에서는 요청이 실패할 수 있으며 앱은 작업 실패로 처리합니다.

## 키 회전과 접근 통제

운영자 계정으로 다음 명령을 실행한 뒤 앱에서 해당 워크스페이스의 암호문을 갱신합니다.

```powershell
docker compose -f integrations/openbao/compose.yaml exec openbao bao write -f transit/keys/bizproof-workspaces/rotate
```

앱 정책에는 지정 키 metadata 읽기와 encrypt/decrypt/rewrap만 있습니다. 키 생성·회전·삭제·내보내기·정책 변경·감사 해제 권한은 없습니다. 암호문 갱신은 OpenBao 감사 기록에 남습니다. 앱 내 `storage.protect` 이벤트와 OpenBao 감사 로그는 별개이며 rewrap 시 앱 업무 감사 배열을 수정하기 위해 복호화하지 않습니다.

모든 활성 데이터와 보존할 백업의 키 버전을 확인하기 전에는 min_decryption_version을 올리거나 이전 키를 삭제하지 마세요. 파일 볼륨과 unseal 키 손실은 복구 불능으로 이어질 수 있습니다. 운영에서는 TLS, 백업/복구, HA, 네트워크 접근 및 서비스 인증 수명 정책이 필요합니다. Cloudflare 배포 환경에는 Worker에서 접근 가능한 HTTPS 주소와 secret binding을 사용해야 하며 로컬 loopback 주소를 사용할 수 없습니다.

## 보호 범위와 확인 결과

애플리케이션 서버는 서명과 조건 판정을 위해 복호화된 개인키·속성을 메모리에서 처리합니다. 외부 서명 서비스나 HSM 수준의 비반출 서명은 아닙니다. Transit 요청에는 평문이 전달되므로 운영 TLS가 필수입니다. 사용자별 context는 다른 사용자 간 암호문 교체를 막지만 같은 사용자의 과거 DB 스냅샷 복원까지 막는 anti-rollback 장치는 아닙니다.

R2 첨부파일 내용, 기존 D1 이력·백업·내보낸 파일, Midnight 로컬 키 저장소와 Keycloak 세션 secret은 이 암호화 범위에 포함되지 않습니다. 기존 평문 행을 갱신해도 과거 백업의 평문이 소급 삭제되지 않습니다. 워크스페이스 평문 크기는 900,000바이트로 제한하며 초과 시 저장 실패로 처리합니다.

`node tests/openbao.cjs`: 실제 AES-GCM을 사용하는 모의 Transit 서버로 어댑터, context, 변조, rewrap, 정책, 장애, D1 저장 및 충돌 처리를 검사합니다. 모의 테스트는 OpenBao 서버의 암호 구현이나 배포 성공을 증명하지 않습니다. 현재 Docker 엔진이 실행되지 않아 실제 서버 init/unseal, 감사 로그, 암호화 왕복은 검증하지 못했습니다.

## 공식 참고 자료

- [OpenBao 소스 및 MPL-2.0 라이선스](https://github.com/openbao/openbao)
- [Transit: 암호화, context, 회전, rewrap](https://openbao.org/docs/secrets/transit/)
- [설치 및 공식 컨테이너](https://openbao.org/docs/install/)
- [감사 장치](https://openbao.org/docs/audit/)

OpenBao 서버 소스를 복사하지 않고 공식 HTTP 인터페이스를 사용합니다. 컨테이너를 재배포할 때에는 해당 이미지의 라이선스와 고지 의무를 확인하세요.
