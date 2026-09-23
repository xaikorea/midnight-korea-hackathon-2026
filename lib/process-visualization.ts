import {processStages,type ProcessEvent,type ProcessEventState,type ProcessRun,type ProcessStage} from './process-types';

export const processPhases=[
 {label:'자격 확인',stages:['access','credential','consent']},
 {label:'기관별 판정',stages:['request','policy']},
 {label:'서명·검증',stages:['signature','verification']},
 {label:'결과 저장',stages:['audit','commit']},
] as const;
export type VisualState=ProcessEventState|'pending'|'incomplete'|'unmet'|'reused';
export const visualStateNames:Record<VisualState,string>={pending:'실행 기록 없음',running:'처리 중',success:'실행 확인',failed:'차단·실패',waiting:'담당자 대기',skipped:'실행 생략',incomplete:'기관별 상태 다름',unmet:'조건 미충족',reused:'기존 접수 재사용'};
export function visibleProcessEvents(run:ProcessRun,scope:string){
 return run.events.filter(e=>scope==='all'||!e.policyId||e.policyId===scope).toSorted((a,b)=>a.seq-b.seq);
}
function eventState(event?:ProcessEvent):VisualState{
 if(!event)return 'pending';
 if(event.state==='success'&&event.data.eligible===false)return 'unmet';
 if(event.state==='success'&&event.data.replayed)return 'reused';
 return event.state;
}
export function processProjection(run:ProcessRun,scope='all',throughSeq=Infinity){
 const events=visibleProcessEvents(run,scope).filter(e=>e.seq<=throughSeq);
 const policies=run.policies.filter(p=>scope==='all'||p.id===scope);
 const stages=(Object.keys(processStages) as ProcessStage[]).map(stage=>{
  const actors=stage==='commit'?[{id:'batch',audience:'전체 결과 저장'}]:policies;
  const rows=actors.map(actor=>{
   const event=events.findLast(e=>e.stage===stage&&(e.policyId??'batch')===actor.id);
   return {id:actor.id,audience:actor.audience,event,state:eventState(event)};
  });
  const states=rows.map(r=>r.state);
  const priority:VisualState[]=['failed','running','unmet','waiting'];
  const marked=priority.find(s=>states.includes(s));
  const seen=rows.filter(r=>r.event).length;
  const state:VisualState=marked??(!seen?'pending':seen<rows.length?'incomplete':states.every(s=>s==='skipped')?'skipped':states.every(s=>s==='reused')?'reused':states.some(s=>s==='skipped'||s==='reused')?'incomplete':'success');
  return {stage,label:processStages[stage],state,rows,seen,total:rows.length};
 });
 return {events,stages,focus:events.at(-1)};
}
// Playback advances only to existing event sequence numbers. Its reading pace
// never changes server timing, persistence or the actual application result.
export function processFrameDelay(current:ProcessEvent,next:ProcessEvent,speed:number){
 return Math.min(1400,Math.max(700,next.elapsedMs-current.elapsedMs))/(speed===2?2:1);
}
