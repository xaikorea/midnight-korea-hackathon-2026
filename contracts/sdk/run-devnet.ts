import {mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createDevnetWallet} from './devnet-wallet.ts';
import {runNetworkReuse} from './reuse-scenario.ts';
import {artifactManifest} from './public-state.ts';

const out=resolve(process.argv[2]??'outputs/midnight-devnet');
await mkdir(out,{recursive:true});
const events:unknown[]=[],receipts:unknown[]=[];
const startedAt=new Date().toISOString();
async function save(name:string,value:unknown){const file=resolve(out,name);await writeFile(file+'.tmp',JSON.stringify(value,null,2));await rename(file+'.tmp',file);}
const emit=(stage:string)=>console.log(JSON.stringify({at:new Date().toISOString(),stage}));
let wallet:Awaited<ReturnType<typeof createDevnetWallet>>|undefined;
try{
 emit('services-check');
 for(const url of ['http://127.0.0.1:6300/version','http://127.0.0.1:9944/health']){const r=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Required Local Devnet service unavailable');await r.body?.cancel();}
 wallet=await createDevnetWallet(emit);
 const password=randomBytes(48).toString('base64url');
 const result=await runNetworkReuse({network:'undeployed',administratorWallet:wallet.binding,holderWallet:wallet.binding,storageDirectory:resolve(out,'private'),passwordProvider:()=>password,
  onTransaction:(role,state)=>{if(state.status!=='idle'){events.push({role,...state});emit(role+':'+state.operation+':'+state.status);}},
  onReceipt:async receipt=>{receipts.push(receipt);await save('receipts.json',receipts);await save('events.json',events);emit('receipt:'+receipt.operation);}});
 const report={format:'bizproof-devnet-evidence-v1',startedAt,completedAt:new Date().toISOString(),network:'undeployed',environment:'Local Devnet',...result,receipts,events,artifacts:await artifactManifest(),disclosure:'Synthetic standalone business scenario; local chain and public genesis fee wallet. Web submissions remain server-signed unless explicitly linked. No official enterprise certification.'};
 await save('report.json',report);emit('complete');
}catch(e){await save('failure.json',{startedAt,failedAt:new Date().toISOString(),message:e instanceof Error?e.message:'Execution failed',receipts,events});console.error(e);process.exitCode=1;}
finally{await wallet?.close();}
