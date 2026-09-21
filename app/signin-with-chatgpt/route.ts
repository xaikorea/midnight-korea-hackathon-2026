import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {env} from 'cloudflare:workers';
import {demoCookie,issueDemo,verifyDemo,publicDemo} from '@/lib/public-demo';
export const dynamic='force-dynamic';
export async function GET(req:Request){if(!publicDemo())return new Response('Not found',{status:404});return NextResponse.redirect(new URL('/welcome',process.env.BIZPROOF_APP_ORIGIN??req.url),307);}
export async function POST(req:Request){if(!publicDemo())return new Response(null,{status:404});const origin=process.env.BIZPROOF_APP_ORIGIN;if(!origin||req.headers.get('origin')!==origin)return new Response(null,{status:403});
 const existing=await verifyDemo((await cookies()).get(demoCookie)?.value??'');if(existing)return NextResponse.redirect(new URL('/?view=journey',origin),303);
 const db=env.DB!;await db.prepare('CREATE TABLE IF NOT EXISTS demo_sessions(id TEXT PRIMARY KEY,ip TEXT,created INTEGER,expires INTEGER)').run();
 const now=Date.now(),ip=req.headers.get('x-bizproof-client-ip')??'unknown',id='demo-'+crypto.randomUUID();
 const inserted=await db.prepare('INSERT INTO demo_sessions SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM demo_sessions WHERE expires>?)<5 AND (SELECT COUNT(*) FROM demo_sessions WHERE ip=? AND created>?)<10').bind(id,ip,now,now+7200000,now,ip,now-3600000).run();
 if(inserted.meta.changes!==1)return new Response('현재 체험 공간이 모두 사용 중입니다. 잠시 후 다시 시도해 주세요.',{status:429,headers:{'Content-Type':'text/plain; charset=utf-8','Retry-After':'300'}});
 const token=await issueDemo(id),res=NextResponse.redirect(new URL('/?view=journey',origin),303);res.cookies.set(demoCookie,token,{httpOnly:true,secure:origin.startsWith('https:'),sameSite:'lax',path:'/',maxAge:7200});res.headers.set('Cache-Control','no-store');return res;
}
