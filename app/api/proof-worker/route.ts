import {z} from 'zod';
import {authenticateProofWorker} from '@/lib/proof-worker-auth';
import {availableProofWork,claimProofJob,proofWorkerCommand,verificationTask,completeProofVerification,ProofJobError} from '@/lib/proof-jobs';
import {publicDemo} from '@/lib/public-demo';
import {programWork,programWorkerCommand,programTask,completeProgramVerification} from '@/lib/program-proof-jobs';
import {ProgramError} from '@/lib/program-service';
export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){try{
 if(!publicDemo())throw new ProofJobError(403,'공개 합성 시연 작업만 지원합니다.');
 const text=await req.text();if(text.length>50000)throw new ProofJobError(413,'요청이 너무 큽니다.');const body=JSON.parse(text),u=await authenticateProofWorker(req,body);
 if(body.action==='work'){z.object({action:z.literal('work')}).strict().parse(body);const old=await availableProofWork(u.role==='verifier'?'verifier':'executor');return reply({...old,jobs:[...old.jobs.slice(0,10),...await programWork(u.role==='verifier'?'verifier':'executor')]});}
 if(body.family==='program'){
  const {family:_,...command}=body;
  if(u.role==='executor')return reply(await programWorkerCommand(u.worker,command));
  if(command.action==='task'){const c=z.object({action:z.literal('task'),id:z.string().uuid()}).strict().parse(command);return reply(await programTask(c.id));}
  const c=z.object({action:z.literal('verify'),envelope:z.unknown()}).strict().parse(command);return reply(await completeProgramVerification(c.envelope));
 }
 if(u.role==='verifier'){
  if(body.action==='task'){const b=z.object({action:z.literal('task'),id:z.string().uuid()}).strict().parse(body);return reply(await verificationTask(b.id));}
  const b=z.object({action:z.literal('verify'),envelope:z.unknown()}).strict().parse(body);return reply(await completeProofVerification(b.envelope));
 }
 if(body.action==='claim'){const b=z.object({action:z.literal('claim'),id:z.string().uuid().optional()}).strict().parse(body);return reply(await claimProofJob(u.worker,b.id));}
 return reply(await proofWorkerCommand(u.worker,body));
 }catch(e){return reply({error:e instanceof ProofJobError||e instanceof ProgramError?e.message:e instanceof z.ZodError?'작업 입력 형식이 다릅니다.':'작업의 현재 상태를 확인하지 못했습니다.'},e instanceof ProofJobError||e instanceof ProgramError?e.status:e instanceof z.ZodError?400:503);}}
