import type {MidnightEvidence} from './midnight-evidence';

export const blockchainNodes = [
  {id:'source', title:'기업 자격', technology:'Ed25519 → Schnorr', description:'웹 원본의 서명과 현재 상태를 확인한 뒤, 같은 속성을 보유자에 연결한 Schnorr 자격으로 만듭니다. 이 연결 실행기는 원본을 처리하는 신뢰 주체입니다.'},
  {id:'proof', title:'영지식 증명', technology:'Compact · Proof Server', description:'계약 회로의 계산이 올바르다는 증명을 만듭니다. 기업 조건 제출에서는 비공개 속성·발급자 서명·보유자·취소 상태를 검사합니다. 증명 생성만으로 거래가 확정되지는 않습니다.'},
  {id:'balance', title:'거래 준비', technology:'Wallet SDK · DUST', description:'지갑 SDK가 거래를 준비하고 수수료에 필요한 DUST 자원을 확인합니다. 이 시연은 Local Devnet의 개발용 지갑을 사용합니다.'},
  {id:'submission', title:'노드로 전송', technology:'Midnight.js · Node', description:'증명이 포함된 거래를 Midnight 노드로 전송합니다. 거래 ID가 생겼더라도 아직 블록 확정과 구분해야 합니다.'},
  {id:'finality', title:'블록 확정', technology:'Ledger · Indexer', description:'확정 영수증과 인덱서에서 거래 결과·블록·계약 상태를 확인합니다. 원본 매출 대신 요청별 조건 판정 등이 공개 상태에 남습니다.'},
] as const;
export type BlockchainNode = typeof blockchainNodes[number]['id'];
export type BlockchainState = 'waiting'|'running'|'complete'|'blocked'|'unconfirmed'|'skipped';
export const blockchainStateNames:Record<BlockchainState,string>={waiting:'기록 대기',running:'진행 기록',complete:'완료 기록',blocked:'제출 차단',unconfirmed:'확정 미확인',skipped:'실행하지 않음'};
export const blockchainOperations:Record<string,string>={prepare:'실행 환경 준비',deploy:'스마트 계약 배포',registerIssuer:'발급기관 등록',advanceTime:'유효기간 기준 갱신',createRequest:'기관별 요청 등록',submit:'기업 조건 제출',revokeCredential:'체인 자격 취소'};
export const blockchainStages:Record<string,string>={proof:'증명 생성',balance:'거래 수수료 준비',submission:'노드로 제출',transaction:'거래 확정 확인','source-signature':'웹 원본 서명 확인','web-results':'동일 웹 요청 결과 대조',revocation:'취소 후 재사용 차단','wallet-sync':'지갑 동기화','dust-ready':'수수료 자원 확인'};

// A confirmation is visible only after its recorded finalized event AND matching
// sent transaction ID. Never infer confirmation from proof completion or timing.
export function blockchainProjection(report:MidnightEvidence,cursor:number){
  const index=Math.max(0,Math.min(report.events.length-1,Number.isFinite(cursor)?Math.floor(cursor):0));
  const states:Record<BlockchainNode,BlockchainState>={source:'waiting',proof:'waiting',balance:'waiting',submission:'waiting',finality:'waiting'};
  const confirmed=new Set<string>();
  let txId:string|undefined,receipt:MidnightEvidence['receipts'][number]|undefined;
  let focus:BlockchainNode='source',blocked=false;
  for(const e of report.events.slice(0,index+1)){
    if(e.stage==='transaction'&&e.status==='pending'){
      for(const id of ['proof','balance','submission','finality'] as const)states[id]='waiting';
      txId=undefined;receipt=undefined;focus='proof';
    }
    if(e.stage==='source-signature'&&e.status==='verified'){states.source='complete';focus='source';}
    if(e.stage==='proof'||e.stage==='balance'||e.stage==='submission'){
      focus=e.stage;states[e.stage]=e.status==='complete'||e.status==='sent'?'complete':e.status==='failed'?'unconfirmed':'running';
      if(e.stage==='submission'&&e.status==='sent')txId=e.txId;
    }
    if(e.stage==='transaction'&&e.status==='finalized'){
      receipt=report.receipts.find(r=>r.txId===txId&&r.operation===e.operation);
      states.finality=receipt?'complete':'unconfirmed';focus='finality';
      if(receipt)confirmed.add(receipt.txId);
    }
    if(e.stage==='transaction'&&e.status==='unconfirmed'){states.finality='unconfirmed';focus='finality';}
    if(e.stage==='revocation'&&e.status==='blocked'){
      blocked=true;states.proof='blocked';states.balance='skipped';states.submission='skipped';states.finality='skipped';focus='proof';
    }
  }
  const revoked=report.receipts.some(r=>r.operation==='revokeCredential'&&confirmed.has(r.txId));
  return {index,event:report.events[index],states,focus,txId,receipt,confirmed,revoked,blocked};
}

export function blockchainChapters(report:MidnightEvidence){
  const startOfTransaction=(txId:string)=>{
    const sent=report.events.findIndex(e=>e.stage==='submission'&&e.status==='sent'&&e.txId===txId);
    if(sent<0)return -1;
    for(let i=sent;i>=0;i--)if(report.events[i].stage==='transaction'&&report.events[i].status==='pending')return i;
    return sent;
  };
  return [
    {label:'계약 준비',index:0},
    {label:'원본 연결',index:report.events.findIndex(e=>e.stage==='source-signature')},
    ...report.outcomes.map(o=>({label:o.scenario==='buyer'?'구매사 증명':o.scenario==='grant'?'지원사업 증명':'미충족 판정',index:startOfTransaction(o.receipt.txId)})),
    {label:'자격 취소',index:startOfTransaction(report.receipts.find(r=>r.operation==='revokeCredential')?.txId??'')},
    {label:'재사용 차단',index:report.events.findIndex(e=>e.stage==='revocation'&&e.status==='blocked')},
  ].filter(c=>c.index>=0);
}
