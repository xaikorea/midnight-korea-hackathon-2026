import {getChatGPTUser} from '@/app/chatgpt-auth';
import {requestOrigin} from '@/lib/public-demo';
import {identityCapabilities,IdentityProviderError} from '@/lib/identity-provider';
import {requireIdentityPilot,startIdentitySession,checkIdentitySession,identitySessionCommand} from '@/lib/identity-sessions';
import {readState} from '@/lib/store';
export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){return reply(identityCapabilities());}
export async function POST(req:Request){try{const u=await getChatGPTUser();if(!u)return reply({error:'파일럿 계정으로 로그인하세요.'},401);requireIdentityPilot(u.userId,u.authMode);if(req.headers.get('origin')!==requestOrigin(req))return reply({error:'요청 출처를 확인하세요.'},403);const text=await req.text();if(text.length>2500)return reply({error:'입력 크기를 확인하세요.'},413);const b=identitySessionCommand.parse(JSON.parse(text));if(b.action==='start'){const {state}=await readState(u.storageOwner);if(!state.companies.some(c=>c.id===b.companyId))return reply({error:'접근 가능한 기업을 선택하세요.'},403);return reply(await startIdentitySession(u.userId,b));}return reply(await checkIdentitySession(u.userId,b.id,b.action==='cancel'));}catch(e){return reply({error:e instanceof IdentityProviderError?e.message:'인증 상태를 확인할 수 없습니다.'},e instanceof IdentityProviderError?e.status:422);}}
