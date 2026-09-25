import {spawn} from 'node:child_process';
import {mkdir,open,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';

export function selectWork(response,role){
 if(!['executor','verifier'].includes(role)||response?.network!=='undeployed'||!Array.isArray(response.jobs)||response.jobs.length>20)throw Error('Unsupported worker response');
 const seen=new Set();
 return response.jobs.map(job=>{
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(job.id)||!['proof','revoke'].includes(job.kind)||seen.has(job.id))throw Error('Invalid or duplicate work');
  seen.add(job.id);return {id:job.id,kind:job.kind};
 });
}

export async function lockWorker(directory,role){
 await mkdir(directory,{recursive:true,mode:0o700});
 const file=resolve(directory,role+'.lock'),handle=await open(file,'wx',0o600);
 await handle.writeFile(JSON.stringify({pid:process.pid,createdAt:new Date().toISOString()}));
 return async()=>{await handle.close();await unlink(file);};
}

export async function processWork({api,role,run,ready,cooldowns=new Map(),now=Date.now}){
 const work=selectWork(await api({action:'work'}),role);
 let processed=0;
 for(const job of work){
  if((cooldowns.get(job.id)??0)>now())continue;
  if(!await ready())return {discovered:work.length,processed,waitingForNetwork:true};
  const ok=await run(job);
  // Execution failures require server-side operator reconciliation. Verification reads may retry.
  if(!ok)cooldowns.set(job.id,now()+(role==='verifier'?60000:300000));
  else cooldowns.delete(job.id);
  processed++;
 }
 return {discovered:work.length,processed,waitingForNetwork:false};
}

export function childTask(script,id,directory,{signal,timeoutMs=20*60*1000}={}){
 return new Promise(resolveResult=>{
  const child=spawn(process.execPath,[script,id,directory],{stdio:'ignore',windowsHide:true,signal,env:process.env});
  // Stop the child on timeout; its journal and lease remain for explicit reconciliation.
  let killTimer;
  const timer=setTimeout(()=>{child.kill('SIGTERM');killTimer=setTimeout(()=>child.kill('SIGKILL'),5000);},timeoutMs);
  child.once('error',()=>{if(!child.pid){clearTimeout(timer);resolveResult(false);}else{killTimer=setTimeout(()=>child.kill('SIGKILL'),5000);}});
  child.once('exit',code=>{clearTimeout(timer);clearTimeout(killTimer);resolveResult(code===0);});
 });
}
