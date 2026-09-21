import {getChatGPTUser} from '@/app/chatgpt-auth';
import {LeiLookupError,lookupLei} from '@/lib/lei-directory';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function GET(req:Request){
 if(!await getChatGPTUser())return json({error:'로그인이 필요합니다.'},401);
 try{return json(await lookupLei(new URL(req.url).searchParams.get('lei')??''));}
 catch(e){return json({error:e instanceof LeiLookupError?e.message:'조회하지 못했습니다.'},e instanceof LeiLookupError?e.status:503);}
}
