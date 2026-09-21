import {NextResponse} from 'next/server';
import {demoCookie,publicDemo,verifyDemo} from '@/lib/public-demo';
import {cookies} from 'next/headers';
import {env} from 'cloudflare:workers';
export async function GET(req:Request){if(!publicDemo())return new Response(null,{status:404});const site=req.headers.get('sec-fetch-site');if(site==='cross-site')return new Response(null,{status:403});const id=await verifyDemo((await cookies()).get(demoCookie)?.value??'');if(id)await env.DB!.prepare('UPDATE demo_sessions SET expires=0 WHERE id=?').bind(id).run();const res=NextResponse.redirect(new URL('/',process.env.BIZPROOF_APP_ORIGIN),303);for(const name of [demoCookie,'bizproof-persona'])res.cookies.set(name,'',{path:'/',maxAge:0,httpOnly:true,sameSite:'lax',secure:process.env.BIZPROOF_APP_ORIGIN?.startsWith('https:')});res.headers.set('Cache-Control','no-store');return res;}
