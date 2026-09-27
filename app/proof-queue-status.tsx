import type {ProofQueueStatus} from '@/lib/proof-queue';
export default function ProofQueueStatusView({queue,jobId}:{queue?:ProofQueueStatus;jobId?:string}){
 if(!queue)return null;
 const position=jobId?queue.positions.find(p=>p.id===jobId):undefined;
 return <aside className="issuance-boundary proof-queue-status" aria-label={jobId?'이 작업의 대기 안내':'체인 대기 현황'}>
  {!jobId&&<><b>체인 대기 현황</b><p>대기 {queue.waiting}건 · 실행 {queue.running}건 · 검증 {queue.verifying}건 · 동시 접수 한도 {queue.capacity}건</p><p>{queue.accepting?'새 실행 요청을 받을 수 있습니다.':'대기열이 가득 찼습니다. 저장된 준비 기록에서 나중에 다시 요청하세요.'}</p><p>실행기: {queue.workers.executor?.recent?'최근 응답 확인':queue.workers.executor?.lastSeen?'최근 응답이 없어 지연될 수 있음':'연결 상태 확인 전'} · 검증기: {queue.workers.verifier?.recent?'최근 응답 확인':'연결 상태 확인 필요'}</p><small>{queue.estimateNotice} 최근 표본 {queue.sampleCount}건.</small></>}
  {position&&<><b>앞선 작업 {position.ahead}건</b><p>예상 대기 약 {Math.ceil(position.estimatedWaitSeconds/60)}분 · 동의 유효시간 약 {Math.ceil(position.remainingSeconds/60)}분 남음</p>{position.expiryRisk&&<p role="status">현재 대기량으로는 동의 만료 전에 끝나지 않을 수 있습니다. 만료되면 거래 상태를 확인한 뒤 새 동의로 요청하세요. 동의를 자동 연장하지 않습니다.</p>}<small>추정치이며 처리 완료 시각을 보장하지 않습니다. 취소 반영 작업은 먼저 처리할 수 있습니다.</small></>}
 </aside>;
}
