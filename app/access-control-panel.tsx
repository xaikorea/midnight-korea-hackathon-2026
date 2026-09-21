"use client";
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {z} from 'zod';
const resultSchema=z.object({mode:z.enum(['local','openfga']),read:z.boolean(),write:z.boolean(),businessRead:z.boolean().optional(),businessWrite:z.boolean().optional(),notice:z.string()});
export default function AccessControlPanel({companies}:{companies:{id:string;name:string}[]}){
 const [id,setId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<z.infer<typeof resultSchema>|null>(null);
 async function check(){setBusy(true);setError('');setResult(null);try{const r=await fetch('/api/access?companyId='+encodeURIComponent(id),{cache:'no-store'}),body=await r.json();if(!r.ok)throw Error(z.object({error:z.string()}).parse(body).error);setResult(resultSchema.parse(body));}catch(e){setError(e instanceof Error?e.message:'권한 확인 실패');}finally{setBusy(false);}}
 return <section className="panel bottom-panel"><div className="section-heading"><div><h2>조직·증빙 접근 권한</h2><p>OpenFGA 관계 기반 권한 · 현재 계정의 접근 확인</p></div></div><p className="context-note">OpenFGA 모드에서는 로그인 역할과 워크스페이스 권한을 함께 확인하고, 기업별 증빙 권한과 자격·초안·요청의 업무 권한을 각각 검사합니다. 역할이나 관계를 이 화면에서 부여하지 않습니다.</p><label>권한을 확인할 기업<select aria-label="권한 확인 기업" value={id} disabled={busy} onChange={e=>{setId(e.target.value);setResult(null);setError('');}}><option value="">기업 선택</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><Button variant="outline" disabled={busy||!id} onClick={()=>void check()}>내 증빙 권한 확인</Button>{error&&<p role="alert">{error}</p>}{result&&<div role="status"><b>{result.mode==='openfga'?'OpenFGA 검사':'기존 역할 검사'} · 읽기 {result.read?'허용':'거절'} · 업로드 {result.write?'허용':'거절'}</b>{result.businessRead!==undefined&&<p>업무 자료 읽기 {result.businessRead?'허용':'거절'} · 변경 {result.businessWrite?'허용':'거절'}</p>}<p>{result.notice}</p></div>}</section>;
}
