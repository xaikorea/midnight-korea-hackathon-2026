import {submitApplications,type ApplicationBatchInput} from './application-batch';
import {ApplicationError} from './application-flow';
import {requireBusinessAccess,type BusinessActor} from './business-access';
import type {State} from './domain';
import {policyEngineMode} from './policy-engine';
import {saveState,ConflictError} from './store';
import {createProcessRun,saveProcessRun} from './process-store';
import {safeProcessData,type ProcessRun,type ProcessObserver,type ProcessEvent} from './process-types';

/** Observation is emitted at real execution boundaries, never from a progress timer. */
export async function observedApplications(s:State,ctx:BusinessActor,input:ApplicationBatchInput,version:number){
  if(!['company','admin'].includes(ctx.role))throw new ApplicationError(403,'신청 기업 역할에서 제출하세요.');
  await requireBusinessAccess(ctx,input.companyId,true);
  const company=s.companies.find(c=>c.id===input.companyId);
  if(!company)throw new ApplicationError(404,'기업을 찾을 수 없습니다.');
  const run:ProcessRun={id:'process-'+crypto.randomUUID(),companyId:company.id,companyName:company.name,startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'running',committed:false,historySaved:true,policies:input.items.map(i=>({id:i.policyId,audience:s.policies.find(p=>p.id===i.policyId)?.audience??'확인되지 않은 기관'})),events:[],engine:{signature:'Ed25519',policy:policyEngineMode(),networkConnected:false}};
  await createProcessRun(ctx,run);
  let disconnected=false;
  const encoder=new TextEncoder(),clock=performance.now(),starts=new Map<string,number>();
  return new Response(new ReadableStream<Uint8Array>({
    async start(controller){
      const send=(value:unknown)=>{if(!disconnected){try{controller.enqueue(encoder.encode(JSON.stringify(value)+'\n'));}catch{disconnected=true;}}};
      const persist=async()=>{try{await saveProcessRun(ctx,run);}catch{run.historySaved=false;}};
      const observer=(policyId?:string):ProcessObserver=>async(stage,state,message,data={})=>{
        const now=performance.now(),key=(policyId??'batch')+':'+stage,begin=starts.get(key);
        if(state==='running')starts.set(key,now);
        const event:ProcessEvent={seq:run.events.length+1,policyId,stage,state,at:new Date().toISOString(),elapsedMs:Math.round(now-clock),...(state!=='running'&&begin!==undefined?{durationMs:Math.round(now-begin)}:{}),message:message.slice(0,400),data:safeProcessData(data)};
        if(state!=='running')starts.delete(key);
        run.events.push(event);run.updatedAt=event.at;send({type:'event',event});await persist();
      };
      send({type:'run',run});
      try{
        const batch=await submitApplications(s,ctx,input,observer,async(policyId,message)=>{
          const current=[...run.events].reverse().find(e=>e.policyId===policyId);
          await observer(policyId)(current?.stage??'access','failed',message);
        });
        const successes=batch.outcomes.filter(o=>o.ok).length;
        if(successes){
          await observer()('commit','running','성공한 기관의 결과·감사 기록을 데이터베이스에 저장합니다.');
          await saveState(ctx.owner,s,version);
          run.committed=true;
          await observer()('commit','success','데이터베이스 저장을 확인했습니다. 새로고침 후에도 접수 결과를 조회할 수 있습니다.',{savedVersion:version+1});
        }else await observer()('commit','skipped','접수 가능한 결과가 없어 업무 데이터 변경을 저장하지 않았습니다. 실패 기록은 별도로 보관합니다.');
        run.status=successes===batch.outcomes.length?'succeeded':successes?'partial':'failed';
        run.completedAt=new Date().toISOString();run.updatedAt=run.completedAt;await persist();
        send({type:'complete',run,batch});
      }catch(e){
        const message=e instanceof ConflictError?'동시에 다른 변경이 저장되어 이번 결과를 확정하지 못했습니다. 상태를 다시 확인하세요.':'서버 처리를 완료하지 못했습니다. 접수 상태를 다시 확인하세요.';
        await observer()('commit','failed',message);
        run.status='failed';run.completedAt=new Date().toISOString();run.updatedAt=run.completedAt;await persist();
        send({type:'error',run,error:message});
      }finally{if(!disconnected){try{controller.close();}catch{/* The client closed its observation window. */}}}
    },
    // Closing the observation stream must not cancel an already authorized submission.
    cancel(){disconnected=true;},
  }),{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff','Content-Encoding':'identity'}});
}
