'use client';
import Link from 'next/link';
import {z} from 'zod';
import {useState,type FormEvent} from 'react';

export default function PasswordForm(){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(''),[expired,setExpired]=useState(false),[visible,setVisible]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  const form=event.currentTarget,data=new FormData(form);
  const currentPassword=String(data.get('currentPassword')??''),newPassword=String(data.get('newPassword')??''),confirmPassword=String(data.get('confirmPassword')??'');
  setError('');setDone('');setExpired(false);
  if(Array.from(newPassword).length<8){setError('새 비밀번호는 8자 이상으로 입력하세요.');return;}
  if(newPassword!==confirmPassword){setError('새 비밀번호와 확인 입력이 일치하지 않습니다.');return;}
  setBusy(true);
  try{
   const response=await fetch('/api/admin/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword,newPassword,confirmPassword})});
   const result=z.object({error:z.string().optional(),message:z.string().optional()}).parse(await response.json());
   if(!response.ok){setExpired(response.status===401);throw Error(result.error||'비밀번호를 변경하지 못했습니다.');}
   form.reset();setVisible(false);setDone(result.message??'비밀번호를 변경했습니다.');
  }catch(e){setError(e instanceof Error?e.message:'연결 상태를 확인하고 다시 시도하세요.');}
  finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="admin-password-form" aria-busy={busy}>
  <p className="admin-password-notice" id="password-policy">새 비밀번호는 <strong>8자 이상</strong>으로 입력하세요. 변경 후 현재 기기는 로그인이 유지되며, 다른 기기에서는 새 비밀번호로 다시 로그인해야 합니다.</p>
  <input type="text" name="username" autoComplete="username" value="admin" readOnly hidden/>
  <label htmlFor="current-password">현재 비밀번호</label>
  <input id="current-password" name="currentPassword" type={visible?'text':'password'} autoComplete="current-password" maxLength={200} required disabled={busy}/>
  <label htmlFor="new-password">새 비밀번호</label>
  <input id="new-password" name="newPassword" type={visible?'text':'password'} autoComplete="new-password" minLength={8} maxLength={200} aria-describedby="password-policy" required disabled={busy}/>
  <label htmlFor="confirm-password">새 비밀번호 확인</label>
  <input id="confirm-password" name="confirmPassword" type={visible?'text':'password'} autoComplete="new-password" minLength={8} maxLength={200} required disabled={busy}/>
  <label className="admin-password-visibility"><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/>비밀번호 표시</label>
  {error&&<p role="alert" className="admin-password-error">{error}{expired&&<> <Link href="/admin/login">다시 로그인</Link></>}</p>}
  {done&&<p role="status" className="admin-password-success">{done}</p>}
  <button className="admin-password-submit" type="submit" disabled={busy}>{busy?'변경 중…':'비밀번호 변경'}</button>
 </form>;
}
