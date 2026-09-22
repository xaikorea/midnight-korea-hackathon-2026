import type {ProcessObserver} from './process-types';
import {z} from 'zod';
import type {State} from './domain';
import type {BusinessActor} from './business-access';
import {submitApplication,ApplicationError} from './application-flow';
export const batchApplicationInput=z.object({companyId:z.string().min(1).max(180),consent:z.literal(true),items:z.array(z.object({policyId:z.string().min(1).max(180),credentialId:z.string().min(1).max(180).optional(),key:z.string().uuid(),previewHash:z.string().regex(/^[a-f0-9]{64}$/)})).min(1).max(5)}).refine(v=>new Set(v.items.map(x=>x.policyId)).size===v.items.length&&new Set(v.items.map(x=>x.key)).size===v.items.length,'신청 대상과 제출 식별값은 중복될 수 없습니다.');
export type ApplicationBatchInput=z.infer<typeof batchApplicationInput>;
export type ApplicationBatchOutcome={policyId:string;ok:true;receipt:Awaited<ReturnType<typeof submitApplication>>}|{policyId:string;ok:false;error:string;status:number};
export async function submitApplications(s:State,ctx:BusinessActor,raw:unknown,observer?:(policyId:string)=>ProcessObserver,onFailure?:(policyId:string,message:string)=>Promise<void>){
 const input=batchApplicationInput.parse(raw);const outcomes:ApplicationBatchOutcome[]=[];
 for(const item of input.items){
  const candidate=structuredClone(s);
  try{const receipt=await submitApplication(candidate,ctx,{...item,companyId:input.companyId,consent:input.consent},observer?.(item.policyId));Object.assign(s,candidate);outcomes.push({policyId:item.policyId,ok:true,receipt});}
  catch(e){const status=e instanceof ApplicationError?e.status:typeof (e as {status?:unknown})?.status==='number'?(e as {status:number}).status:503;outcomes.push({policyId:item.policyId,ok:false,error:e instanceof ApplicationError||status===403? (e as Error).message:'일시적으로 처리할 수 없습니다. 해당 기관만 다시 시도해 주세요.',status});await onFailure?.(item.policyId,(outcomes.at(-1) as {error:string}).error);}
 }
 return {outcomes};
}
