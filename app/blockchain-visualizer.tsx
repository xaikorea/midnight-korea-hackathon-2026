'use client';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {ArrowRight,Blocks,Check,FileKey2,LockKeyhole,Pause,Play,RefreshCw,Send,ShieldCheck,StepBack,StepForward,Wallet,X} from 'lucide-react';
import {midnightEvidenceSchema,type MidnightEvidence} from '@/lib/midnight-evidence';
import {blockchainChapters,blockchainNodes,blockchainOperations,blockchainProjection,blockchainStages,blockchainStateNames,type BlockchainNode} from '@/lib/blockchain-visualization';
import './blockchain-visualizer.css';
import BlockchainStageScene from './blockchain-stage-scene';

const icons={source:FileKey2,proof:ShieldCheck,balance:Wallet,submission:Send,finality:Blocks};
const subscribeMotion=(notify:()=>void)=>{const media=matchMedia('(prefers-reduced-motion: reduce)');media.addEventListener('change',notify);return()=>media.removeEventListener('change',notify);};
const subscribeVisibility=(notify:()=>void)=>{document.addEventListener('visibilitychange',notify);return()=>document.removeEventListener('visibilitychange',notify);};
const getReduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches,getVisible=()=>!document.hidden;
const serverReduced=()=>true,serverVisible=()=>false;
const short=(s:string)=>s.slice(0,10)+'…'+s.slice(-6);

