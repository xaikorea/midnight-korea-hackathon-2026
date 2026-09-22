"use client";
import {useEffect,useState} from 'react';
import {safeVisitPath} from '@/lib/visitor-analytics';
let lastTracked='';
export default function VisitTracker(){const [notice,setNotice]=useState(false);
 useEffect(()=>{let alive=true;const tick=()=>{if(!alive)return;if(document.cookie.includes('bp-analytics-optout=1')||(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl){lastTracked='';setNotice(false);return;}
 let path:string;try{path=safeVisitPath(location.pathname+location.search);}catch{lastTracked='';setNotice(false);return;}if(path===lastTracked)return;lastTracked=path;
 try{if(!localStorage.getItem('bp-analytics-notice'))setNotice(true);}catch{setNotice(true);}
 void fetch('/api/analytics/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:crypto.randomUUID(),path}),keepalive:true}).catch(()=>{});
 };tick();const timer=setInterval(tick,1000);return()=>{alive=false;clearInterval(timer);};},[]);
 if(!notice)return null;
 return <aside className="visitor-notice" aria-label="방문 분석 안내"><p>서비스 개선을 위해 방문 시각·페이지·IP·브라우저·대략적인 지역과 로그인으로 확인된 이름을 보관하고 월별로 분석합니다. 기록은 자동 삭제하지 않습니다.</p><a href="/privacy/analytics">수집 내용 · 이름 등록(선택)</a><button onClick={()=>{try{localStorage.setItem('bp-analytics-notice','1');}catch{}setNotice(false);}}>확인</button><button onClick={()=>{document.cookie='bp-analytics-optout=1; Path=/; Max-Age=31536000; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');setNotice(false);}}>이 브라우저 수집 중지</button></aside>;
}
