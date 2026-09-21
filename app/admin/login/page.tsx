import {publicDemo} from '@/lib/public-demo';
import Link from 'next/link';
import {serviceAdmin} from '@/lib/service-admin';
import {redirect} from 'next/navigation';
export const metadata={robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function AdminLogin(){if(await serviceAdmin())redirect('/admin');return <main className="admin-login"><div className="admin-login-card"><span className="admin-eyebrow">BIZPROOF · INTERNAL</span><h1>서비스 관리자 로그인</h1><p>방문 기록과 고객 분석은 지정된 서비스 관리자만 확인할 수 있습니다.</p>{publicDemo()?<form action="/api/demo-admin" method="post"><label>관리자 아이디<input name="username" autoComplete="username" required/></label><label>관리자 비밀번호<input name="password" type="password" autoComplete="current-password" required/></label><button className="admin-primary">관리자 로그인</button></form>:<form action="/api/auth/login" method="get"><input type="hidden" name="return_to" value="/admin"/><button className="admin-primary" style={{width:"100%"}}>관리자 계정으로 로그인</button></form>}<p className="admin-muted">공개 시연에서는 별도로 발급한 서비스 관리자 계정을 사용합니다. 기관 운영 모드에서는 Keycloak 계정 지정을 지원합니다. 일반 업무 관리자에게 전체 방문 정보가 공개되지는 않습니다.</p><Link href="/">서비스로 돌아가기</Link></div></main>;}
