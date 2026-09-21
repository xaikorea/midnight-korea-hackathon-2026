# BizProof의 Midnight DApp Connector 적용

2026-09-20 기준. 공식 저장소의 API 명세와 설치된 `@midnight-ntwrk/dapp-connector-api` 4.0.1의 타입을 대조했다. 공개 main 문서와 배포 타입이 다른 경우 배포 타입을 따른다. 예를 들어 DUST는 bigint 하나가 아니라 `{balance, cap}`이다. 4.1.0-beta 계열의 서명 scheme 기능을 안정 버전 기능으로 간주하지 않는다.

## 적용한 기능

| 기능 | 적용 위치와 동작 |
| --- | --- |
| 여러 지갑 검색 | `lib/midnight-wallet.ts`에서 window.midnight를 검색한다. 안정 4.x 버전만 선택 목록에 표시하고 동일 이름·rdns 중복을 안내한다. rdns는 인증된 발급자 신원이 아니다. 이름은 React 텍스트로 표시하고 외부 아이콘은 자동 로드하지 않는다. |
| connect(networkId) | Preprod 또는 undeployed를 명시한다. 사용자가 버튼을 눌러 연결하며 자동 재연결하지 않는다. |
| hintUsage | 연결 시 상태·설정·주소만 요청한다. DUST, 내역, 증명, 거래 보정, 제출은 해당 기능을 실행할 때만 권한 범위를 요청한다. |
| 연결 수명 관리 | WalletSession은 메모리에만 보관한다. 화면 종료·역할 변경·선택 변경·화면 이탈 후 늦게 완료된 요청을 폐기한다. 계정·네트워크 변경 시 재연결을 요구한다. 보이는 화면에서 30초 간격과 창 복귀 시 상태를 확인한다. |
| DUST | 버튼을 눌렀을 때만 balance와 cap을 조회한다. BigInt를 문자열로 표시해 정밀도를 보존한다. 원시 단위이며 특정 거래의 수수료 충족 판단으로 사용하지 않는다. |
| getTxHistory | 버튼을 눌렀을 때 페이지당 5건을 조회한다. 전송 대기·포함됨/확정 대기·폐기·확정 및 실행 실패 포함을 구분한다. 지갑 전체 기록이며 기업 자격 검증 기록으로 사용하지 않는다. 현재 API 요청은 페이지 1부터 시작한다. 공식 타입은 시작 번호를 명시하지 않으므로 실제 지갑 통합 시 페이지 순서를 확인해야 한다. |
| APIError | 오류 클래스 instanceof에 의존하지 않고 type/code로 지갑 오류를 처리한다. 권한 거절을 연결 성공으로 처리하지 않으며 연결이 유효하면 선택 조회만 실패한다. 외부 reason·message는 그대로 표시하지 않는다. |
| getProvingProvider | SDK의 bindDappWallet에 KeyMaterialProvider를 명시하면 공식 createProofProvider로 연결한다. 증명 전후 계정·네트워크를 확인하고 오류 시 HTTP 서버로 자동 전환하지 않는다. |
| 지갑 서비스 설정 | useWalletIndexer를 명시하면 지갑의 HTTP/WS 인덱서를 사용한다. 프로토콜과 URL 사용자 정보 등을 검증하고 이후 설정 변경 시 중단한다. 원격은 HTTPS/WSS, 로컬 undeployed의 loopback만 HTTP/WS를 허용한다. 서버의 공개 API에 임의 URL 전달 기능은 추가하지 않았다. |
| 거래 보정·제출 | 기존 SDK 어댑터에 단계별 권한 요청, 중복 승인 방지, 승인 전후 TTL 확인, 계정·설정 변경 검사와 payFees=true를 추가했다. submitTransaction의 void 반환을 확정 성공으로 처리하지 않는다. |

## SDK 사용

```ts
// 이미 사용자 승인으로 연결한 ConnectedAPI와 실행 가능한 SDK 호스트가 필요하다.
const wallet = await bindDappWallet(connectedApi, 'preprod', {
  useWalletIndexer: true,
  keyMaterialProvider: zkConfigProvider.asKeyMaterialProvider(),
});
const client = new BizProofClient({
  network: 'preprod', wallet, role: 'holder',
  storageDirectory: '.midnight-private', passwordProvider,
});
```

이 설정은 지갑 제공 증명과 인덱서를 명시적으로 선택한다. 옵션을 생략한 기존 로컬 CLI는 기존 HTTP proof provider·고정 인덱서를 사용한다. 비공개 증명 입력이 어느 제공자로 전달되는지는 실행 전에 운영자가 확인해야 한다. 사용자별 서비스 URL이나 증명 입력은 서버 로그·공개 DTO에 추가하지 않았다.

현재 Node SDK 호스트는 브라우저의 window.midnight에 직접 접근할 수 없다. 이 변경은 ConnectedAPI를 이미 이용할 수 있는 호스트의 어댑터이며, 브라우저와 Node 사이 원격 호출 통로를 완성한 것은 아니다. 웹 UI의 버튼은 조회 기능만 실행한다. 기존 웹 Ed25519 기업 자격과 체인 Schnorr 자격의 자동 동기화도 별도 작업이다.

## 선택하지 않은 기능

- makeTransfer, makeIntent, 토큰별 shielded/unshielded 잔액 전체 수집: 기업 조건 증명에 필요하지 않아 적용하지 않았다.
- signData 기반 기업 인증: 지갑 서명은 법인 자격·대표 권한의 사실성을 증명하지 않는다. 검증 가능한 인증 프로토콜 없이 로그인이나 기업 인증으로 사용하지 않았다.
- 화면 연결 종료는 로컬 객체와 조회 데이터를 지운다. API 4.0.1에는 disconnect/revokePermissions가 없으므로 사이트 권한 철회는 지갑 설정에서 수행한다.
- 실제 체인 전송의 확정은 기존 SDK 인덱서 영수증 경로에서 확인해야 한다. 전송 실패를 자동 재시도하지 않는다.

## 검증

- API 테스트: 안정 버전 필터, 중복 지갑, 필요한 권한만 요청, 큰 잔액 정밀도, 권한 거절, 계정 변경, 종료 뒤 늦은 응답, 부분 실행 실패 구분.
- 브라우저 테스트: 테스트용 window.midnight를 주입하여 실제 React 화면의 연결·조회·권한 거절·계정 변경·승인 취소·모바일 가로 넘침을 검증한다.
- SDK 테스트: 주소 코덱, 지갑 증명 위임 경로, 권한 거절 시 실패 유지, 계정 변경, 서비스 URL 검증·변경 감지. 증명 위임 테스트의 거래와 prover는 테스트 대역이며 암호학적 proof가 아니다.
- 실행 명령: `node tests/dapp-connector.cjs`, `node tests/dapp-connector-ui.cjs`, `npm run test:sdk`, `npm run typecheck`, `npm run typecheck:sdk`.
- 실제 지갑 확장·증명 생성·노드 제출·체인 확정은 이번 변경에서 검증하지 않았다.

## 근거와 라이선스

- [공식 저장소](https://github.com/midnightntwrk/midnight-dapp-connector-api)
- [공식 명세](https://github.com/midnightntwrk/midnight-dapp-connector-api/blob/main/SPECIFICATION.md)
- [릴리스 내역](https://github.com/midnightntwrk/midnight-dapp-connector-api/releases)
- 설치 패키지의 Apache-2.0 LICENSE를 유지한다. 4.1 beta의 새 npm scope로 의존성을 무조건 교체하지 않고 기존 SDK와 맞는 안정 4.0.1을 유지했다.
