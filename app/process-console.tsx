'use client';
import {useCallback,useEffect,useState} from 'react';
import {Activity,ArrowUpRight,Check,Clock3,Database,Download,RefreshCw,ShieldCheck,X} from 'lucide-react';
import {processStages,type ProcessRun,type ProcessData} from '@/lib/process-types';
import './process-console.css';

const labels:Record<keyof ProcessData,string>={credentialId:'사용 자격',issuerId:'발급기관',schemaId:'자격 스키마',keyId:'서명 키 식별값',authorityId:'담당자 권한',requestId:'접수 번호',presentationId:'제출 결과 번호',policyHash:'정책 SHA-256',credentialDigest:'자격 SHA-256',nonce:'기관별 nonce',previewHash:'동의 내용 SHA-256',algorithm:'서명 방식',engine:'조건 판정 엔진',eligible:'조건 충족',replayed:'기존 접수 반환',operational:'기관 로그인(Keycloak) 모드',candidateCount:'사용 가능한 자격 수',savedVersion:'저장 버전',checks:'세부 검사'};
const statusNames={running:'서버 처리 중',succeeded:'처리·저장 완료',partial:'일부 처리 완료',failed:'추가 확인 필요'};
function time(value:string){return new Date(value).toLocaleTimeString('ko-KR',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit',fractionalSecondDigits:3});}

export default function ProcessConsole({live,companyId,busy=false,enabled=true}:{live?:ProcessRun;companyId?:string;busy?:boolean;enabled?:boolean}){
  const [runs,setRuns]=useState<ProcessRun[]>([]),[picked,setPicked]=useState(''),[scope,setScope]=useState('all');
  const [error,setError]=useState(''),[fetching,setFetching]=useState(false),[updated,setUpdated]=useState('');
  const [now,setNow]=useState(()=>Date.now());
  const load=useCallback(async()=>{
    setFetching(true);
    try{const r=await fetch('/api/process-runs',{cache:'no-store'});const value=await r.json() as {error?:string;runs:ProcessRun[]};if(!r.ok)throw Error(value.error??'기록 조회 실패');setRuns(value.runs);setError('');setUpdated(new Date().toISOString());setNow(Date.now());}
    catch(e){setError(e instanceof Error?e.message:'연결 상태를 확인하세요.');}finally{setFetching(false);setNow(Date.now());}
  },[]);
  useEffect(()=>{
    if(!enabled)return;
    let disposed=false;
    let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{if(!disposed&&!document.hidden)await load();if(!disposed)timer=setTimeout(poll,3000);};
    void poll();return()=>{disposed=true;clearTimeout(timer);};
  },[enabled,load]);
  const recorded=runs.find(r=>r.id===live?.id);
  const currentLive=recorded&&live&&(recorded.updatedAt>live.updatedAt||recorded.updatedAt===live.updatedAt&&recorded.status!=='running')?recorded:live;
  const merged=[...(currentLive?[currentLive]:[]),...runs.filter(r=>r.id!==live?.id)].filter(r=>!companyId||r.companyId===companyId);
  const run=merged.find(r=>r.id===picked)??merged[0];
  const events=run?.events.filter(e=>scope==='all'||e.policyId===scope||!e.policyId)??[];
  const last=run?.events.at(-1),stale=run?.status==='running'&&now-Date.parse(run.updatedAt)>30000;
  const stored=run?.events.find(e=>e.stage==='commit'&&e.state==='success');
  function download(){if(!run)return;const url=URL.createObjectURL(new Blob([JSON.stringify(run,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=run.id+'.json';a.click();URL.revokeObjectURL(url);}
  return <div className="process-console">
    <div className="process-tools"><span><Activity size={15}/> 서버 실행 기록</span><div><button type="button" onClick={()=>void load()} disabled={fetching}><RefreshCw size={14}/>{fetching?'조회 중':'새로고침'}</button><a href="/process" target="_blank" rel="noopener noreferrer">별도 관제 창 <ArrowUpRight size={14}/></a></div></div>
    {error&&<p className="process-warning" role="alert">{error} {runs.length>0&&'마지막으로 불러온 기록을 표시합니다.'}<a href="/welcome">체험 공간 접속</a></p>}
    <div className="process-environment"><span><ShieldCheck size={14}/> Ed25519 서버 서명</span><span>정책: {run?.engine.policy==='opa'?'OPA':run?.engine.policy==='local'?'내부 조건 엔진':'처리 시 확인'}</span><span>Midnight 네트워크 미연결</span></div>
    <p className="process-explanation">서버가 실제 실행한 단계와 시간을 보여줍니다. 데이터베이스 저장까지 확인되어야 접수가 확정됩니다. 현재 공간의 최근 20건을 조회합니다.</p>
    {merged.length>0&&<label className="process-picker">처리 기록<select value={run?.id??''} onChange={e=>{setPicked(e.target.value);setScope('all');}}>{merged.map(r=><option key={r.id} value={r.id}>{time(r.startedAt)} · {r.companyName} · {statusNames[r.status]}</option>)}</select></label>}
    {!run?<section className="process-empty"><Activity size={34}/><h3>{busy?'서버 응답을 연결하고 있습니다.':'아직 실행 기록이 없습니다.'}</h3><p>신청 대상과 공유 동의를 확인한 뒤 제출하면 이 창에 실제 처리 기록이 쌓입니다.</p><div className="process-outline">자격 확인 → 조건 판정 → 서명·검증 → 저장</div><small>처리 시간을 늘리는 연출이나 가상의 완료 기록은 사용하지 않습니다.</small></section>:<>
      <section className={'process-summary '+run.status} aria-live="polite"><div><span className="process-live-dot"/><strong>{stale?'최근 갱신 없음 · 상태 재확인 필요':statusNames[run.status]}</strong><p>{run.status==='running'?(stale?'연결 중단이나 서버 종료 여부를 이 기록만으로 확정할 수 없습니다.':last?.message??'요청을 받았습니다.'):run.committed?'완료된 기관의 접수 결과가 저장되었습니다.':'이번 처리에서 업무 데이터 저장이 확인되지 않았습니다.'}</p></div><b>{run.completedAt?(last?.elapsedMs??0).toLocaleString()+' ms':'진행 중'}</b></section>
      {!run.historySaved&&<p className="process-warning">업무 결과와 별개로 관제 기록 저장을 완료하지 못했습니다. 이 화면의 기록을 내려받고 접수 결과를 다시 확인하세요.</p>}
      <div className="process-metrics"><div><small>선택 기관</small><strong>{run.policies.length}<span>곳</span></strong></div><div><small>실행 이벤트</small><strong>{run.events.length}<span>건</span></strong></div><div><small>접수 데이터</small><strong className="process-save-label">{stored?'저장 확인':run.status==='running'?'미확정':'저장 없음'}</strong></div></div>
      <nav className="process-scopes" aria-label="처리 기관 필터"><button onClick={()=>setScope('all')} aria-pressed={scope==='all'}>전체</button>{run.policies.map(p=><button key={p.id} onClick={()=>setScope(p.id)} aria-pressed={scope===p.id}>{p.audience}</button>)}</nav>
      <div className="process-stage-map" aria-label="서버 처리 단계">{Object.entries(processStages).map(([key,label])=>{const latest=new Map<string,typeof events[number]>();for(const event of events.filter(e=>e.stage===key))latest.set(event.policyId??'batch',event);const priority={failed:0,running:1,waiting:2,success:3,skipped:4};const e=[...latest.values()].sort((a,b)=>priority[a.state]-priority[b.state])[0];return <div key={key} data-state={e?.state??'pending'}><span>{e?.state==='success'?<Check size={13}/>:e?.state==='failed'?<X size={13}/>:<Clock3 size={13}/>}</span>{label}</div>;})}</div>
      <div className="process-log-title"><h3>단계별 실행 내역</h3><button onClick={download}><Download size={14}/> 기록 JSON</button></div>
      <ol className="process-events">{events.map(e=><li key={e.seq} data-state={e.state}><div className="process-event-time"><time dateTime={e.at}>{time(e.at)}</time><small>+{e.elapsedMs} ms</small></div><div className="process-event-body"><div><b>{processStages[e.stage]}</b><span className="process-event-state">{{running:'실행 시작',success:'실행 확인',failed:'차단·실패',skipped:'실행 생략',waiting:'대기'}[e.state]}</span>{e.durationMs!==undefined&&<small>{e.durationMs} ms</small>}</div><small className="process-audience">{e.policyId?run.policies.find(p=>p.id===e.policyId)?.audience:'전체 결과 저장'}</small><p>{e.message}</p>{Object.keys(e.data).length>0&&<details><summary>검사 결과·연결값 보기</summary><dl>{Object.entries(e.data).filter(([k])=>k!=='checks').map(([k,v])=><div key={k}><dt>{labels[k as keyof ProcessData]??k}</dt><dd>{typeof v==='boolean'?(v?'예':'아니요'):String(v)}</dd></div>)}</dl>{e.data.checks&&<ul>{e.data.checks.map((c,i)=><li key={i}>{c.pass?'✓':'!'} {c.label} · {c.pass?'통과':'미충족'}</li>)}</ul>}</details>}</div></li>)}</ol>
      <footer className="process-footer"><Database size={14}/><span>추적 번호 {run.id}<br/>마지막 서버 기록 {time(run.updatedAt)}{updated&&' · 조회 '+time(updated)}</span></footer>
    </>}
    <p className="process-privacy">비밀키·토큰·정확한 매출 원본·증빙 파일은 관제 기록에 포함하지 않습니다. 서명 검증과 실제 사업 선정·계약 승인은 별개입니다.</p>
  </div>;
}
