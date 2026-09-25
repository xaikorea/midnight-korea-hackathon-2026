import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {selectWork,processWork,lockWorker,childTask} from '../contracts/sdk/worker-loop.mjs';
const id='e75cfcb5-92ec-4113-b4f2-f1b356599d5b';
const response={network:'undeployed',jobs:[{id,kind:'proof'}]};

test('unsupported networks, duplicate IDs and command injection are rejected',()=>{
 assert.throws(()=>selectWork({...response,network:'preprod'},'executor'));
 assert.throws(()=>selectWork({...response,jobs:[...response.jobs,...response.jobs]},'executor'));
 assert.throws(()=>selectWork({...response,jobs:[{id:'../other; command',kind:'proof'}]},'executor'));
});
test('unavailable network never starts a child or claims work',async()=>{
 let started=0;const calls=[];
 const result=await processWork({api:async body=>{calls.push(body);return response;},role:'executor',ready:async()=>false,run:async()=>{started++;return true;}});
 assert.equal(started,0);assert.equal(result.waitingForNetwork,true);assert.deepEqual(calls,[{action:'work'}]);
});
test('work is sequential and failures are cooled down without blind immediate retry',async()=>{
 const cooldowns=new Map();let count=0;
 const options={api:async()=>response,role:'executor',ready:async()=>true,run:async()=>{count++;return false;},cooldowns,now:()=>1000};
 await processWork(options);await processWork(options);assert.equal(count,1);
});
test('role locks prevent two loops using the same local state',async()=>{
 const root=await mkdtemp(resolve('outputs/worker-lock-'));
 try{const release=await lockWorker(root,'executor');try{await assert.rejects(lockWorker(root,'executor'),{code:'EEXIST'});const verifier=await lockWorker(root,'verifier');await verifier();}finally{await release();}}
 finally{await rm(root,{recursive:true});}
});
test('failed child returns false without emitting private child output',async()=>{
 assert.equal(await childTask('nonexistent-worker-fixture.mjs',id,'outputs'),false);
});

test('Linux kernel lock releases after a worker crash; stale marker cannot deadlock reboot',{skip:process.platform!=='linux'},async()=>{
 const root=await mkdtemp(resolve('outputs/worker-crash-'));
 const script=`import {lockWorker} from './contracts/sdk/worker-loop.mjs'; await lockWorker(process.argv[1],'executor'); console.log('READY'); setInterval(()=>{},1000);`;
 const child=spawn(process.execPath,['--input-type=module','-e',script,root],{stdio:['ignore','pipe','pipe']});
 try{
  await once(child.stdout,'data');await assert.rejects(lockWorker(root,'executor'),{code:'EEXIST'});
  child.kill('SIGKILL');await once(child,'exit');
  let release;for(let i=0;i<20;i++){try{release=await lockWorker(root,'executor');break;}catch(e){if(e.code!=='EEXIST')throw e;await new Promise(r=>setTimeout(r,50));}}
  assert.ok(release);await release();
 }finally{child.kill();await rm(root,{recursive:true});}
});
