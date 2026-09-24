import {z} from 'zod';
import {authenticateProofWorker} from '@/lib/proof-worker-auth';
import {claimProofJob,proofWorkerCommand,verificationTask,completeProofVerification,ProofJobError} from '@/lib/proof-jobs';
import {publicDemo} from '@/lib/public-demo';
export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){try{
 if(!publicDemo())throw new ProofJobError(403,'공개 합성 시연 작업만 지원합니다.');
 const text=await req.text();if(text.length>50000)throw new ProofJobError(413,'요청이 너무 큽니다.');const body=JSON.parse(text),u=await authenticateProofWorker(req,body);
 if(u.role==='verifier'){
  if(body.action==='task'){const b=z.object({action:z.literal('task'),id:z.string().uuid()}).strict().parse(body);return reply(await verificationTask(b.id));}
  const b=z.object({action:z.literal('verify'),envelope:z.unknown()}).strict().parse(body);return reply(await completeProofVerification(b.envelope));
 }
 if(body.action==='claim'){const b=z.object({action:z.literal('claim'),id:z.string().uuid().optional()}).strict().parse(body);return reply(await claimProofJob(u.worker,b.id));}
 return reply(await proofWorkerCommand(u.worker,body));
 }catch(e){return reply({error:e instanceof ProofJobError?e.message:e instanceof z.ZodError?'작업 입력 형식이 다릅니다.':'작업의 현재 상태를 확인하지 못했습니다.'},e instanceof ProofJobError?e.status:e instanceof z.ZodError?400:503);}}
