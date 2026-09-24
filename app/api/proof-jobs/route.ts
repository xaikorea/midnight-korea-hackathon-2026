import {z} from 'zod';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {publicDemo,requestOrigin} from '@/lib/public-demo';
import {demoWriteAllowed} from '@/lib/public-demo-guard';
import {allProofJobs,publicProofJob,refreshProofJob,requestProofJob,cancelProofJob,ProofJobError} from '@/lib/proof-jobs';
import {readState} from '@/lib/store';
export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
async function context(){const user=await getChatGPTUser();if(!user)throw new ProofJobError(401,'체험 공간에 먼저 접속하세요.');if(!publicDemo()||user.authMode!=='demo'||user.storageOwner!==user.userId||!user.userId.startsWith('demo-'))throw new ProofJobError(403,'합성 체험 전용 기능입니다.');return user;}
function failure(e:unknown){return reply({error:e instanceof ProofJobError?e.message:e instanceof z.ZodError?'입력값을 확인하세요.':'기관·작업 상태를 다시 확인해야 합니다.'},e instanceof ProofJobError?e.status:e instanceof z.ZodError?400:503);}
export async function GET(){try{const u=await context(),{state}=await readState(u.storageOwner),jobs=[];for(const j of await allProofJobs(u.storageOwner))jobs.push(publicProofJob(await refreshProofJob(j)));
 const candidates=state.credentials.filter(c=>c.proofVersion===3&&c.status==='active').map(c=>({credentialId:c.id,requests:state.requests.filter(r=>['verified','rejected'].includes(r.status)&&state.presentations.some(p=>p.requestId===r.id&&p.credentialId===c.id&&p.verifiedAt&&p.submittedBy===u.userId)).map(r=>({id:r.id,kind:r.policy.kind,audience:r.policy.audience,policyHash:r.policyHash}))}));return reply({jobs,candidates,execution:'presenter-approved-local-devnet',identity:'simulated'});}catch(e){return failure(e);}}
export async function POST(req:Request){try{const u=await context();if(req.headers.get('origin')!==requestOrigin(req))throw new ProofJobError(403,'같은 사이트에서 요청하세요.');if(!await demoWriteAllowed(u.userId))throw new ProofJobError(429,'잠시 후 다시 시도하세요.');const raw=await req.text();if(raw.length>4000)throw new ProofJobError(413,'요청이 너무 큽니다.');
 const b=z.discriminatedUnion('action',[z.object({action:z.literal('request'),credentialId:z.string().max(100),requestIds:z.array(z.string().max(150)).length(2),key:z.string().uuid(),consent:z.literal(true)}).strict(),z.object({action:z.literal('cancel'),id:z.string().uuid()}).strict()]).parse(JSON.parse(raw));return reply(publicProofJob(b.action==='request'?await requestProofJob(u.storageOwner,b):await cancelProofJob(b.id,u.storageOwner)));}catch(e){return failure(e);}}
