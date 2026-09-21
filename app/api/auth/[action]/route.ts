import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {authenticationMode,identityConfig} from '@/lib/keycloak-runtime';
import {startLogin,finishLogin,safeReturn} from '@/lib/keycloak';
import {getChatGPTUser} from '@/app/chatgpt-auth';
export const dynamic='force-dynamic';
const options=(secure:boolean)=>({httpOnly:true,secure,sameSite:'lax' as const,path:'/'});
function clear(res:NextResponse,secure:boolean){for(const name of ['bizproof-access','bizproof-persona','bizproof-flow','bizproof-admin'])res.cookies.set(name,'',{...options(secure),maxAge:0});return res;}
function privateResponse(res:NextResponse){res.headers.set('Cache-Control','no-store');res.headers.set('Referrer-Policy','no-referrer');return res;}
export async function GET(req:Request){const url=new URL(req.url),action=url.pathname.split('/').pop();try{
 const mode=authenticationMode();
 if(action==='session'){const user=await getChatGPTUser();return privateResponse(NextResponse.json({mode,authenticated:!!user,user:user?{id:user.userId,name:user.displayName,roles:user.allowedRoles,workspaceKind:user.workspaceKind,organization:user.organization}:null,accountUrl:mode==='keycloak'?identityConfig().issuer+'/account':null}));}
 if(action!=='login'&&action!=='callback')return NextResponse.json({error:'지원하지 않는 요청입니다.'},{status:405});
 if(mode==='demo')return privateResponse(NextResponse.redirect(new URL('/signin-with-chatgpt?return_to='+encodeURIComponent(safeReturn(url.searchParams.get('return_to'))),url.origin),303));
 const config=identityConfig();if(url.origin!==config.origin)throw Error('Origin mismatch');
 if(action==='login'){const flow=await startLogin(config,url.searchParams.get('return_to'));const res=NextResponse.redirect(flow.url,303);res.cookies.set('bizproof-flow',flow.cookie,{...options(url.protocol==='https:'),maxAge:600});return privateResponse(res);}
 if(url.searchParams.has('error')||url.searchParams.getAll('state').length!==1||url.searchParams.getAll('code').length!==1||(url.searchParams.has('iss')&&url.searchParams.get('iss')!==config.issuer))throw Error('Invalid callback');
 const result=await finishLogin(config,(await cookies()).get('bizproof-flow')?.value??'',url.searchParams.get('state')!,url.searchParams.get('code')!);
 const res=clear(NextResponse.redirect(new URL(result.returnTo,config.origin),303),url.protocol==='https:');res.cookies.set('bizproof-access',result.token,{...options(url.protocol==='https:'),maxAge:Math.max(0,Math.min(300,result.user.expiresAt-Math.floor(Date.now()/1000)))});return privateResponse(res);
 }catch{return privateResponse(clear(NextResponse.json({error:'로그인 설정, 배정 역할 또는 인증 응답을 확인하고 다시 로그인하세요.'},{status:401}),url.protocol==='https:'));}}
export async function POST(req:Request){const url=new URL(req.url);if(!url.pathname.endsWith('/logout'))return NextResponse.json({error:'지원하지 않는 요청입니다.'},{status:405});if(req.headers.get('origin')!==url.origin)return NextResponse.json({error:'허용되지 않는 출처입니다.'},{status:403});try{let destination=new URL('/signout-with-chatgpt?return_to=/',url.origin).href;if(authenticationMode()==='keycloak'){const config=identityConfig();if(url.origin!==config.origin)throw Error('Origin mismatch');const logout=new URL(config.issuer+'/protocol/openid-connect/logout');logout.search=new URLSearchParams({client_id:config.clientId,post_logout_redirect_uri:config.origin+'/'}).toString();destination=logout.href;}return privateResponse(clear(NextResponse.redirect(destination,303),url.protocol==='https:'));}catch{return privateResponse(clear(NextResponse.json({error:'로컬 세션을 종료했습니다. 인증 서버 설정을 확인하세요.'},{status:503}),url.protocol==='https:'));}}
