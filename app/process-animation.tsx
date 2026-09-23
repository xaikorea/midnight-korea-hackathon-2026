'use client';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {BadgeCheck,Check,ChevronRight,ClipboardList,Database,FileCheck2,KeyRound,LockKeyhole,Pause,Play,RotateCcw,ScanLine,Send,ShieldCheck,SkipForward,StepBack,StepForward,X} from 'lucide-react';
import {processStages,type ProcessRun,type ProcessStage} from '@/lib/process-types';
import {processFrameDelay,processPhases,processProjection,visibleProcessEvents,visualStateNames} from '@/lib/process-visualization';
import './process-animation.css';

const icons={access:LockKeyhole,credential:BadgeCheck,consent:FileCheck2,request:Send,policy:ScanLine,signature:KeyRound,verification:ShieldCheck,audit:ClipboardList,commit:Database};
const subscribeMotion=(notify:()=>void)=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');media.addEventListener('change',notify);return()=>media.removeEventListener('change',notify);};
const getReduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const subscribeVisibility=(notify:()=>void)=>{document.addEventListener('visibilitychange',notify);return()=>document.removeEventListener('visibilitychange',notify);};
const getVisible=()=>!document.hidden;
const serverReduced=()=>true,serverVisible=()=>false;

export default function ProcessAnimation({run,scope,enabled,stale,autoReplay}:{run:ProcessRun;scope:string;enabled:boolean;stale:boolean;autoReplay:boolean}){
 const reduced=useSyncExternalStore(subscribeMotion,getReduced,serverReduced),visible=useSyncExternalStore(subscribeVisibility,getVisible,serverVisible);
 const [playback,setPlayback]=useState({mode:'result' as 'result'|'replay',index:0,playing:false});
 const [speed,setSpeed]=useState(1),[motionOff,setMotionOff]=useState(false);
 const autoPlayed=useRef(false),frames=visibleProcessEvents(run,scope);
 const terminal=run.status!=='running',replaying=playback.mode==='replay'&&terminal;
 const index=Math.min(playback.index,Math.max(0,frames.length-1));
 const interactive=enabled&&visible;
 const moving=interactive&&!reduced&&!motionOff&&!stale;
 const replayTick=replaying&&playback.playing&&moving&&index<frames.length-1;
 const projection=processProjection(run,scope,replaying?frames[index]?.seq??0:Infinity);
 const focus=projection.focus,activePhase=focus?processPhases.findIndex(p=>(p.stages as readonly ProcessStage[]).includes(focus.stage)):-1;
 const animated=moving&&(terminal?replayTick:!!focus);
 const focusRows=projection.stages.find(s=>s.stage===focus?.stage)?.rows??[];
 const finalResult=run.committed?(run.status==='partial'?'일부 기관 저장 확인':'접수 저장 확인'):'접수 저장 미확정';

 useEffect(()=>{
  if(!autoReplay||!terminal||!frames.length||autoPlayed.current||!interactive)return;
  if(reduced||motionOff){autoPlayed.current=true;return;}
  let active=true;
  queueMicrotask(()=>{if(active){autoPlayed.current=true;setPlayback({mode:'replay',index:0,playing:true});}});
  return()=>{active=false;};
 },[autoReplay,terminal,frames.length,interactive,reduced,motionOff]);
 useEffect(()=>{
  if(!replayTick)return;
  const timer=setTimeout(()=>setPlayback(p=>({...p,index:p.index+1})),processFrameDelay(frames[index],frames[index+1],speed));
  return()=>clearTimeout(timer);
 },[replayTick,index,frames,speed]);
 function replay(){autoPlayed.current=true;setPlayback({mode:'replay',index:0,playing:!reduced&&!motionOff});}
 function step(next:number){autoPlayed.current=true;setPlayback({mode:'replay',index:Math.max(0,Math.min(frames.length-1,next)),playing:false});}
 function result(){autoPlayed.current=true;setPlayback({mode:'result',index:0,playing:false});}
 return <section className="process-animation" aria-label="처리 과정 애니메이션" data-mode={replaying?'replay':terminal?'result':'live'} data-motion={animated?'on':'off'} data-cursor={replaying?frames[index]?.seq:frames.at(-1)?.seq}>
  <header className="process-animation-head"><div><span className="process-animation-eyebrow">SERVICE IN MOTION</span><h3>한 번의 자격, 기관별로 안전하게</h3></div><span className={'process-mode-badge '+(replaying?'replay':terminal?'result':'live')}>{replaying?'실제 기록 재생':terminal?'실행 결과':'실시간 처리'}</span></header>
  <p className="process-animation-caption">{replaying?`서버 결과: ${finalResult}. 아래 애니메이션은 이미 실행한 기록을 읽기 쉬운 속도로 재생합니다.`:terminal?'실제 실행 기록을 단계별로 다시 볼 수 있습니다. 기관의 담당자 확인과 최종 선정은 별도입니다.':stale?'최근 서버 갱신이 없어 동작 표시를 멈췄습니다. 새로고침으로 상태를 확인하세요.':'서버에서 도착한 실행 기록에 맞춰 현재 단계를 표시합니다.'}</p>
  <ol className="process-flow-rail" aria-label="서비스 처리 순서">{processPhases.map((phase,i)=><li key={phase.label} data-active={i===activePhase}>
   <span className="process-phase-orbit"><span>{i+1}</span></span><b>{phase.label}</b>
   {i<processPhases.length-1&&<span className="process-flow-connector" aria-hidden="true" data-active={i+1===activePhase}><i/><ChevronRight size={13}/></span>}
  </li>)}</ol>
  <div className="process-focus" key={(replaying?'replay-':'live-')+(focus?.seq??0)} data-state={focus?.state??'pending'}>
   <div className="process-focus-symbol" aria-hidden="true">{focus?(()=>{const Icon=icons[focus.stage];return <Icon size={26}/>;})():<Send size={26}/>}</div>
   <div className="process-focus-text"><div><strong>{focus?processStages[focus.stage]:'첫 실행 기록을 기다립니다'}</strong><span>{focus?'실제 기록 +'+focus.elapsedMs.toLocaleString()+' ms':'요청 연결 중'}</span></div>
    <p>{focus?.message??'아직 실행하지 않은 단계를 완료로 표시하지 않습니다.'}</p>
    {focus&&<small>{focus.policyId?run.policies.find(p=>p.id===focus.policyId)?.audience:'전체 결과 저장'} · {visualStateNames[projection.stages.find(s=>s.stage===focus.stage)?.rows.find(r=>r.id===(focus.policyId??'batch'))?.state??'pending']}</small>}
   </div>
  </div>
  {replaying&&<div className="process-replay-position"><label>재생 위치 <b>{index+1} / {frames.length}개 기록</b><input aria-label="기록 재생 위치" type="range" min={0} max={Math.max(0,frames.length-1)} value={index} onChange={e=>step(Number(e.target.value))}/></label><small>{index===frames.length-1?'기록 재생 완료':!visible?'탭이 숨겨져 재생을 멈췄습니다.':reduced?'동작 줄이기 설정: 이전·다음 버튼으로 확인하세요.':motionOff?'동작 효과가 꺼져 있습니다.':playback.playing?'기록을 순서대로 재생 중':'기록 재생 일시정지'}</small></div>}
  <div className="process-animation-controls">
   {terminal&&frames.length>0&&<><button type="button" onClick={replay}><RotateCcw size={14}/>{replaying?'처음부터 다시':'과정 다시보기'}</button>{replaying&&<>
    <button type="button" aria-label="이전 실행 기록" disabled={index===0} onClick={()=>step(index-1)}><StepBack size={15}/></button>
    <button type="button" disabled={reduced||motionOff||index===frames.length-1} onClick={()=>setPlayback(p=>({...p,playing:!p.playing}))}>{playback.playing&&!reduced&&!motionOff?<Pause size={14}/>:<Play size={14}/>} {index===frames.length-1?'재생 완료':playback.playing&&!reduced&&!motionOff?'재생 일시정지':'재생 계속'}</button>
    <button type="button" aria-label="다음 실행 기록" disabled={index>=frames.length-1} onClick={()=>step(index+1)}><StepForward size={15}/></button>
    <label>재생 속도<select aria-label="기록 재생 속도" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={1}>1배</option><option value={2}>2배</option></select></label>
    <button type="button" onClick={result}><SkipForward size={14}/>실제 결과 보기</button>
   </>}</>}
   <button type="button" aria-pressed={motionOff} onClick={()=>{autoPlayed.current=true;setMotionOff(v=>!v);}} disabled={reduced}>{reduced?'동작 줄이기 적용':motionOff?'동작 효과 켜기':'동작 효과 끄기'}</button>
  </div>
  <ol className="process-animation-stages" aria-label="서버 처리 단계">{projection.stages.map((stage,i)=>{const Icon=icons[stage.stage];return <li key={stage.stage} data-stage={stage.stage} data-state={stage.state} data-focus={focus?.stage===stage.stage}>
   <div className="process-stage-symbol" aria-hidden="true">{stage.state==='failed'?<X size={18}/>:stage.state==='success'?<Check size={18}/>:<Icon size={18}/>}</div>
   <div><small>STEP {String(i+1).padStart(2,'0')}</small><b>{stage.label}</b><span>{visualStateNames[stage.state]}</span>{scope==='all'&&stage.stage!=='commit'&&<em>{stage.seen}/{stage.total} 기관 기록</em>}</div>
  </li>;})}</ol>
  {focusRows.length>1&&<div className="process-animation-recipients"><b>{focus&&processStages[focus.stage]} · 기관별 상태</b>{focusRows.map(row=><span key={row.id} data-state={row.state}>{row.audience}<small>{visualStateNames[row.state]}</small></span>)}</div>}
  <p className="process-animation-note">실제 처리 순서와 결과는 아래 실행 내역에서 확인할 수 있습니다. 기록 재생은 신청을 다시 제출하지 않습니다.</p>
 </section>;
}
