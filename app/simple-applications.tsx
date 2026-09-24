'use client';
import {useEffect,useRef,useState} from 'react';
import {Activity,ArrowRight,LoaderCircle,ShieldCheck,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import type {ViewState} from '@/lib/domain';
import type {ApplicationPreview} from '@/lib/application-flow';
import type {ApplicationBatchOutcome} from '@/lib/application-batch';
import ProcessConsole from './process-console';
import VerificationLink from './verification-link';
import {BlockchainEvidenceViewer} from './blockchain-visualizer';
import {Sheet,SheetClose,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {readProcessStream} from '@/lib/process-stream';
import type {ProcessRun} from '@/lib/process-types';
import './process-console.css';
import {applicationStatus,applicationStatusCopy} from '@/lib/application-status';

type Props={data:ViewState;refresh:()=>Promise<void>;go:(view:string)=>void};
type PreviewRow={policyId:string;preview?:ApplicationPreview;error?:string};
export default function SimpleApplications({data,refresh,go}:Props){
 const [company,setCompany]=useState(data.preparedDemo?.companyId??(data.companies.length===1?data.companies[0].id:''));
 const [selected,setSelected]=useState<string[]>([]),[choices,setChoices]=useState<Record<string,string>>({});
 const [rows,setRows]=useState<PreviewRow[]>([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[consent,setConsent]=useState(false);
 const [error,setError]=useState(''),[outcomes,setOutcomes]=useState<ApplicationBatchOutcome[]>([]),[attempt,setAttempt]=useState(0);
 const [processOpen,setProcessOpen]=useState(false),[processRun,setProcessRun]=useState<ProcessRun>();
 const [blockchainOpen,setBlockchainOpen]=useState(false);
 const keys=useRef<Record<string,string>>({});
 const policies=data.policies.filter(p=>p.status==='active'&&(!data.preparedDemo||data.preparedDemo.policyIds.includes(p.id)));
 const currentCompany=data.companies.find(c=>c.id===company);
 const existing=data.requests.filter(r=>r.companyId===company&&policies.some(p=>p.id===r.policyId)&&data.presentations.some(p=>p.requestId===r.id));
 const completed=(id:string)=>existing.find(r=>r.policyId===id&&['submitted','verified'].includes(applicationStatus(r,data.presentations.find(p=>p.requestId===r.id)))&&Date.parse(r.expiresAt)>Date.now());
 const allSubmitted=policies.length>0&&policies.every(p=>completed(p.id));
 const pendingIds=selected.filter(id=>!completed(id));
 const identity=JSON.stringify({company,ids:pendingIds,choices,version:data.version,attempt});
 // Consent belongs to precisely these recipients, credentials and state version.
 useEffect(()=>{
  const controller=new AbortController();const input=JSON.parse(identity) as {company:string;ids:string[];choices:Record<string,string>};
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setRows([]);setConsent(false);setError('');
  if(!input.company||!input.ids.length){setLoading(false);return()=>controller.abort();}
  setLoading(true);
  Promise.all(input.ids.map(async policyId=>{try{const r=await fetch('/api/platform',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({action:'prepare-application',companyId:input.company,policyId,...(input.choices[policyId]?{credentialId:input.choices[policyId]}:{})})});const value=await r.json() as ApplicationPreview & {error?:string};return r.ok?{policyId,preview:value as ApplicationPreview}:{policyId,error:value.error??'신청 내용을 확인할 수 없습니다.'};}catch{return {policyId,error:'연결 상태를 확인하고 다시 시도해 주세요.'};}})).then(result=>{if(!controller.signal.aborted){setRows(result);setLoading(false);}});
  return()=>controller.abort();
 },[identity]);
 const waiting=existing.some(r=>r.status==='submitted');
 useEffect(()=>{if(!waiting)return;const timer=setInterval(()=>void refresh(),30000);return()=>clearInterval(timer);},[waiting,refresh]);
 const ready=rows.length===pendingIds.length&&rows.length>0&&rows.every((r,i)=>r.policyId===pendingIds[i]&&r.preview?.companyId===company&&r.preview.ready)&&!loading;
 const commonSharing=ready&&rows.every(r=>JSON.stringify([r.preview!.shared,r.preview!.excluded])===JSON.stringify([rows[0].preview!.shared,rows[0].preview!.excluded]));
 function toggle(id:string){if(busy)return;setConsent(false);setOutcomes([]);setSelected(current=>current.includes(id)?current.filter(x=>x!==id):current.length<5?[...current,id]:current);}
 async function submit(){
  if(!ready||!consent||busy)return;setBusy(true);setError('');setProcessRun(undefined);setProcessOpen(true);
  const items=rows.map(row=>{const p=row.preview!,identity=company+':'+row.policyId+':'+p.previewHash;keys.current[identity]??=crypto.randomUUID();return {policyId:row.policyId,credentialId:p.selected!.id,key:keys.current[identity],previewHash:p.previewHash};});
  try{const r=await fetch('/api/platform',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'submit-applications',companyId:company,consent:true,items,observe:true})});const value=await readProcessStream(r,setProcessRun);setOutcomes(value.outcomes);setConsent(false);await refresh();}
  catch(e){setError(e instanceof Error?e.message:'제출 결과를 확인하지 못했습니다. 다시 확인하면 이미 완료된 신청은 제외됩니다.');await refresh();}
  finally{setBusy(false);}
 }
 return <div className="simple-workspace batch-workspace">
  <div className="simple-steps"><span className={!selected.length&&!existing.length?'active':''}>1 대상 선택</span><ArrowRight size={16}/><span className={pendingIds.length?'active':''}>2 공유 확인·제출</span><ArrowRight size={16}/><span className={existing.length&&!pendingIds.length?'active':''}>3 결과</span></div>
  <section className="simple-card batch-company"><ShieldCheck/><div><h2>{currentCompany?.name??'신청할 기업을 선택하세요'}</h2>{data.preparedDemo?<p>기업 정보와 서명된 자격이 미리 저장되어 있습니다. 추가 입력 없이 시작하세요.</p>:<p>보유한 기업 정보와 자격을 자동으로 확인합니다.</p>}{data.companies.length>1&&!data.preparedDemo&&<label className="simple-field">신청 기업<select aria-label="신청 기업" disabled={busy} value={company} onChange={e=>{setCompany(e.target.value);setSelected([]);setChoices({});setOutcomes([]);}}><option value="">기업 선택</option>{data.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}{!data.companies.length&&<Button onClick={()=>go('access')}>기업 연결 요청</Button>}</div></section>
  <div className="process-launcher"><div><Activity size={24}/><div><strong>서버에서는 어떻게 처리할까요?</strong><p>자격 검사·서명·기관별 검증·저장 기록을 직접 확인하세요.</p></div></div><div className="process-launcher-actions"><Button variant="outline" onClick={()=>setProcessOpen(true)}><Activity size={15}/>처리 과정 보기</Button><Button variant="outline" onClick={()=>setBlockchainOpen(true)}><ShieldCheck size={15}/>블록체인 흐름 보기</Button><a href="/process" target="_blank" rel="noopener noreferrer">별도 관제 창 ↗</a></div></div>
  {!allSubmitted&&<section aria-labelledby="batch-target-title"><div className="simple-heading"><h2 id="batch-target-title">어디에 제출하시겠어요?</h2>{policies.length>1&&<Button variant="outline" disabled={busy||!currentCompany} onClick={()=>{setSelected(policies.filter(p=>!completed(p.id)).slice(0,5).map(p=>p.id));setConsent(false);setOutcomes([]);}}>모두 선택</Button>}</div><p className="simple-note">{data.preparedDemo?'두 곳을 함께 선택해도 한 번만 제출하면 됩니다.':'최대 5개 대상을 함께 선택할 수 있습니다. 이미 제출한 신청은 아래에서 확인하세요.'}</p><div className="simple-targets">{policies.map(p=><button key={p.id} className="simple-target" aria-pressed={selected.includes(p.id)} disabled={!currentCompany||busy||!!completed(p.id)} onClick={()=>toggle(p.id)}><span className="simple-pill">{p.kind==='buyer'?'구매사 등록':'지원사업 신청'}</span><h3>{p.name}</h3><p>{p.audience}</p><b>{completed(p.id)?'제출한 신청':selected.includes(p.id)?'✓ 선택됨':'선택하기'}</b></button>)}</div>{!policies.length&&<p>현재 신청 가능한 대상이 없습니다.</p>}</section>}
  {pendingIds.length>0&&<section className="simple-card batch-review" aria-label="공유 확인"><h2>선택한 기관에 전달할 내용을 확인하세요</h2>{commonSharing&&<div className="batch-common-sharing"><p><strong>공유:</strong> {rows[0].preview!.shared.join(" · ")}</p><p><strong>전달하지 않음:</strong> {rows[0].preview!.excluded.join(" · ")}</p></div>}{loading&&<p role="status"><LoaderCircle className="spin"/> 사용 가능한 자격과 권한을 확인하고 있어요.</p>}{rows.map(row=>{const p=row.preview;return <article key={row.policyId} className="batch-recipient"><h3>{p?.audience??policies.find(p=>p.id===row.policyId)?.audience}</h3>{row.error?<p role="alert">{row.error}</p>:p?.ready?<><p className="batch-ready">✓ 사용할 자격이 자동 연결되었습니다.</p><div className="batch-checks">{p.selected?.checks.map(c=><span key={c.label}>{c.pass?'✓':'!'} {c.label} · {c.pass?'충족':'미충족'}</span>)}</div>{!p.selected?.eligible&&<p className="simple-warning">미충족 결과도 이 기관에 전달됩니다. 계속할지 확인하세요.</p>}{!commonSharing&&<><p><strong>공유:</strong> {p.shared.join(' · ')}</p><p><strong>전달하지 않음:</strong> {p.excluded.join(' · ')}</p></>}{p.selected?.authorityId&&<p>담당자: {p.selected.authorityHolder} · {p.selected.authorityTitle}</p>}<p className="simple-note">{p.autoVerify?'제출 후 서명·조건 검증을 자동 처리합니다.':'이 기관은 제출 후 담당자 확인을 기다립니다.'}</p><details><summary>자격 상세 보기</summary><p>{p.selected?.id}</p><p>유효기간 {p.selected?.expiresAt.slice(0,10)}</p></details></>:p?.needsChoice?<label className="simple-field">내용이 다른 자격이 있습니다. 사용할 자격만 선택해 주세요.<select aria-label="사용할 자격" value={choices[row.policyId]??''} disabled={busy} onChange={e=>{setChoices({...choices,[row.policyId]:e.target.value});setConsent(false);}}><option value="">선택하세요</option>{p.candidates.map(c=><option key={c.id} value={c.id}>{data.issuers.find(i=>i.id===c.issuerId)?.name} · {c.eligible?'조건 충족':'미충족'} · 만료 {c.expiresAt.slice(0,10)} · {c.id.slice(-6)}</option>)}</select></label>:<><p>{p?.reason??'추가 확인이 필요합니다.'}</p>{data.publicDemo?<p>공개 체험에서는 저장된 가상 자료만 사용합니다. 자료 수정이나 추가 사례는 상세 기능에서 확인하세요.</p>:<Button variant="outline" onClick={()=>go('apply&policy='+encodeURIComponent(row.policyId)+'&company='+encodeURIComponent(company))}>{p?.reasonCode==='missing_authority'?'담당자 권한 요청':'부족한 자료 확인'}</Button>}</>}</article>;})}
   {ready&&<><p className="simple-note">{new Set(rows.map(r=>r.preview?.selected?.id)).size===1&&rows.length>1?'하나의 기업 자격을 선택한 모든 기관에 재사용합니다. ':''}서버는 원본 속성을 처리하며, 기관은 조건 결과로 일부 범위를 추론할 수 있습니다. 검증 완료는 실제 사업 선정·계약 승인이 아닙니다.</p><label className="simple-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>{rows.map(r=>r.preview?.audience).join(', ')}에 위 정보를 공유하고 제출하는 데 동의합니다.</label><Button disabled={!consent||busy} className="simple-submit" onClick={()=>void submit()}>{busy?<><LoaderCircle className="spin"/>제출·검증 중…</>:<>선택한 {rows.length}곳에 제출<ArrowRight/></>}</Button></>}
   {!loading&&!ready&&<Button variant="outline" disabled={busy} onClick={()=>setAttempt(v=>v+1)}>내용 다시 확인</Button>}
  </section>}
  {error&&<section role="alert" className="simple-card simple-warning"><p>{error}</p><Button variant="outline" disabled={busy} onClick={()=>setAttempt(v=>v+1)}>제출 상태 다시 확인</Button></section>}
  {outcomes.some(x=>!x.ok)&&<section className="simple-card simple-warning" role="alert"><h2>일부 기관은 추가 확인이 필요합니다</h2>{outcomes.filter(x=>!x.ok).map(x=><p key={x.policyId}>{policies.find(p=>p.id===x.policyId)?.audience}: {!x.ok&&x.error}</p>)}<p>완료된 기관에는 다시 제출하지 않습니다.</p><Button disabled={busy} onClick={()=>{setSelected(outcomes.filter(x=>!x.ok).map(x=>x.policyId));setConsent(false);setAttempt(v=>v+1);}}>실패한 기관만 다시 확인</Button></section>}
  {existing.length>0&&<section className="batch-results" aria-label="신청 결과" aria-live="polite"><h2>신청 결과</h2>{[...existing].reverse().map(r=>{const p=data.presentations.find(p=>p.requestId===r.id),status=applicationStatus(r,p),copy=applicationStatusCopy(status);return <article className="simple-card" key={r.id}><span className="simple-pill">{copy.title}</span><h3>{r.policy.audience}</h3><p>{copy.message}</p>{p?.checks.map(c=><p key={c.label}>{c.pass?'✓':'!'} {c.label} · {c.pass?'충족':'미충족'}</p>)}<details><summary>접수·자격 상세</summary><p>접수 번호: {r.id}</p><p>사용 자격: {p?.credentialId}</p></details></article>})}<Button variant="outline" onClick={()=>go('progress')}>전체 진행 현황</Button></section>}
  {!pendingIds.length&&!existing.length&&<p className="simple-note">신청할 대상을 선택하면 다음 내용이 자동으로 표시됩니다.</p>}
  {data.publicDemo&&<p className="simple-note">합성 데이터 기반 공개 시연입니다. 추가 사례와 기술 검증은 메뉴의 ‘상세 기능 더 보기’에서 선택할 수 있습니다.</p>}
  <VerificationLink/>
 <Sheet open={blockchainOpen} onOpenChange={setBlockchainOpen}><SheetContent className="process-sheet" showCloseButton={false}><SheetClose className="process-close" aria-label="블록체인 창 닫기"><X size={19}/></SheetClose><SheetHeader><SheetTitle>블록체인 기술 시각화</SheetTitle><SheetDescription>기업 자격이 증명과 거래로 이어지는 실제 Midnight 기록을 살펴보세요.</SheetDescription></SheetHeader><div className="process-sheet-scroll"><p className="chain-modal-intro">현재 신청은 Ed25519 서버 검증으로 처리됩니다. 아래는 별도로 실행한 Local Devnet 기록이며, 현재 신청의 온체인 결과가 아닙니다.</p>{blockchainOpen&&<BlockchainEvidenceViewer enabled={blockchainOpen}/>}</div></SheetContent></Sheet>
 <Sheet open={processOpen} onOpenChange={setProcessOpen}><SheetContent className="process-sheet" showCloseButton={false}><SheetClose className="process-close" aria-label="관제 창 닫기"><X size={19}/></SheetClose><SheetHeader><SheetTitle>처리 과정 관제</SheetTitle><SheetDescription>서버의 실제 처리 기록입니다. 창을 닫아도 제출은 계속됩니다.</SheetDescription></SheetHeader><div className="process-sheet-scroll"><ProcessConsole key={processRun?.id??'history'} live={processRun} companyId={company} busy={busy} enabled={processOpen}/></div></SheetContent></Sheet>
 </div>;
}
