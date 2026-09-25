import {spawn} from 'node:child_process';
import {mkdir,open,unlink,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export function selectWork(response,role){
 if(!['executor','verifier'].includes(role)||response?.network!=='undeployed'||!Array.isArray(response.jobs)||response.jobs.length>20)throw Error('Unsupported worker response');
 const seen=new Set();
 return response.jobs.map(job=>{
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(job.id)||!['proof','revoke'].includes(job.kind)||seen.has(job.id))throw Error('Invalid or duplicate work');
  if(job.family!==undefined&&job.family!=='program')throw Error('Unsupported work family');
  if(job.family==='program'&&job.kind!=='proof')throw Error('Unsupported program action');
  seen.add(job.id);return {id:job.id,kind:job.kind,...(job.family?{family:job.family}:{})};
 });
}

export async function lockWorker(directory,role){
 await mkdir(directory,{recursive:true,mode:0o700});
 if(process.platform==='linux'){
  // Kernel flock survives PID namespaces and is released when stdin closes on
  // parent exit/crash. A stale diagnostic .lock must never prevent reboot recovery.
  const file=resolve(directory,role+'.lock');
  const guard=spawn('flock',['-E','73','-n',resolve(directory,role+'.flock'),'sh','-c','printf READY; cat >/dev/null'],{stdio:['pipe','pipe','ignore']});
  const closed=new Promise(resolveClose=>guard.once('close',resolveClose));
  await new Promise((ok,fail)=>{
   guard.once('error',fail);
   guard.once('exit',code=>fail(Object.assign(Error(code===73?'Worker already running':'Worker file lock failed'),{code:code===73?'EEXIST':'ELOCK'})));
   guard.stdout.once('data',chunk=>chunk.toString()==='READY'?ok():fail(Error('Worker lock protocol failed')));
  }).catch(error=>{guard.stdin.destroy();throw error;});
  let releasing=false;
  guard.once('close',()=>{if(!releasing)process.kill(process.pid,'SIGTERM');});
  try{await writeFile(file,JSON.stringify({pid:process.pid,createdAt:new Date().toISOString(),kind:'kernel-flock'}),{mode:0o600});}catch(error){releasing=true;guard.stdin.end();await closed;throw error;}
  return async()=>{releasing=true;try{await unlink(file);}finally{guard.stdin.end();await closed;}};
 }
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
