import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {selectRole} from '@/lib/keycloak';
import {listProcessRuns} from '@/lib/process-store';
export const dynamic='force-dynamic';
export async function GET(req:Request){
  const headers={'Cache-Control':'no-store'};
  try{
    const user=await getChatGPTUser();
    if(!user)return NextResponse.json({error:'체험 공간에 먼저 접속하세요.'},{status:401,headers});
    const role=selectRole(user.allowedRoles,(await cookies()).get('bizproof-persona')?.value);
    if(!role||!['company','admin'].includes(role))return NextResponse.json({error:'신청 기업 또는 업무 관리자 역할이 필요합니다.'},{status:403,headers});
    const id=new URL(req.url).searchParams.get('id')??undefined;
    if(id&&!/^process-[a-f0-9-]{36}$/.test(id))return NextResponse.json({error:'처리 기록 식별값을 확인하세요.'},{status:400,headers});
    const runs=await listProcessRuns({owner:user.storageOwner,actor:user.userId,role,authMode:user.authMode},id);
    return NextResponse.json({runs},{headers});
  }catch{return NextResponse.json({error:'처리 기록을 불러올 수 없습니다. 잠시 후 다시 확인하세요.'},{status:503,headers});}
}
