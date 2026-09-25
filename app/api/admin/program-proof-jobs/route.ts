import {z} from 'zod';
import {serviceAdmin} from '@/lib/service-admin';
import {publicDemo,requestOrigin} from '@/lib/public-demo';
import {ProgramError} from '@/lib/program-service';
import {programFailure} from '@/lib/program-http';
import {readBoundedBody} from '@/lib/program-documents';
import {listProgramJobs,publicProgramJob,refreshProgramJob,controlProgramJob} from '@/lib/program-proof-jobs';
export const dynamic='force-dynamic';
const reply=(v:unknown)=>Response.json(v,{headers:{'Cache-Control':'no-store'}});
export async function GET(){try{if(!publicDemo()||!await serviceAdmin())throw new ProgramError('서비스 관리자 인증이 필요합니다.',403);return reply({jobs:await Promise.all((await listProgramJobs()).map(async j=>publicProgramJob(await refreshProgramJob(j))))});}catch(e){return programFailure(e);}}
export async function POST(req:Request){try{const u=await serviceAdmin();if(!publicDemo()||!u||req.headers.get('origin')!==requestOrigin(req))throw new ProgramError('관리자 인증과 요청 출처를 확인하세요.',403);const b=z.object({action:z.enum(['approve','cancel','resume']),id:z.string().uuid(),revision:z.number().int().nonnegative()}).strict().parse(JSON.parse(new TextDecoder().decode(await readBoundedBody(req,2000))));return reply(publicProgramJob(await controlProgramJob(b.id,b.action,u.userId,b.revision)));}catch(e){return programFailure(e);}}
