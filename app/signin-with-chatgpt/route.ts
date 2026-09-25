import {claimPreparedDemo,ensurePreparedWorkspace,demoAdmissionStatus} from '@/lib/demo-pool';
import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {env} from 'cloudflare:workers';
import {demoCookie,issueDemo,verifyDemo,publicDemo} from '@/lib/public-demo';
export const dynamic='force-dynamic';
export async function GET(req:Request){if(!publicDemo())return new Response('Not found',{status:404});return NextResponse.redirect(new URL('/welcome',process.env.BIZPROOF_APP_ORIGIN??req.url),307);}
export async function POST(req:Request){if(!publicDemo())return new Response(null,{status:404});const origin=process.env.BIZPROOF_APP_ORIGIN;if(!origin||req.headers.get('origin')!==origin)return new Response(null,{status:403});
 const existing=await verifyDemo((await cookies()).get(demoCookie)?.value??'');
 if(existing&&await env.DB!.prepare('SELECT id FROM demo_sessions WHERE id=? AND expires>?').bind(existing,Date.now()).first()){await ensurePreparedWorkspace(existing);const response=NextResponse.redirect(new URL('/?view=apply',origin),303);response.cookies.set('bizproof-persona','company',{httpOnly:true,secure:origin.startsWith('https:'),sameSite:'strict',path:'/'});return response;}
 const ip=req.headers.get('x-bizproof-client-ip')??'unknown',id=await claimPreparedDemo(ip);
 if(!id){const state=await demoAdmissionStatus(ip);const reason=state.rateLimited?'같은 네트워크의 체험 생성 한도에 도달했습니다.':'현재 체험 공간이 모두 사용 중입니다.';return new Response(`${reason} 약 ${Math.ceil(state.retryAfterSeconds/60)}분 후 다시 시도해 주세요. 기존 체험 창은 계속 사용할 수 있습니다.`,{status:429,headers:{'Content-Type':'text/plain; charset=utf-8','Retry-After':String(state.retryAfterSeconds),'Cache-Control':'no-store'}});}
 const token=await issueDemo(id),res=NextResponse.redirect(new URL('/?view=apply',origin),303);res.cookies.set(demoCookie,token,{httpOnly:true,secure:origin.startsWith('https:'),sameSite:'lax',path:'/',maxAge:7200});res.cookies.set('bizproof-persona','company',{httpOnly:true,secure:origin.startsWith('https:'),sameSite:'strict',path:'/'});res.headers.set('Cache-Control','no-store');return res;
}
