'use client';
import {useState} from 'react';
import BizProofLogo from './bizproof-logo';
export default function EntryForm({demo}:{demo:boolean}){
 const [pending,setPending]=useState(false),[error,setError]=useState('');
 async function start(event:React.FormEvent<HTMLFormElement>){if(!demo){setPending(true);return;}event.preventDefault();setPending(true);setError('');try{const response=await fetch('/signin-with-chatgpt',{method:'POST'});if(!response.ok)throw new Error(response.status===429?'현재 체험 공간이 모두 사용 중입니다. 잠시 후 다시 시도해 주세요.':'체험 공간을 열지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.');window.location.assign('/?view=journey');}catch(e){setError(e instanceof Error?e.message:'네트워크 연결을 확인해 주세요.');setPending(false);}}
 return <form action={demo?'/signin-with-chatgpt':'/api/auth/login'} method={demo?'post':'get'} onSubmit={start} className="welcome-entry"><button disabled={pending} type="submit">{pending?<><BizProofLogo animated compact/><span role="status">내 체험 공간을 준비하고 있어요…</span></>:<>내 체험 공간 시작하기 <span aria-hidden="true">↗</span></>}</button>{error&&<p role="alert" style={{color:'#ad3342',fontSize:13,lineHeight:1.7,marginTop:14}}>{error}</p>}</form>
}
