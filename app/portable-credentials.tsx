"use client";
import {useRef,useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {type ViewState,statusOf} from '@/lib/domain';
import type {exportPortableCredential,verifyPortableCredential} from '@/lib/portable-credential';
type Export=Awaited<ReturnType<typeof exportPortableCredential>>;
type Report=Awaited<ReturnType<typeof verifyPortableCredential>>;
function download(name:string,text:string,type:string){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export default function PortableCredentials({data,busy,act}:{data:ViewState;busy:boolean;act:(a:string,p:Record<string,unknown>)=>Promise<unknown>}){
 const [id,setId]=useState(''),[consent,setConsent]=useState(false),[exported,setExported]=useState<Export|null>(null),[token,setToken]=useState(''),[report,setReport]=useState<Report|null>(null);const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 if(!['admin','issuer','company'].includes(data.role))return null;
 return <section className="panel bottom-panel"><div className="section-heading"><div><h2>자격 파일 교환 · VC-JWT</h2><p>발급 자격을 서명된 교환 파일로 내보내고, 가져온 파일을 현재 발급 기록과 대조합니다.</p></div><span className="status warn">외부 지갑 연동 미검증</span></div>
 <div className="reviewed-form"><label>교환할 기업 자격<select aria-label="교환할 기업 자격" disabled={busy} value={id} onChange={e=>{setId(e.target.value);setConsent(false);setExported(null);}}><option value="">자격 선택</option>{data.credentials.filter(c=>statusOf(c)==='active').map(c=><option key={c.id} value={c.id}>{data.companies.find(x=>x.id===c.companyId)?.name} · {c.id}</option>)}</select></label></div>
 <p>파일에는 매출·설립일·소재지·인증 여부의 원본 값이 들어갑니다. 구매사·지원기관에는 기존 검증 요청을 통해 조건 결과만 제출하세요.</p>
 <label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>{setConsent(e.target.checked);setExported(null);}}/> 원본 속성이 포함된 교환 파일 생성을 이해했습니다.</label>
 <div className="button-row"><Button disabled={busy||!id||!consent} onClick={async()=>{setExported(null);try{const value=await act('export-portable-credential',{id,consent:true}) as Export;if(alive.current)setExported(value);}catch{}}}>VC-JWT 교환 파일 생성</Button></div>
 {exported&&<div className="compact-request"><b>서명된 교환 파일 준비 완료</b><p>유효기한: {new Date(exported.expiresAt).toLocaleString('ko-KR')} · 최대 24시간</p><p>{exported.notice}</p><div className="button-row"><Button variant="outline" disabled={busy} onClick={()=>download('bizproof-credential.jwt',exported.token,'application/jwt')}>JWT 파일 다운로드</Button><Button variant="outline" disabled={busy} onClick={()=>download('bizproof-issuer-did.json',JSON.stringify(exported.didDocument,null,2),'application/json')}>발급자 DID 문서 다운로드</Button><Button variant="ghost" disabled={busy} onClick={()=>{setToken(exported.token);setReport(null);}}>생성한 파일 검사하기</Button></div></div>}
 <label className="field wide">검사할 VC-JWT<textarea aria-label="검사할 VC-JWT" rows={4} maxLength={30000} disabled={busy} value={token} onChange={e=>{setToken(e.target.value);setReport(null);}} style={{width:'100%',overflowWrap:'anywhere'}} placeholder="점(.)으로 구분된 JWT 문자열을 붙여넣으세요"/></label>
 <div className="button-row"><Button variant="outline" disabled={busy||!token.trim()} onClick={async()=>{setReport(null);try{const value=await act('verify-portable-credential',{token}) as Report;if(alive.current)setReport(value);}catch{}}}>교환 파일 검증</Button><Button variant="ghost" disabled={busy} onClick={()=>{setToken('');setReport(null);setExported(null);setConsent(false);}}>교환 데이터 지우기</Button></div>
 {report&&<div aria-live="polite"><b>{report.valid?'현재 발급 기록과 검증 일치':'교환 파일 검증 실패'}</b>{report.checks.map(c=><div className="check-row" key={c.id}><span>{c.label}</span><span className={'status '+(c.pass?'good':'bad')}>{c.pass?'확인':'실패'}</span></div>)}<p>{report.notice}</p><small>{new Date(report.checkedAt).toLocaleString('ko-KR')} 기준</small></div>}
 <p className="context-note">walt.id의 발급·지갑·검증 분리와 VC-JWT 교환 방식을 참고한 독립 구현입니다. did:jwk는 공개키 식별자이며 공인 vLEI가 아닙니다. 외부 토큰 자동 등록, OpenID4VCI/VP 세션, 선택적 공개는 연결하지 않았습니다.</p></section>;
}
