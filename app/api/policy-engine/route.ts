import {getActiveRole} from '@/app/chatgpt-auth';
import {policyEngineStatus} from '@/lib/policy-engine';
export const dynamic='force-dynamic';
export async function GET(){if(await getActiveRole()!=='admin')return Response.json({error:'관리자 로그인이 필요합니다.'},{status:403});try{return Response.json(policyEngineStatus(),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'정책 엔진 설정을 확인하세요.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
