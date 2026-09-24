import {z} from 'zod';
import {serviceAdmin} from '@/lib/service-admin';
import {publicDemo,requestOrigin} from '@/lib/public-demo';
import {allProofJobs,publicProofJob,refreshProofJob,approveProofJob,resumeProofJob,cancelProofJob,ProofJobError} from '@/lib/proof-jobs';
export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){if(!publicDemo()||!await serviceAdmin())return reply({error:'서비스 관리자 인증이 필요합니다.'},403);const jobs=[];for(const j of await allProofJobs())jobs.push(publicProofJob(await refreshProofJob(j)));return reply({jobs});}
export async function POST(req:Request){try{const u=await serviceAdmin();if(!publicDemo()||!u||req.headers.get('origin')!==requestOrigin(req))return reply({error:'관리자 인증과 요청 출처를 확인하세요.'},403);const text=await req.text();if(text.length>2000)return reply({error:'요청이 너무 큽니다.'},413);const b=z.object({action:z.enum(['approve','cancel','resume']),id:z.string().uuid(),revision:z.number().int().nonnegative()}).strict().parse(JSON.parse(text));return reply(publicProofJob(b.action==='approve'?await approveProofJob(b.id,u.userId,b.revision):b.action==='resume'?await resumeProofJob(b.id,b.revision):await cancelProofJob(b.id)));}catch(e){return reply({error:e instanceof ProofJobError?e.message:'작업 상태를 다시 확인하세요.'},e instanceof ProofJobError?e.status:400);}}
