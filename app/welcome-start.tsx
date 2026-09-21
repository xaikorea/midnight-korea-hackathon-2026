'use client';
import {useState} from 'react';
import BizProofLogo from './bizproof-logo';
export default function EntryForm({demo}:{demo:boolean}){const [pending,setPending]=useState(false);return <form action={demo?'/signin-with-chatgpt':'/api/auth/login'} method={demo?'post':'get'} onSubmit={()=>setPending(true)} className="welcome-entry"><button disabled={pending} type="submit">{pending?<><BizProofLogo animated compact/><span role="status">내 체험 공간을 준비하고 있어요…</span></>:<>내 체험 공간 시작하기 <span aria-hidden="true">↗</span></>}</button></form>}
