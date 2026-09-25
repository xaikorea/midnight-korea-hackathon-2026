// One presenter-approved synthetic job, no visitor cookies or issuer Ed25519 private key.
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import {httpClientProofProvider} from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import {createDevnetWallet} from './devnet-wallet.ts';
import {ProgramClient} from './program-client.ts';
import {ProgramIssuerVault} from './program-issuer.ts';
import {bytes32} from './config.ts';
import {zkConfigProvider,publicProvider,publicReceipt} from './program-public-state.ts';
import {ContractCall,ContractDeploy,entryPointHash} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {verifyProgramExecution} from './program-execution.ts';
import {jobReceiptSchema,type JobReceipt,type JobEvent} from './proof-job-protocol.ts';
import {proofWorkerApi,readWorkerConfig} from './proof-worker-api.ts';

const config=await readWorkerConfig('executor'),baseApi=proofWorkerApi(config,'executor'),api=<T=unknown>(body:Record<string,unknown>)=>baseApi<T>({...body,family:'program'}),id=z.string().uuid().parse(process.argv[2]);
const root=resolve(process.argv[3]??'outputs/issued-proof-worker',id);await mkdir(root,{recursive:true,mode:0o700});
const file=resolve(root,'private-journal.json');
type Journal={password:string;contractAddress?:string;holder?:string;pending?:string;sentTxId?:string;completed:Record<string,JobReceipt>;issuerReady?:boolean;abandoned?:{operation:string;txId?:string;at:string}[]};
let journal:Journal;try{journal=JSON.parse(await readFile(file,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;journal={password:randomBytes(48).toString('base64url'),completed:{}};}
const persist=async()=>{await writeFile(file+'.tmp',JSON.stringify(journal),{mode:0o600});await rename(file+'.tmp',file);};await persist();
const claim=z.object({id:z.string().uuid(),lease:z.string().uuid(),sourceDigest:z.string(),target:z.object({contractAddress:z.string(),holder:z.string()}).optional()}).nullable().parse(await api({action:'claim',id}));
if(!claim)throw Error('No approved available job. Expired/uncertain executions require operator reconciliation, not automatic resubmission.');
const command=<T=unknown>(body:Record<string,unknown>)=>api<T>({...body,id,lease:claim.lease});
let leaseFailed=false;const timer=setInterval(()=>{void command<{active:boolean}>({action:'heartbeat'}).then(r=>{if(!r.active)leaseFailed=true;}).catch(()=>{leaseFailed=true;});},30000);
const event=async(stage:JobEvent['stage'],status:JobEvent['status'],txId?:string)=>{console.log(JSON.stringify({at:new Date().toISOString(),jobId:id,stage,status,...(txId?{txId}:{})}));await command({action:'event',event:{stage,status,...(txId?{txId}:{})}});};
let wallet:Awaited<ReturnType<typeof createDevnetWallet>>|undefined,admin:ProgramClient|undefined,holder:ProgramClient|undefined,issuer:ProgramIssuerVault|undefined;
async function execute(label:string,call:()=>Promise<unknown>){
 if(leaseFailed)throw Error('Lease lost');
 const previous=journal.completed[label];if(previous){await command({action:'receipt',receipt:previous});return previous;}
 if(journal.pending)throw Error('Uncertain previous operation '+journal.pending+'; inspect its transaction before any retry.');
 journal.pending=label;delete journal.sentTxId;await persist();
 const receipt=jobReceiptSchema.parse(await call());journal.completed[label]=receipt;delete journal.pending;delete journal.sentTxId;await persist();await command({action:'receipt',receipt});return receipt;
}
try{
 if(journal.pending){
  if(!journal.sentTxId)throw Error('Saved uncertain operation has no transaction ID; operator reconciliation is required. No automatic resubmission.');
  const pending=journal.pending,operation=pending==='revoke'?'revokeCredential':pending==='time'?'advanceTime':pending==='create'?'createRequest':pending==='submit'?'submit':pending;
  const provider=publicProvider('undeployed'),tx=await provider.watchForTxData(journal.sentTxId),actions=[...(tx.tx.intents?.values()??[])].flatMap(i=>i.actions),action=actions.find(a=>operation==='deploy'?a instanceof ContractDeploy:a instanceof ContractCall&&a.address===journal.contractAddress&&entryPointHash(a.entryPoint)===entryPointHash(operation));
  if(!action)throw Error('Saved transaction is unrelated to the interrupted operation');
  journal.completed[pending]=jobReceiptSchema.parse(publicReceipt('undeployed',action.address,operation,tx));delete journal.pending;delete journal.sentTxId;await persist();await event('recovered','complete');
 }
 if(!journal.contractAddress&&journal.completed.deploy){journal.contractAddress=journal.completed.deploy.contractAddress;await persist();}
 wallet=await createDevnetWallet(()=>{console.log(JSON.stringify({jobId:id,stage:'wallet-sync'}));});await event('wallet','complete');
 const base=wallet.binding.provider,proof=httpClientProofProvider('http://127.0.0.1:6300',zkConfigProvider,{timeout:300000});let beforeSubmission:(()=>Promise<unknown>)|undefined;
 const observed={...wallet.binding,provider:{...base,async balanceTx(...args:Parameters<typeof base.balanceTx>){await event('balance','running');return base.balanceTx(...args);},async submitTx(...args:Parameters<typeof base.submitTx>){if(leaseFailed)throw Error('Lease lost before submission');await beforeSubmission?.();await event('submission','running');const txId=await base.submitTx(...args);journal.sentTxId=txId;await persist();await event('submission','sent',txId);return txId;}},proofProvider:{async proveTx(...args:Parameters<typeof proof.proveTx>){await event('proof','running');const value=await proof.proveTx(...args);await event('proof','complete');return value;}}};
 const options={network:'undeployed' as const,wallet:observed,storageDirectory:resolve(root,'private'),passwordProvider:()=>journal.password};
 admin=new ProgramClient({...options,role:'administrator'});holder=new ProgramClient({...options,role:'holder'});
 if(journal.contractAddress)await admin.join(journal.contractAddress);
 else {if(claim.target)throw Error('Server has a contract but the matching local private journal is missing.');await event('deploy','running');const deployed=await execute('deploy',()=>admin!.deploy());journal.contractAddress=deployed.contractAddress;await persist();await event('deploy','complete');}
 const address=journal.contractAddress!,enrollment=await holder.enrollHolder(address);journal.holder=enrollment.holder;await persist();
 await command({action:'bind',target:{contractAddress:address,holder:enrollment.holder}});
 for(const receipt of Object.values(journal.completed))await command({action:'receipt',receipt});
 const fresh=async()=>{if(leaseFailed)throw Error('Lease lost');const raw=await command({action:'source'});return verifyProgramExecution(raw,config.pins.platform.publicKey,{jobId:id,sourceDigest:claim.sourceDigest,contractAddress:address,holder:enrollment.holder});};
 const b=await fresh();await event('source','complete');beforeSubmission=fresh;
 issuer=new ProgramIssuerVault({...options,accountId:wallet.binding.accountId},address);
 if(!journal.issuerReady){await issuer.create(1n);journal.issuerReady=true;await persist();}
 const publicKey=await issuer.publicKey(1n);
 await execute('registerIssuer',()=>admin!.registerIssuer(1n,publicKey));
 const c=b.claims,attestation=await issuer.issue(1n,{revenue:BigInt(c.revenue),fiscalYear:BigInt(c.fiscalYear),investment:BigInt(c.investment),plannedResidents:BigInt(c.plannedResidents),foundedDay:BigInt(c.foundedDay),companyCommitment:bytes32(c.companyCommitment),bundleDigest:bytes32(c.bundleDigest),credentialId:bytes32(c.credentialId),issuedAt:BigInt(c.issuedAt),expiresAt:BigInt(c.expiresAt)},bytes32(b.holder));
 await holder.storeAttestation(attestation.claims,attestation.signature);await event('attestation','complete');
 await fresh();await execute('time',()=>admin!.advanceTime());
 const p=b.policy;
 await execute('create',()=>admin!.createRequest(bytes32(b.requestId),{holder:bytes32(b.holder),audience:bytes32(b.audience),nonce:bytes32(b.nonce),companyCommitment:bytes32(c.companyCommitment),profileDigest:bytes32(b.profileHash),deadline:BigInt(b.deadline),policy:{issuerId:1n,minRevenue:BigInt(p.minRevenue),minInvestment:BigInt(p.minInvestment),fiscalYear:BigInt(p.fiscalYear),requireFinance:p.requireFinance,minResidents:BigInt(p.minResidents),minFoundedDay:BigInt(p.minFoundedDay),maxFoundedDay:BigInt(p.maxFoundedDay)}}));await event('create','complete');
 await fresh();await execute('submit',()=>holder!.submit(bytes32(b.requestId)));await fresh();await event('submit','complete');await command({action:'submitted'});
 await writeFile(resolve(root,'execution-receipts.json'),JSON.stringify({jobId:id,network:'undeployed',contractAddress:address,sourceDigest:claim.sourceDigest,receipts:Object.values(journal.completed)},null,2));
 console.log('Execution recorded. A separate read-only verifier must confirm the exact job.');
}catch(e){await event('failed','uncertain').catch(()=>{});await command({action:'failed'}).catch(()=>{});console.error(e instanceof Error?e.message:'Execution failed');process.exitCode=1;}
finally{clearInterval(timer);await issuer?.close();await holder?.close();await admin?.close();await wallet?.close();}
