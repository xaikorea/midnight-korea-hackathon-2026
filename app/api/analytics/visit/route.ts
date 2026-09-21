import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {visitInput,safeVisitPath,kstParts,browserInfo,locationInfo,analyticsDb,recordVisit} from '@/lib/visitor-analytics';
export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return new Response(null,{status:403});
 if(req.headers.get('sec-gpc')==='1')return new Response(null,{status:204});
 try{const raw=await req.text();if(raw.length>1000)return new Response(null,{status:413});const input=visitInput.parse(JSON.parse(raw)),path=safeVisitPath(input.path);
 const jar=await cookies();if(jar.get('bp-analytics-optout')?.value==='1')return new Response(null,{status:204});
 const current=jar.get('bp-visitor')?.value,visitorId=current&&/^[a-f0-9-]{36}$/.test(current)?current:crypto.randomUUID();
 const now=new Date(),ua=(req.headers.get('user-agent')??'').slice(0,512),user=await getChatGPTUser();
 const db=await analyticsDb(env.DB);
 // Limit duplicate bursts per browser. Event ID additionally makes retries idempotent.
 const recent=await db.prepare('SELECT COUNT(*) n FROM visitor_events WHERE visitor_id=? AND occurred_at>?').bind(visitorId,new Date(now.getTime()-60000).toISOString()).first<{n:number}>();if((recent?.n??0)>=60)return new Response(null,{status:429});
 const {geoSource,...location}=locationInfo(req,env.BIZPROOF_ANALYTICS_CLOUDFLARE==='true');
 await recordVisit(db,{id:input.eventId,occurred_at:now.toISOString(),...kstParts(now),visitor_id:visitorId,user_id:user?.authMode==='keycloak'?user.userId:null,name:user?.authMode==='keycloak'?(user.fullName??user.displayName).slice(0,160):null,...location,...browserInfo(ua),geo_source:geoSource,user_agent:ua,path} as Parameters<typeof recordVisit>[1]);
 const res=new NextResponse(null,{status:204,headers:{'Cache-Control':'no-store'}});res.cookies.set('bp-visitor',visitorId,{httpOnly:true,sameSite:'lax',secure:new URL(req.url).protocol==='https:',path:'/',maxAge:365*86400});return res;
 }catch{return new Response(null,{status:400,headers:{'Cache-Control':'no-store'}});}
}
