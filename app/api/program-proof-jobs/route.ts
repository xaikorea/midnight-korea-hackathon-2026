import {z} from 'zod';
import {context,getApplication,programFailure} from '@/lib/program-http';
import {publicDemo} from '@/lib/public-demo';
import {ProgramError} from '@/lib/program-service';
import {readBoundedBody} from '@/lib/program-documents';
import {listProgramJobs,publicProgramJob,refreshProgramJob,requestProgramJob,controlProgramJob} from '@/lib/program-proof-jobs';
export const dynamic='force-dynamic';
const reply=(v:unknown)=>Response.json(v,{headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){try{const {actor}=await context(req);if(!publicDemo()||actor.authMode!=='demo')throw new ProgramError('공개 합성 체험에서 이용하세요.',403);return reply({jobs:await Promise.all((await listProgramJobs(actor.owner)).filter(j=>j.actor===actor.actor).map(async j=>publicProgramJob(await refreshProgramJob(j))))});}catch(e){return programFailure(e);}}
export async function POST(req:Request){try{const b=z.discriminatedUnion('action',[z.object({action:z.literal('request'),applicationId:z.string().uuid(),consent:z.literal(true),scope:z.literal('synthetic-source-processing-and-local-devnet-90-minutes')}).strict(),z.object({action:z.literal('cancel'),id:z.string().uuid(),revision:z.number().int().nonnegative()}).strict()]).parse(JSON.parse(new TextDecoder().decode(await readBoundedBody(req,3000))));
 const {actor}=await context(req,true);if(!publicDemo()||actor.authMode!=='demo'||!['company','issuer','admin'].includes(actor.role))throw new ProgramError('합성 신청 당사자만 실행을 요청할 수 있습니다.',403);
 if(b.action==='cancel')return reply(publicProgramJob(await controlProgramJob(b.id,'cancel',actor.actor,b.revision,actor.owner)));
 const {application}=await getApplication(req,b.applicationId);if(application.actor!==actor.actor)throw new ProgramError('신청 당사자의 동의가 필요합니다.',403);
 return reply(publicProgramJob(await requestProgramJob(actor.owner,actor.actor,b.applicationId)));
 }catch(e){return programFailure(e);}}
