import {z} from 'zod';
import {context,check,prepareScenarioForActor,applicationSummary,programFailure} from '@/lib/program-http';
import {automaticDemoOwner} from '@/lib/demo-automation';
import {programScenarios,ProgramError,consentChallenge,saveProgramApplication} from '@/lib/program-service';
import {findProgram} from '@/lib/program-catalog';
import {readBoundedBody} from '@/lib/program-documents';
import {readState,saveState} from '@/lib/store';
import {publicProgramJob,requestProgramJob} from '@/lib/program-proof-jobs';
export const dynamic='force-dynamic';

export async function POST(req:Request){try{
 const {actor}=await context(req,true);
 if(!automaticDemoOwner(actor.owner)||actor.authMode!=='demo'||actor.owner!==actor.actor||!['company','issuer','admin'].includes(actor.role))throw new ProgramError('공개 합성 데이터 자동 시연에서만 이용하세요.',403);
 const input=z.object({profileId:z.string().max(100),scenario:z.enum(programScenarios),consent:z.literal(true),scope:z.literal('synthetic-preparation-and-local-devnet-90-minutes')}).strict().parse(JSON.parse(new TextDecoder().decode(await readBoundedBody(req,3000))));
 const profile=findProgram(input.profileId);if(!profile)throw new ProgramError('대상을 선택하세요.',404);
 const companyId=await prepareScenarioForActor(actor,input.scenario),{state,version}=await readState(actor.owner),data=state.programData!;
 const precheck=await check(state,profile,companyId,actor);
 // A repeated click or a lost response reuses the same signed preparation record.
 let application=data.applications.find(a=>a.actor===actor.actor&&a.mode==='synthetic'&&a.companyId===companyId&&a.profile.id===profile.id&&a.precheck.fingerprint===precheck.fingerprint);
 if(!application){
  const consent=await consentChallenge(data,precheck,actor.actor,actor.owner);
  application=await saveProgramApplication(data,{actor:actor.actor,owner:actor.owner,profile,precheck,consent,confirmed:true});
  await saveState(actor.owner,state,version);
 }
 let job,chainError:string|undefined;
 try{job=publicProgramJob(await requestProgramJob(actor.owner,actor.actor,application.id));}
 catch(e){chainError=e instanceof ProgramError?e.message:'준비 기록은 저장되었습니다. 체인 요청 연결을 다시 확인하세요.';}
 return Response.json({companyId,precheck,application:applicationSummary(application),job,chainError},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return programFailure(e);}}
