"use client";
import {useEffect,useState} from 'react';
import {z} from 'zod';
const profileResponse=z.object({profile:z.object({name:z.string(),company:z.string()}).nullable()});
export default function VisitorProfile(){
 const [name,setName]=useState(''),[company,setCompany]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;void fetch('/api/analytics/profile',{cache:'no-store'}).then(r=>r.json()).then(raw=>{const v=profileResponse.parse(raw);if(active&&v.profile){setName(v.profile.name);setCompany(v.profile.company);}}).catch(()=>{});return()=>{active=false;};},[]);
 return <section className="visitor-profile"><h2>방문자 이름 등록 <small>선택</small></h2><p>이름을 남기면 서비스 관리자가 이 브라우저의 방문 기록과 함께 확인할 수 있습니다. 등록하지 않아도 모든 시연 기능을 사용할 수 있습니다. 직접 입력한 정보로 표시되며 본인 인증으로 취급하지 않습니다.</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try{const r=await fetch('/api/analytics/profile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,company,consent})});const data=await r.json();if(!r.ok)throw Error(z.object({error:z.string()}).parse(data).error);setMessage('저장했습니다. 이후 서비스 방문과 기존 브라우저 기록에 연결됩니다.');}catch(e){setMessage(e instanceof Error?e.message:'저장하지 못했습니다.');}finally{setBusy(false);}}}>
 <label>이름<input autoComplete="name" maxLength={80} value={name} onChange={e=>setName(e.target.value)} required/></label><label>회사·소속 (선택)<input autoComplete="organization" maxLength={120} value={company} onChange={e=>setCompany(e.target.value)}/></label><label className="visitor-profile-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/>입력한 이름·소속을 방문 기록에 연결하고 자동 삭제 없이 보관하는 데 동의합니다.</label><button disabled={busy||!consent}>{busy?'저장 중…':'방문자 정보 저장'}</button>{message&&<p role="status">{message}</p>}</form></section>;
}
