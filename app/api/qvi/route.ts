import {getChatGPTUser} from '@/app/chatgpt-auth';
import {qviDirectory} from '@/lib/qvi-directory';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(!await getChatGPTUser())return Response.json({error:'로그인이 필요합니다.'},{status:401,headers});
 const p=new URL(req.url).searchParams;
 try{return Response.json(qviDirectory(p.get('q')??'',p.get('sort')??'newest'),{headers});}
 catch{return Response.json({error:'검색 조건 또는 발급기관 자료를 확인하세요.'},{status:400,headers});}
}