export default function BlockchainVisualizer({report,enabled=true}:{report:MidnightEvidence;enabled?:boolean}){
  const [cursor,setCursor]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[selected,setSelected]=useState<BlockchainNode>();
  const [previewing,setPreviewing]=useState(false);
  const reduced=useSyncExternalStore(subscribeMotion,getReduced,serverReduced),visible=useSyncExternalStore(subscribeVisibility,getVisible,serverVisible);
  const frame=blockchainProjection(report,cursor),chapters=blockchainChapters(report),last=report.events.length-1;
  const moving=playing&&!reduced&&visible&&enabled&&cursor<last;
  const sceneMoving=(moving||previewing)&&!reduced&&visible&&enabled;
  const node=blockchainNodes.find(n=>n.id===(selected??frame.focus))!;
  useEffect(()=>{if(!moving)return;const timer=setTimeout(()=>{setSelected(undefined);setCursor(n=>Math.min(last,n+1));},1600/speed);return()=>clearTimeout(timer);},[moving,cursor,last,speed]);
  function seek(index:number){setPlaying(false);setPreviewing(false);setSelected(undefined);setCursor(index);}
  function play(){setSelected(undefined);setPreviewing(false);if(cursor>=last)setCursor(0);setPlaying(p=>cursor>=last?true:!p);}
  function toggleScene(){setPlaying(false);setSelected(node.id);setPreviewing(!sceneMoving);}
  const event=frame.event;
  const status=event?({running:'실행 시작',complete:'완료',pending:'확인 중',sent:'전송됨',finalized:'확정 기록',unconfirmed:'성공 미확정',blocked:'차단 확인',verified:'검사 통과',failed:'실패'} as Record<string,string>)[event.status]??event.status:'기록 없음';
  return <section className="chain-visualizer" aria-label="블록체인 기술 시각화" data-motion={moving?'on':'off'} data-cursor={cursor}>
    <header className="chain-heading"><div><span className="chain-eyebrow">MIDNIGHT / INSIDE THE PROOF</span><h2>자격이 증명으로, 증명이 블록으로.</h2></div><span className="chain-mode"><span/>Local Devnet · 저장된 기록</span></header>
    <p className="chain-disclaimer">별도 합성 시연에서 실제 실행한 기록입니다. <strong>현재 신청의 실시간 거래가 아닙니다.</strong> 재생은 새 거래를 만들지 않으며 실제 처리 속도를 나타내지 않습니다.</p>
    <nav className="chain-chapters" aria-label="블록체인 시연 구간">{chapters.map((c,i)=><button type="button" key={c.label} aria-current={cursor>=c.index&&cursor<(chapters[i+1]?.index??Infinity)?'step':undefined} onClick={()=>seek(c.index)}>{String(i+1).padStart(2,'0')} {c.label}</button>)}</nav>
    <div className="chain-operation"><span>{blockchainOperations[event?.operation]??event?.operation}</span><b>{blockchainStages[event?.stage]??event?.stage} · {status}</b><time dateTime={event?.at}>{event?new Date(event.at).toLocaleTimeString('ko-KR',{hour12:false}):'—'}</time></div>
    <ol className="chain-nodes" aria-label="블록체인 처리 단계">{blockchainNodes.map((n,i)=>{const Icon=icons[n.id],state=frame.states[n.id];return <li key={n.id} data-node={n.id} data-state={state} data-focus={frame.focus===n.id}>
      <button type="button" aria-pressed={node.id===n.id} onClick={()=>{setSelected(n.id);setPlaying(false);setPreviewing(true);}}><span className="chain-node-icon">{state==='blocked'?<X size={24}/>:<Icon size={24}/>}</span><small>0{i+1} / {n.technology}</small><strong>{n.title}</strong><span className="chain-node-state">{state==='complete'&&<Check size={12}/>} {blockchainStateNames[state]}</span></button>
      {i<blockchainNodes.length-1&&<span className="chain-connector" aria-hidden="true" data-active={frame.focus===blockchainNodes[i+1].id}><i/><ArrowRight size={12}/></span>}
    </li>;})}</ol>
    <BlockchainStageScene stage={node.id} state={frame.states[node.id]} moving={sceneMoving} previewing={Boolean(selected)} reduced={reduced} speed={speed} blockHeight={frame.receipt?.blockHeight} onToggle={toggleScene}/>
    <div className="chain-explanation"><ShieldCheck size={20}/><div><b>{node.title}에서는 무엇을 하나요?</b><p>{frame.blocked&&node.id==='proof'?'취소 거래 확정 후 제출 전 회로 검사에서 거절되었습니다. 새 증명·성공 거래는 만들어지지 않았습니다.':node.description}</p></div></div>
    <div className="chain-controls"><button type="button" disabled={reduced||last<0} onClick={play}>{moving?<Pause size={14}/>:<Play size={14}/>} {moving?'재생 일시정지':'기록 재생'}</button><button type="button" aria-label="이전 블록체인 기록" disabled={cursor===0} onClick={()=>seek(cursor-1)}><StepBack size={16}/></button><button type="button" aria-label="다음 블록체인 기록" disabled={cursor>=last} onClick={()=>seek(cursor+1)}><StepForward size={16}/></button><label>재생 속도<select aria-label="블록체인 재생 속도" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={1}>1배</option><option value={2}>2배</option><option value={4}>4배</option></select></label><button type="button" onClick={()=>seek(Math.max(0,last))}>최종 기록 보기</button></div>
    <label className="chain-slider">실행 기록 {cursor+1} / {report.events.length}<input aria-label="실행 기록 위치" type="range" min={0} max={Math.max(0,last)} value={cursor} onChange={e=>seek(Number(e.target.value))}/></label>
    <p className="chain-playback-note">{reduced?'동작 줄이기 적용 · 구간 또는 이전·다음 버튼으로 확인하세요.':!visible||!enabled?'화면이 숨겨져 재생을 멈췄습니다.':cursor>=last?'저장된 기록의 마지막 단계입니다.':moving?'기록을 읽기 쉬운 속도로 재생 중입니다.':'일시정지 · 단계를 누르면 기술 설명을 볼 수 있습니다.'}</p>
    <div className="chain-outcomes" aria-label="기록 시점의 기관별 결과">{report.outcomes.map(o=>{const confirmed=frame.confirmed.has(o.receipt.txId);return <article key={o.scenario} data-scenario={o.scenario} data-confirmed={confirmed}><small>{o.scenario==='buyer'?'구매사':o.scenario==='grant'?'지원사업':'비교 조건'}</small><strong>{confirmed?(o.inspection.found&&o.inspection.request?.eligible?'검증 당시 충족':'조건 미충족'):'이 재생 위치에서 미확정'}</strong><span>{confirmed?'블록 '+o.receipt.blockHeight+' · '+(frame.revoked?'이후 자격 취소':'확정 기록'):'동일 자격 · 기관별 별도 요청'}</span></article>;})}</div>
    <div className="chain-receipt" aria-live="polite"><Blocks size={18}/><div><b>{frame.blocked?'재사용 차단 · 새 성공 거래 없음':frame.receipt?'이 거래의 확정 블록 #'+frame.receipt.blockHeight:frame.txId?'전송 기록 · 아직 확정 표시 없음':'이 단계의 거래 확정 기록 없음'}</b><span>재생 위치까지 대조된 확정 영수증 {frame.confirmed.size} / {report.receipts.length}건{frame.receipt?' · '+frame.receipt.status:''}</span>{frame.txId&&<code title={frame.txId}>TX {short(frame.txId)}</code>}</div></div>
    <details className="chain-details"><summary>거래 근거와 공개 범위 확인</summary><dl><dt>계약 주소</dt><dd>{report.contractAddress}</dd>{frame.txId&&<><dt>이 거래 ID</dt><dd>{frame.txId}</dd></>}{frame.receipt&&<><dt>확정 블록 해시</dt><dd>{frame.receipt.blockHash}</dd></>}<dt>원본 자격 연결값</dt><dd>{report.source.digest}</dd><dt>기록 실행 완료</dt><dd>{new Date(report.completedAt).toLocaleString('ko-KR')}</dd></dl><div className="chain-privacy"><div><LockKeyhole size={18}/><b>체인에 원본 비공개</b><p>정확한 매출 · 설립일 · 기업 속성<br/>웹 서버와 로컬 증명 환경은 원본을 처리합니다.</p></div><div><Blocks size={18}/><b>체인에서 확인 가능</b><p>정책 · 요청 · 보유자 식별값 · 취소 · 판정<br/>공개 식별값은 연결될 수 있습니다.</p></div></div><p>발급기관이 원본 자료를 확인해야 합니다. 웹 자격과 체인 자격의 취소는 별도로 관리합니다. 로컬 체인이 현재 가동 중임을 뜻하지 않습니다.</p><a href="/evidence/midnight-web-devnet.json" download>원본 실행 기록 JSON 내려받기</a></details>
  </section>;
}

export function BlockchainEvidenceViewer({enabled=true}:{enabled?:boolean}){
  const [report,setReport]=useState<MidnightEvidence>(),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{const abort=new AbortController();fetch('/evidence/midnight-web-devnet.json',{signal:abort.signal,cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Unavailable');return midnightEvidenceSchema.parse(await r.json());}).then(r=>{if(!abort.signal.aborted)setReport(r);}).catch(()=>{if(!abort.signal.aborted)setError(true);});return()=>abort.abort();},[attempt]);
  if(error)return <div className="chain-load" role="alert">검증 기록을 불러올 수 없습니다. 완료로 추정하지 않습니다.<button onClick={()=>{setError(false);setAttempt(n=>n+1);}}>다시 불러오기</button></div>;
  return report?<BlockchainVisualizer report={report} enabled={enabled}/>:<div className="chain-load" role="status"><RefreshCw size={18}/> 실제 Midnight 실행 기록을 불러오는 중…</div>;
}
