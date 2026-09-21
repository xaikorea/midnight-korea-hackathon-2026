import {getChatGPTUser,getActiveRole} from '@/app/chatgpt-auth';
import {accessConfig} from '@/lib/openfga-runtime';
import {fgaClient,fgaCompany,fgaUser,FgaError} from '@/lib/openfga';
import {readState} from '@/lib/store';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){const user=await getChatGPTUser(),role=await getActiveRole();if(!user||!role)return json({error:'로그인이 필요합니다.'},401);try{
 const config=accessConfig(),id=new URL(req.url).searchParams.get('companyId');
 if(!id)return json({mode:config?'openfga':'local',roles:user.allowedRoles,scope:'워크스페이스 역할 및 증빙 파일 접근'});
 if(!['admin','issuer','company'].includes(role))return json({error:'문서 접근 역할이 아닙니다.'},403);
 const {state}=await readState(user.storageOwner);if(!state.companies.some(c=>c.id===id))return json({error:'기업을 찾을 수 없습니다.'},404);
 if(!config&&user.authMode==='keycloak')throw new FgaError();if(!config)return json({mode:'local',read:true,write:true,notice:'기존 역할 검사 기준입니다. OpenFGA 검증 결과가 아닙니다.'});
 const client=fgaClient(config),object=fgaCompany(user.storageOwner,id),subject=fgaUser(user.userId);
 const [read,write,businessRead,businessWrite]=await Promise.all(['can_read_evidence','can_write_evidence','can_read_business','can_write_business'].map(relation=>client.check(subject,relation,object)));
 return json({mode:'openfga',read,write,businessRead,businessWrite,notice:'증빙과 업무 자료의 권한은 별도로 부여됩니다. 업무 읽기·변경 권한은 자격·초안·요청에도 적용됩니다.'});
 }catch(e){return json({error:e instanceof FgaError?e.message:'접근 권한을 확인하지 못했습니다.'},503);}}
