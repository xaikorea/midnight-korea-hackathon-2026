// Two separately configured processes; never combines executor and verifier credentials.
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {readWorkerConfig,proofWorkerApi} from './proof-worker-api.ts';
import {lockWorker,processWork,childTask} from './worker-loop.mjs';

const [role,mode='--once']=process.argv.slice(2);
if(!['executor','verifier'].includes(role)||!['--once','--watch'].includes(mode))throw Error('Usage: worker-service.mjs executor|verifier [--once|--watch]');
const directory=process.env.BIZPROOF_PROOF_STATE_DIR;
if(!directory)throw Error('BIZPROOF_PROOF_STATE_DIR must point to the original private job directory');
const config=await readWorkerConfig(role),api=proofWorkerApi(config,role),state=resolve(directory),unlock=await lockWorker(state,role);
const stop=new AbortController(),cooldowns=new Map();
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>stop.abort());
const script=fileURLToPath(new URL(role==='executor'?'./run-issued-job.ts':'./verify-issued-job.ts',import.meta.url));
async function ready(){
 try{
  const response=await fetch('http://127.0.0.1:8088/api/v4/graphql',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'{ __typename }'}),signal:AbortSignal.timeout(5000)});
  const body=await response.json();if(!response.ok||!body.data?.__typename||body.errors)return false;
  if(role==='executor'){const proof=await fetch('http://127.0.0.1:6300/version',{signal:AbortSignal.timeout(5000)});await proof.body?.cancel();if(!proof.ok)return false;}
  return !stop.signal.aborted;
 }catch{return false;}
}
try{
 do{
  try{
   const result=await processWork({api,role,cooldowns,ready,run:async job=>{
    console.log(JSON.stringify({role,jobId:job.id,kind:job.kind,event:'started',at:new Date().toISOString()}));
    const selected=job.family==='program'?fileURLToPath(new URL(role==='executor'?'./run-program-job.ts':'./verify-program-job.ts',import.meta.url)):script;
    const ok=await childTask(selected,job.id,state,{signal:stop.signal});
    console.log(JSON.stringify({role,jobId:job.id,event:ok?'finished':'needs-review',at:new Date().toISOString()}));return ok;
   }});
   console.log(JSON.stringify({role,at:new Date().toISOString(),...result}));
  }catch{console.error(JSON.stringify({role,event:'poll-failed',at:new Date().toISOString()}));if(mode==='--once')process.exitCode=1;}
  if(mode==='--once'||stop.signal.aborted)break;
  await delay(15000,undefined,{signal:stop.signal}).catch(()=>{});
 }while(!stop.signal.aborted);
}finally{await unlock();}
