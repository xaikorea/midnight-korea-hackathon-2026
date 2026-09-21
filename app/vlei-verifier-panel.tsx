"use client";
import {useEffect,useRef,useState} from 'react';
import KeriaPanel from './keria-panel';
import {parseKeriaHeaders} from '@/lib/keria-import';
import {Button} from '@/components/ui/button';
import {z} from 'zod';
import {vleiReadinessSchema,vleiResultSchema} from '@/lib/vlei-schema';
type Result=z.infer<typeof vleiResultSchema>;
type Readiness=z.infer<typeof vleiReadinessSchema>;
export default function VleiVerifierPanel({role}:{role:string}){
 const [expected,setExpected]=useState({aid:'',said:'',lei:'',role:''}),[cesr,setCesr]=useState(''),[headers,setHeaders]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[ready,setReady]=useState<Readiness|null>(null),[result,setResult]=useState<Result|null>(null);const alive=useRef(true),controller=useRef<AbortController|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();};},[]);
 if(!['admin','issuer','company'].includes(role))return null;
 async function call(action:'readiness'|'present'|'authorize'|'status'){
  controller.current?.abort();controller.current=new AbortController();setBusy(true);setError('');setResult(null);if(action==='readiness')setReady(null);
  try{let payload:unknown;if(action==='status')payload={action,expected};if(action==='present')payload={action,expected,cesr,consent};if(action==='authorize'){let parsed:unknown;try{parsed=JSON.parse(headers);}catch{throw Error('서명 헤더 JSON 형식을 확인하세요.');}payload={action,expected,headers:parsed};}
   const response=await fetch('/api/vlei',{signal:AbortSignal.any([controller.current.signal,AbortSignal.timeout(15000)]),method:action==='readiness'?'GET':'POST',cache:'no-store',headers:action==='readiness'?undefined:{'Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined});const body=await response.json();if(!response.ok)throw Error(z.object({error:z.string()}).parse(body).error);if(alive.current){if(action==='readiness')setReady(vleiReadinessSchema.parse(body));else{setResult(vleiResultSchema.parse(body));if(action==='authorize')setHeaders('');}}
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'요청 실패');}finally{if(alive.current){if(action==='authorize')setHeaders('');setBusy(false);}}
 }
 function downloadReport(){if(!result)return;const url=URL.createObjectURL(new Blob([JSON.stringify({format:'bizproof-vlei-observation-v1',...result},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='bizproof-vlei-observation.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const labels={processing:'제출 처리 기록 확인 · 승인 여부 별도', 'aged-off':'제출 처리 보관 시간 초과',accepted:'제출 수락 · 권한 확인 대기',matched:'외부 검증기 응답 일치',mismatch:'외부 검증기 응답 불일치','not-found':'처리 기록 확인 안 됨','not-authorized':'현재 권한 확인 안 됨'};
 return <section className="panel bottom-panel"><div className="section-heading"><div><h2>vLEI 외부 검증기</h2><p>KERI/ACDC 자격 제출과 담당자 권한 응답을 확인합니다.</p></div><span className="status warn">공인 신뢰 경로 미확인</span></div>
 <div className="button-row"><Button variant="outline" disabled={busy} onClick={()=>void call('readiness')}>vLEI 서비스 확인</Button></div>
 {ready&&<p role="status">{ready.reachable?'vLEI 서비스 응답 확인':'vLEI 서비스 연결 안 됨'} · {ready.notice}</p>}
 <KeriaPanel disabled={busy} onSelect={value=>{setExpected(value);setCesr('');setHeaders('');setResult(null);setConsent(false);setError('');}} onPresentation={value=>{setExpected(value.expected);setCesr(value.cesr);setHeaders('');setResult(null);setConsent(false);setError('');}}/>
 <details><summary>실제 vLEI 자격 제출 및 조회</summary><p>이미 발급받은 KERI/ACDC CESR와 해당 AID의 서명 도구가 필요합니다. 기존 BizProof 자격 JSON·VC-JWT·Midnight 주소는 이 형식으로 사용할 수 없습니다.</p>
 <div className="reviewed-form">{([['aid','담당자 AID'],['said','자격 SAID'],['lei','기업 LEI'],['role','대조할 역할']] as const).map(([key,label])=><label key={key}>{label}<input aria-label={label} disabled={busy} value={expected[key]} maxLength={key==='role'?100:key==='lei'?20:44} onChange={e=>{setExpected({...expected,[key]:e.target.value});setResult(null);setConsent(false);setHeaders('');}}/></label>)}</div>
 <label className="field wide">CESR 원문<textarea aria-label="CESR 원문" rows={4} maxLength={250000} disabled={busy} value={cesr} onChange={e=>{setCesr(e.target.value);setConsent(false);setResult(null);}} style={{width:'100%',overflowWrap:'anywhere'}}/></label>
 <label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/> 이 CESR를 로컬 검증기로 보내는 데 동의합니다.</label><div className="button-row"><Button disabled={busy||!consent||!cesr||Object.values(expected).some(v=>!v)} onClick={()=>void call('present')}>CESR 검증 제출</Button><Button variant="outline" disabled={busy||Object.values(expected).some(v=>!v)} onClick={()=>void call('status')}>제출 처리 상태 확인</Button></div>
 <p>권한 조회에는 <code>GET /authorizations/담당자-AID</code> 요청을 AID의 현재 키로 서명한 헤더가 필요합니다. signature-input, signature, signify-resource, signify-timestamp 네 항목을 소문자 키의 JSON으로 입력하세요. 서명 대상에 @method, @path, signify-resource, signify-timestamp와 created가 필요하며, 생성 후 5분 이내의 새 서명을 사용하세요. 앱은 헤더를 생성하거나 서명 검사를 끄지 않습니다.</p>
 <label className="field wide">KERIA 권한 조회 서명 파일<input type="file" accept=".json,application/json" aria-label="KERIA 권한 조회 서명 파일" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';setHeaders('');setResult(null);setError('');if(!file)return;setBusy(true);try{if(file.size>20000)throw Error('서명 파일이 너무 큽니다.');const parsed=parseKeriaHeaders(await file.text(),expected);if(alive.current)setHeaders(JSON.stringify(parsed));}catch{if(alive.current)setError('서명 파일의 형식·AID·유효 시간을 확인하세요.');}finally{if(alive.current)setBusy(false);}}}/></label>
 <label className="field wide">서명된 조회 헤더<textarea aria-label="서명된 조회 헤더" rows={4} maxLength={20000} value={headers} disabled={busy} onChange={e=>{setHeaders(e.target.value);setResult(null);}} style={{width:'100%',overflowWrap:'anywhere'}}/></label><div className="button-row"><Button variant="outline" disabled={busy||!headers||Object.values(expected).some(v=>!v)} onClick={()=>void call('authorize')}>서명된 권한 조회</Button><Button variant="ghost" disabled={busy} onClick={()=>{setCesr('');setHeaders('');setResult(null);setConsent(false);setError('');}}>vLEI 입력 지우기</Button></div></details>
 {error&&<p role="alert">{error}</p>}{result&&<div aria-live="polite"><b>{labels[result.status]}</b>{'checks' in result&&result.checks.map(c=><div className="check-row" key={c.label}><span>{c.label}</span><span className={'status '+(c.pass?'good':'bad')}>{c.pass?'일치':'불일치'}</span></div>)}<p>{result.notice}</p><small>{new Date(result.checkedAt).toLocaleString('ko-KR')} 조회 기준</small><div className="button-row"><Button variant="outline" onClick={downloadReport}>vLEI 조회 보고서 다운로드</Button></div></div>}
 <p className="context-note">202 수락, 200 응답 또는 AID 로그인만으로 기업 자격을 승인하지 않습니다. AID·SAID·LEI·역할을 모두 대조하며, 서비스의 GLEIF 신뢰 루트·취소 검사 설정은 별도로 확인해야 합니다. 결과를 기업·담당자 권한에 자동 연결하지 않습니다.</p></section>;
}

