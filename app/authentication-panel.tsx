'use client';
import {useEffect,useState} from 'react';
import {roleLabels,type ViewState} from '@/lib/domain';
export function AuthenticationPanel({data}:{data:ViewState}){
 const [account,setAccount]=useState<string|null>(null);
 useEffect(()=>{let active=true;fetch('/api/auth/session').then(r=>r.ok?r.json() as Promise<{accountUrl?:string}>:null).then(s=>{if(active)setAccount(s?.accountUrl??null);}).catch(()=>{});return()=>{active=false;};},[]);
 return <section className="panel"><h2>로그인 · 업무 접근 권한</h2><p>{data.authMode==='keycloak'?'Keycloak 인증 · 서버에서 서명과 배정 역할을 확인합니다.':'데모 인증 · 체험을 위해 모든 역할을 전환할 수 있습니다.'}</p><p>{data.user} · {data.allowedRoles.map(r=>roleLabels[r]).join(', ')}</p><p>{data.workspaceKind==='shared'?`기관 공동 업무 공간 · ${data.organization??''} · 배정된 참여 기관과 신청을 공유합니다.`:'사용자별 개인 워크스페이스입니다.'} 기업 자격·담당자 위임은 별도로 검증합니다.</p>{data.authMode==='keycloak'&&<p>인증 유효기간은 최대 5분입니다. 만료되면 다시 로그인하세요.</p>}{account&&<p><a href={account} target="_blank" rel="noreferrer">계정 · 비밀번호 · 다중 인증 관리</a></p>}<form action="/api/auth/logout" method="post"><button className="signin-button" type="submit">로그아웃</button></form></section>;
}
