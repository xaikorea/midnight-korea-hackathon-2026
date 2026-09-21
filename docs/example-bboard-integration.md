# example-bboard 핵심 패턴 적용

검토일: 2026-09-21. 공식 저장소 기준 commit: `38bfac8c574abb0c5a96c9e076779716c3e88231`.

참고: https://github.com/midnightntwrk/example-bboard/tree/38bfac8c574abb0c5a96c9e076779716c3e88231

공식 코드를 읽고 설계 패턴을 기존 BizProof API와 UI에 맞춰 독립 구현했다. 샘플 전체를 설치하거나 게시판 회로로 교체하지 않았다. upstream 라이선스는 Apache-2.0이며 원본 파일을 추후 복사할 경우 저작권 및 라이선스 고지를 함께 보존해야 한다.

## 비교와 적용

| 공식 샘플의 핵심 | BizProof 적용 |
|---|---|
| API 계층에서 deploy/join/callTx를 묶음 | 기존 BizProofClient의 deploy/join/submit 및 관리 회로 유지 |
| BrowserDeployedBoardManager의 진행/성공/실패 상태 | 모든 SDK 배포·회로 거래에 TransactionMonitor 연결, watchTransactions 구독 제공 |
| state$ 구독으로 화면을 갱신하고 unmount 시 해제 | 기존 SDK watch 검증 구독 유지. 웹은 로컬 HTTP 브리지 제약에 맞춰 10초 자동 조회 및 해제 구현 |
| 지갑 provider 공유 및 작업 중 UI 차단 | 기존 계정·네트워크 검증과 exclusive 실행 유지. 모니터에서도 중복 실행 거절 |
| 공개 상태와 비공개 키로 소유권 판정 | 기존 holder/administrator 회로 권한 유지. 게시판 owner 판정을 기업의 법적 대표 권한으로 대체하지 않음 |

## SDK 거래 상태

`contracts/sdk/client.ts`의 `watchTransactions(listener)`는 현재 상태를 즉시 알리고 이후 변경을 알린다.

- idle: 아직 거래 없음.
- pending: SDK 거래 실행 중. proof/지갑/네트워크 중 어느 단계인지 추정하지 않는다.
- finalized: publicReceipt가 전체 성공 확정을 검증한 후 공개 영수증만 전달.
- unconfirmed: 성공 확정을 확인하지 못함. 요청이 이미 전송됐을 수 있으므로 자동 재시도하지 않는다.

콜백 예외는 거래 실행 결과에 영향을 주지 않는다. 알림은 복제한 객체를 제공해 소비자 변경으로 내부 상태가 바뀌지 않는다. 알림에는 원시 SDK 오류, 비공개 상태, 거래 원문을 넣지 않는다. 원래 SDK 메서드의 오류 반환 계약은 유지한다.

```ts
const subscription = client.watchTransactions(state => {
  // 공개 상태만 소비한다. unconfirmed는 실패 확정과 다르다.
  renderTransactionState(state);
});
try {
  const receipt = await client.submit(chainRequestId);
  savePublicReceipt(receipt);
} finally {
  subscription.unsubscribe();
}
```

`runNetworkReuse()`에도 선택적인 `onTransaction(role, state)`를 추가해 관리자/보유자의 거래 상태를 구분할 수 있다. 클라이언트 종료 시 리스너를 제거한다. 이 구독은 메모리 상태이며 재시작 후 거래를 복원하는 영구 작업 큐는 아니다.

## 프런트엔드

설정 → Midnight.js 실행 및 체인 조회 → 배포된 컨트랙트 주소 입력 → **체인 자동 조회 시작**.

- 서버의 기존 인증·로컬 접근 제한·회로 검증을 그대로 통과한다.
- 응답의 컨트랙트 및 선택한 요청 식별값이 조회 대상과 같은지 확인한다.
- 완료된 조회 이후 10초를 기다려 다음 조회를 실행하므로 조회가 겹치지 않는다.
- 숨겨진 탭에서는 조회를 쉬고, 주소/요청 변경과 화면 종료 시 fetch를 취소한다.
- 오류 시 자동 조회를 중단하고 이전 결과가 과거 기록임을 표시한다. 사용자가 다시 시작할 수 있다.
- 자동 조회는 거래 실행 또는 SDK WebSocket 구독을 브라우저에 직접 연결한 기능이 아니다. 지갑 승인이나 거래 재전송을 수행하지 않는다.

## 검증 및 한계

- 루트/SDK 타입 검사, 변경 화면 lint 통과.
- 프로덕션 빌드 통과. 기존 500kB 초과 번들 경고는 남아 있다.
- SDK/지갑 테스트 10개 통과. 모니터 중복 차단, 알림 예외 격리, 상태 변조 방지, 불확실한 오류 후 자동 재시도 없음 확인.
- 브라우저: 실제 로컬 브리지의 산출물/미증명 거래 준비 검사와 자동 조회 시작/중지/503 오류/주소 변경 시 초기화/모바일 확인. 체인 조회 응답은 fixture이며 실 배포 증거가 아니다.
- 실제 proof 서버·자금 있는 지갑으로 배포 및 거래 확정은 이번에 수행하지 않았다. 웹 Ed25519 자격과 체인 Schnorr 자격 연결도 별도 미완료다.
- 샘플의 메모리 전용 private state나 원시 거래 로깅은 가져오지 않았다. 현재 암호화 저장소와 공개 DTO 경계를 유지한다.
