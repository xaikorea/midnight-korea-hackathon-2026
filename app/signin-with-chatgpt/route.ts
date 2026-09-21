import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {env} from 'cloudflare:workers';
import {demoCookie,issueDemo,verifyDemo,publicDemo} from '@/lib/public-demo';
export const dynamic='force-dynamic';
export async function GET(){if(!publicDemo())return new Response('Not found',{status:404});return new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>BizProof 공개 체험</title><body style="font-family:system-ui;max-width:600px;margin:12vh auto;padding:24px;color:#18314a"><h1>BizProof 공개 체험</h1><p>한 번 발급한 기업 자격으로 구매사 등록과 지원사업 신청을 체험하세요.</p><p>가상 기업과 합성 자료를 사용하는 서버 서명 기반 시연입니다. 실제 기관 인증이나 블록체인 거래 완료를 의미하지 않습니다.</p><p>방문자별로 분리된 2시간 체험 공간을 제공합니다. 실제 개인정보나 기업 기밀을 입력하지 마세요.</p><form method="post"><button style="padding:16px;background:#2450ed;color:white;border:0;border-radius:8px;font-size:18px">내 체험 공간 시작하기</button></form><p><a href="/guide">이용자 가이드</a> · <a href="/privacy/analytics">방문 정보 안내</a></p></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"}});}
export async function POST(req:Request){if(!publicDemo())return new Response(null,{status:404});const origin=process.env.BIZPROOF_APP_ORIGIN;if(!origin||req.headers.get('origin')!==origin)return new Response(null,{status:403});
 const existing=await verifyDemo((await cookies()).get(demoCookie)?.value??'');if(existing)return NextResponse.redirect(new URL('/?view=journey',origin),303);
 const db=env.DB!;await db.prepare('CREATE TABLE IF NOT EXISTS demo_sessions(id TEXT PRIMARY KEY,ip TEXT,created INTEGER,expires INTEGER)').run();
 const now=Date.now(),ip=req.headers.get('x-bizproof-client-ip')??'unknown',id='demo-'+crypto.randomUUID();
 const inserted=await db.prepare('INSERT INTO demo_sessions SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM demo_sessions WHERE expires>?)<5 AND (SELECT COUNT(*) FROM demo_sessions WHERE ip=? AND created>?)<10').bind(id,ip,now,now+7200000,now,ip,now-3600000).run();
 if(inserted.meta.changes!==1)return new Response('현재 체험 공간이 모두 사용 중입니다. 잠시 후 다시 시도해 주세요.',{status:429,headers:{'Content-Type':'text/plain; charset=utf-8','Retry-After':'300'}});
 const token=await issueDemo(id),res=NextResponse.redirect(new URL('/?view=journey',origin),303);res.cookies.set(demoCookie,token,{httpOnly:true,secure:origin.startsWith('https:'),sameSite:'lax',path:'/',maxAge:7200});res.headers.set('Cache-Control','no-store');return res;
}
