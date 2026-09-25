import {ArrowRight,Building2,Check,FileCheck2,Files,FolderOpen,Landmark,Layers3,ScanLine,ShieldCheck} from 'lucide-react';
import type {Check as ProgramCheck,Outcome} from '@/lib/program-types';

export const outcomeLabels:Record<Outcome,string>={pass:'확인 완료',fail:'조건 미충족',unknown:'자료 필요',manual_review:'담당자 확인',not_applicable:'선택 사항'};
const outcomes:Outcome[]=['pass','fail','unknown','manual_review','not_applicable'];
const colors:Record<Outcome,string>={pass:'#218573',fail:'#c85a40',unknown:'#b58121',manual_review:'#517bc0',not_applicable:'#98a8ba'};
export function summarizeChecks(checks:ProgramCheck[]){return outcomes.map(outcome=>({outcome,label:outcomeLabels[outcome],count:checks.filter(c=>c.outcome===outcome).length,color:colors[outcome]}));}

export function CheckDistribution({checks,compact=false}:{checks:ProgramCheck[];compact?:boolean}){
 const groups=summarizeChecks(checks),total=checks.length;
 if(compact)return <div className="program-mini-distribution" aria-label="저장 당시 검사 요약"><div className="program-segments" aria-hidden="true">{groups.filter(g=>g.count).map(g=><span key={g.outcome} style={{flex:g.count,background:g.color}}/>)}</div><p>{groups.filter(g=>g.count).map(g=><span key={g.outcome}>{g.label} <b>{g.count}</b></span>)}</p></div>;
 return <figure className="program-distribution" aria-label="사전 확인 항목 분포">
  <div className="program-donut" aria-hidden="true"><svg viewBox="0 0 128 128"><circle cx="64" cy="64" r="49" fill="none" stroke="#eaf0f5" strokeWidth="12"/>{groups.map((g,index)=>{const start=groups.slice(0,index).reduce((sum,item)=>sum+item.count,0)/(total||1)*100,length=g.count/(total||1)*100;return <circle key={g.outcome} cx="64" cy="64" r="49" fill="none" stroke={g.color} strokeWidth="12" pathLength="100" strokeDasharray={`${length} ${100-length}`} strokeDashoffset={-start} transform="rotate(-90 64 64)"/>;})}</svg><div><strong>{total}</strong><span>검사 항목</span></div></div>
  <figcaption><strong>어떤 확인이 남아 있나요?</strong><p>항목 수 분포이며, 선정 점수가 아닙니다.</p><dl className="program-distribution-legend">{groups.map(g=><div key={g.outcome} data-outcome={g.outcome}><dt><i style={{background:g.color}} aria-hidden="true"/>{g.label}</dt><dd>{g.count}<span>개</span></dd></div>)}</dl><small>상위 검사 항목 기준 · 세부 조건은 아래에서 확인하세요.</small></figcaption>
 </figure>;
}

export function ProgramOverview({grants,buyers,credentialCount,checks,recordCount,scope}:{grants:number;buyers:number;credentialCount?:number;checks?:ProgramCheck[];recordCount:number;scope:string}){
 const attention=checks?.filter(c=>c.outcome==='unknown'||c.outcome==='fail').length;
 const review=checks?.filter(c=>c.outcome==='manual_review').length;
 return <>
  <header className="program-intro">
   <div className="program-intro-copy"><span className="program-eyebrow"><Layers3 size={15}/> 기업 자료 재사용 워크스페이스</span><h2>같은 기업 자료로,<br/>다른 조건을 확인하세요</h2><p>지원기관부터 구매사까지. 보유 자료를 다시 활용하고,<br className="program-desktop-break"/> 필요한 확인과 보완만 이어가세요.</p><a href="/guide#guide-real-programs">처음이라면, 이용 순서 살펴보기 <ArrowRight size={15}/></a></div>
   <div className="program-reuse-map" role="img" aria-label={`하나의 기업 자료 묶음을 지원기관 ${grants}곳과 구매사 ${buyers}곳의 조건에 재사용하는 구조`}>
    <div className="program-map-source"><span><Files size={26}/></span><strong>기업 자료 묶음</strong><small>자격 · 증빙</small></div>
    <div className="program-map-lines" aria-hidden="true"><svg viewBox="0 0 70 120" preserveAspectRatio="none"><path d="M0 60 H28 Q38 60 38 48 V24 Q38 14 48 14 H70 M28 60 Q38 60 38 72 V96 Q38 106 48 106 H70" fill="none" stroke="currentColor" strokeWidth="2"/></svg></div>
    <div className="program-map-targets"><div><Landmark size={20}/><span>지원기관 <b>{grants}곳</b></span></div><div><Building2 size={20}/><span>구매사 <b>{buyers}곳</b></span></div></div>
    <p>한 번 준비한 자료, 대상마다 다른 조건 확인</p>
   </div>
  </header>
  <div className="program-kpis" aria-label="준비 현황 요약">
   <div><span className="program-kpi-icon"><Landmark size={19}/></span><span>비교할 대상</span><strong>{grants+buyers}<small>곳</small></strong><p>지원기관 {grants} · 구매사 {buyers}</p></div>
   <div><span className="program-kpi-icon"><FileCheck2 size={19}/></span><span>이번 검사 재사용 자격</span><strong>{credentialCount??'—'}<small>{credentialCount!==undefined?'개':''}</small></strong><p>{checks?'현재 사전 확인 결과 기준':'사전 확인 후 표시합니다'}</p></div>
   <div><span className="program-kpi-icon"><ScanLine size={19}/></span><span>보완·미충족 항목</span><strong>{attention??'—'}<small>{attention!==undefined?'개':''}</small></strong><p>{checks?`담당자 확인 ${review}개는 별도`:'결과에 따라 다음 할 일을 안내합니다'}</p></div>
   <div><span className="program-kpi-icon"><FolderOpen size={19}/></span><span>저장한 준비 기록</span><strong>{recordCount}<small>건</small></strong><p>{scope}</p></div>
  </div>
 </>;
}

export function PreparationSteps({selected,checked,saved}:{selected:boolean;checked:boolean;saved:boolean}){
 const current=saved?3:checked?2:selected?1:0;
 const steps=[{name:'기업·대상 선택',description:'어디에 준비할지 고르기',icon:Building2},{name:'보유 자료 확인',description:'조건과 보완 항목 확인',icon:ScanLine},{name:'준비 기록 저장',description:'동의 후 목록 내려받기',icon:FolderOpen}];
 return <div className="program-route"><ol aria-label="현재 준비 단계">{steps.map((s,i)=>{const Icon=s.icon,done=current>i;return <li key={s.name} className={done?'done':current===i?'current':''} aria-current={current===i?'step':undefined}><span className="program-route-icon">{done?<Check size={19}/>:<Icon size={19}/>}</span><div><small>{done?'완료':`0${i+1}`}</small><strong>{s.name}</strong><p>{s.description}</p></div></li>;})}</ol><div className="program-route-extra"><ShieldCheck size={20}/><span><strong>선택 · Midnight 검증</strong><small>저장 후 별도 동의와 관리자 승인</small></span></div></div>;
}
