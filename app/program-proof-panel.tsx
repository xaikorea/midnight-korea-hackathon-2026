'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import type {publicProgramJob} from '@/lib/program-proof-jobs';
type Job=ReturnType<typeof publicProgramJob>;
const names:Record<Job['status'],string>={awaiting_approval:'관리자 승인 대기',queued:'실행기 대기',running:'증명·거래 처리 중',awaiting_verification:'독립 인덱서 대조 중',confirmed:'새 거래 검증 완료',needs_attention:'거래 대조·복구 필요',blocked:'새 실행 차단',cancelled:'요청 취소'};
const stages:Record<string,string>={wallet:'지갑 준비',deploy:'수치 계약 배포',source:'원본 자격 재검증',attestation:'Schnorr 자격 연결',proof:'영지식 증명 생성',balance:'거래 준비',submission:'네트워크 전송',create:'기관 조건 요청 등록',submit:'조건 결과 기록',indexer:'독립 인덱서 대조',failed:'실행 중단',recovered:'기존 거래 복구'};
async function call(path:string,body?:unknown){const r=await fetch(path,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const v=await r.json() as {jobs:Job[];autoRun?:boolean;error?:string};if(!r.ok)throw Error(v.error??'처리 상태를 확인하지 못했습니다.');return v;}
export default function ProgramProofPanel({administrator=false,applicationId}:{administrator?:boolean;applicationId?:string}){
 const path=administrator?'/api/admin/program-proof-jobs':'/api/program-proof-jobs';
 const [jobs,setJobs]=useState<Job[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[consent,setConsent]=useState(false),[autoRun,setAutoRun]=useState(false);const loading=useRef(false);
 async function load(){const v=await call(path);setJobs(v.jobs);setAutoRun(!!v.autoRun);}
 useEffect(()=>{let done=false;const update=()=>{if(document.visibilityState==='hidden'||loading.current)return;loading.current=true;void call(path).then(v=>{if(!done){setJobs(v.jobs);setAutoRun(!!v.autoRun);setError('');}}).catch(e=>{if(!done)setError(e.message);}).finally(()=>{loading.current=false;});};update();const timer=setInterval(update,10000);return()=>{done=true;clearInterval(timer);};},[path]);
 async function action(body:unknown){if(busy)return;setBusy(true);setError('');try{await call(path,body);setConsent(false);await load();}catch(e){setError(e instanceof Error?e.message:'처리 오류');}finally{setBusy(false);}}
 const visible=jobs.filter(j=>!applicationId||j.applicationId===applicationId),active=visible.some(j=>!['blocked','cancelled'].includes(j.status));
 return <section className="simple-card program-chain" aria-label={administrator?'신규 사례 체인 실행 관리':'신규 사례 블록체인 처리'}><h3>{administrator?'신규 사례 · Midnight 실행 관리':'Midnight에서 이 조건 확인하기'}</h3><p>합성 시연 · Local Devnet. 서버와 실행기가 원본을 검증하고, 새 계약에서 조건을 증명한 뒤 별도 검증기가 거래와 결과를 대조합니다. 기관의 접수·선정·공급사 승인은 포함하지 않습니다.</p>
 {!administrator&&autoRun&&<p className="program-success">공개 합성 시연은 실행 요청 후 관리자 승인 없이 자동 처리됩니다. 화면을 닫아도 접수된 서버 작업은 계속됩니다.</p>}
 {error&&<p className="program-error" role="alert">{error}</p>}
 {applicationId&&!active&&<><label className="simple-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={busy}/>이 신청의 합성 자격 원본을 실행 서버에서 처리하고 Local Devnet에 조건·가명 식별자·결과를 기록하는 데 동의합니다. 90분 동안 유효하며 원본 수치·PDF는 체인에 게시하지 않습니다.</label><Button disabled={!consent||busy} onClick={()=>void action({action:'request',applicationId,consent:true,scope:'synthetic-source-processing-and-local-devnet-90-minutes'})}>이 신청의 새 체인 실행 요청</Button></>}
 {visible.map(j=><article key={j.id} className="program-chain-job"><h4>{j.name} · {names[j.status]}</h4><p>작업 {j.id}</p>{j.reason&&<p role="status">{j.reason}</p>}<ol className="program-chain-stages">{['신청 동의',j.approvalMode==='automatic-synthetic'?'자동 실행 허용':'관리자 승인','증명·거래','독립 검증'].map((label,i)=>{const n={awaiting_approval:1,queued:2,running:2,awaiting_verification:3,confirmed:4,blocked:0,cancelled:0,needs_attention:2}[j.status];return <li key={label} className={n>i?'complete':n===i&&['running','awaiting_verification'].includes(j.status)?'processing':''}>{label}</li>;})}</ol>
 {j.verification&&<p className="program-success">독립 대조 완료 · 회로에서 확인한 조건 {j.verification.eligible?'충족':'미충족'} · 거래 영수증 {j.verification.receiptsVerified}건 · 공식 접수와 별도</p>}
 {j.coverage&&<p>증명 범위: {j.coverage.map(c=>({'finance-or':'매출 또는 투자','residents':'상주 인원','general-age':'일반 업력','new-industry-age':'신산업 업력','credential-binding':'기업 자격과 제출 요청 연결'}[c])).join(' · ')}</p>}
 <details><summary>실제 처리 단계·거래 영수증 ({j.receipts.length})</summary>{j.contractAddress&&<p>계약 <code>{j.contractAddress}</code></p>}<ol>{j.events.slice(-15).reverse().map((e,i)=><li key={i}>{new Date(e.at).toLocaleTimeString('ko-KR')} · {stages[e.stage]??e.stage} · {e.status}</li>)}</ol>{j.receipts.map(r=><p key={r.txId}>{r.operation} · 블록 {r.blockHeight}<br/><code>{r.txId}</code></p>)}</details>
 {administrator&&j.status==='awaiting_approval'&&<Button disabled={busy} onClick={()=>void action({action:'approve',id:j.id,revision:j.revision})}>이 신규 사례의 체인 실행 승인</Button>}
 {administrator&&j.status==='needs_attention'&&<Button disabled={busy} variant="outline" onClick={()=>void action({action:'resume',id:j.id,revision:j.revision})}>저장된 거래 대조 후 이어서 실행</Button>}
 {['awaiting_approval','queued'].includes(j.status)&&<Button disabled={busy} variant="outline" onClick={()=>void action({action:'cancel',id:j.id,revision:j.revision})}>실행 요청 취소</Button>}
 </article>)}
 {administrator&&!visible.length&&<p>아직 요청한 신규 사례 체인 작업이 없습니다.</p>}
 </section>;
}
