import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {requestOrigin} from '@/lib/public-demo';
import {analyticsDb,visitorCookieId,visitorProfileInput} from '@/lib/visitor-analytics';
const headers={'Cache-Control':'no-store'};
export async function GET(){const jar=await cookies(),id=visitorCookieId(jar.get('bp-visitor')?.value);if(!id)return Response.json({profile:null},{headers});const db=await analyticsDb(env.DB);return Response.json({profile:await db.prepare('SELECT name,company FROM visitor_profiles WHERE visitor_id=?').bind(id).first()},{headers});}
export async function POST(req:Request){
 if(req.headers.get('origin')!==requestOrigin(req))return new Response(null,{status:403,headers});
 const jar=await cookies();if(req.headers.get('sec-gpc')==='1'||jar.get('bp-analytics-optout')?.value==='1')return Response.json({error:'방문 수집이 중지되어 있습니다. 수집 설정을 먼저 확인하세요.'},{status:409,headers});
 try{const raw=await req.text();if(raw.length>1200)return new Response(null,{status:413,headers});const input=visitorProfileInput.parse(JSON.parse(raw));const id=visitorCookieId(jar.get('bp-visitor')?.value)??crypto.randomUUID();const db=await analyticsDb(env.DB),now=new Date().toISOString();
 const previous=await db.prepare('SELECT updated_at FROM visitor_profiles WHERE visitor_id=?').bind(id).first<{updated_at:string}>();if(previous&&Date.now()-Date.parse(previous.updated_at)<10000)return Response.json({error:'잠시 후 다시 저장하세요.'},{status:429,headers});
 await db.prepare('INSERT INTO visitor_profiles(visitor_id,name,company,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(visitor_id) DO UPDATE SET name=excluded.name,company=excluded.company,updated_at=excluded.updated_at').bind(id,input.name,input.company,now,now).run();
 const res=NextResponse.json({saved:true},{headers});res.cookies.set('bp-visitor',id,{httpOnly:true,sameSite:'lax',secure:requestOrigin(req).startsWith('https:'),path:'/',maxAge:365*86400});return res;
 }catch{return Response.json({error:'이름과 회사명을 확인하세요.'},{status:400,headers});}
}
