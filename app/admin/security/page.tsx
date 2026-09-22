import Link from 'next/link';
import {redirect} from 'next/navigation';
import {serviceAdmin} from '@/lib/service-admin';
import PasswordForm from './password-form';
import './security.css';

export const metadata={title:'비밀번호 변경 | BizProof 관리자',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';

export default async function SecurityPage(){
 const user=await serviceAdmin();
 if(!user)redirect('/admin/login');
 return <main className="admin-security"><Link href="/admin" className="admin-security-back">← 관리자 페이지로 돌아가기</Link>
  <section className="admin-security-card"><span className="admin-eyebrow">ACCOUNT SECURITY</span>
   <h1>비밀번호 변경</h1><p>관리자 계정을 안전하게 관리하세요.</p>
   {user.authMode==='local-admin'?<PasswordForm/>:<p>이 계정은 외부 로그인 서비스에서 비밀번호를 관리합니다. 해당 서비스의 계정 설정에서 변경해 주세요.</p>}
  </section>
 </main>;
}
