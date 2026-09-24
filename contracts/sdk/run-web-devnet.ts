// Executes existing signed BizProof web credentials on a real isolated Local Devnet.
// Only synthetic public-demo workspaces are accepted. No operator/customer credentials.
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import {httpClientProofProvider} from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import {createDevnetWallet} from './devnet-wallet.ts';
import {BizProofClient} from './client.ts';
import {IssuerVault} from './issuer.ts';
import {runWebCredentialReuse} from './web-reuse.ts';
import {sourceEnvelopeSchema} from './web-source.ts';
import {bytes32} from './config.ts';
import {artifactManifest,zkConfigProvider} from './public-state.ts';

const origin=new URL(process.env.BIZPROOF_WEB_ORIGIN??'http://127.0.0.1:3100').origin;
if(!['127.0.0.1','localhost','bizproof.xaikorea.ai.kr'].includes(new URL(origin).hostname))throw Error('Use the local demo or the official BizProof synthetic public demo');
const out=resolve(process.argv[2]??'outputs/midnight-web-devnet');await mkdir(out,{recursive:true});
const startedAt=new Date().toISOString(),events:Record<string,unknown>[]=[],receipts:unknown[]=[];
let operation='prepare';let cookie='';let persistence=Promise.resolve();
const event=(stage:string,status:string,detail?:Record<string,unknown>)=>{
 const entry={at:new Date().toISOString(),operation,stage,status,...detail};events.push(entry);console.log(JSON.stringify(entry));
 persistence=persistence.then(()=>writeFile(resolve(out,'events.json.tmp'),JSON.stringify(events,null,2))).then(()=>rename(resolve(out,'events.json.tmp'),resolve(out,'events.json')));
};
const api=async(body?:Record<string,unknown>)=>{const r=await fetch(origin+'/api/platform',{method:body?'POST':'GET',redirect:'error',headers:{origin,cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('BizProof API '+r.status+' ('+(body?.action??'read')+')');return r.json();};
const stateSchema=z.object({publicDemo:z.literal(true),preparedDemo:z.object({credentialId:z.string(),companyId:z.string(),policyIds:z.array(z.string()).length(2)}),credentials:z.array(z.object({id:z.string(),issuerId:z.string(),source:z.object({kind:z.literal('synthetic')})})),issuers:z.array(z.object({id:z.string(),publicKey:z.object({kty:z.literal('OKP'),crv:z.literal('Ed25519'),x:z.string()})})),requests:z.array(z.object({id:z.string(),policyId:z.string(),policyHash:z.string(),status:z.string(),policy:z.object({kind:z.enum(['buyer','grant']),audience:z.string()})})),presentations:z.array(z.object({id:z.string(),requestId:z.string(),credentialId:z.string(),eligible:z.boolean(),verifiedAt:z.string().optional()}))});
let wallet:Awaited<ReturnType<typeof createDevnetWallet>>|undefined,admin:BizProofClient|undefined,holder:BizProofClient|undefined,issuer:IssuerVault|undefined;
try{
 wallet=await createDevnetWallet(stage=>event(stage,'running'));
 const base=wallet.binding.provider,proof=httpClientProofProvider('http://127.0.0.1:6300',zkConfigProvider,{timeout:300000});
 const observed={...wallet.binding,provider:{...base,async balanceTx(...args:Parameters<typeof base.balanceTx>){event('balance','running');const value=await base.balanceTx(...args);event('balance','complete');return value;},async submitTx(...args:Parameters<typeof base.submitTx>){event('submission','running');const id=await base.submitTx(...args);event('submission','sent',{txId:id});return id;}},proofProvider:{async proveTx(...args:Parameters<typeof proof.proveTx>){event('proof','running');try{const result=await proof.proveTx(...args);event('proof','complete');return result;}catch(e){event('proof','failed');throw e;}}}};
 const password=randomBytes(48).toString('base64url'),options={network:'undeployed' as const,wallet:observed,storageDirectory:resolve(out,'private'),passwordProvider:()=>password};
 admin=new BizProofClient({...options,role:'administrator'});holder=new BizProofClient({...options,role:'holder'});
 const monitor=(client:BizProofClient)=>client.watchTransactions(s=>{if(s.status==='pending'){operation=s.operation;event('transaction','pending');}if(s.status==='unconfirmed')event('transaction','unconfirmed');});monitor(admin);monitor(holder);
 const record=async(receipt:unknown)=>{receipts.push(receipt);event('transaction','finalized');await writeFile(resolve(out,'receipts.json'),JSON.stringify(receipts,null,2));};
 const deployed=await admin.deploy();await record(deployed);const address=deployed.contractAddress;
 issuer=new IssuerVault({...options,accountId:wallet.binding.accountId},address);const created=await issuer.create(1n);await record(await admin.registerIssuer(1n,created.publicKey));
 const enrollment=await holder.enrollHolder(address);
 // Claim a new isolated synthetic workspace; never read or modify another visitor's space.
 const login=await fetch(origin+'/signin-with-chatgpt',{method:'POST',headers:{origin},redirect:'manual'});if(login.status!==303)throw Error('Synthetic demo session unavailable: '+login.status);
 cookie=login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');if(!cookie.includes('bizproof-demo='))throw Error('Missing synthetic session');
 const before=stateSchema.parse(await api()),prepared=before.preparedDemo,credential=before.credentials.find(c=>c.id===prepared.credentialId)!;
 const webIssuer=before.issuers.find(i=>i.id===credential.issuerId);if(!webIssuer)throw Error('Unknown web issuer');
 const selected=prepared.policyIds.map(id=>before.requests.find(r=>r.policyId===id&&r.status==='pending'));if(selected.some(r=>!r))throw Error('Expected two pending original web requests');
 const envelope=sourceEnvelopeSchema.parse(await api({action:'export-midnight-source',id:credential.id,consent:true,binding:{network:'undeployed',contractAddress:address,holder:enrollment.holder,requests:selected.map(r=>({id:r!.id}))}}));
 event('source-signature','verified',{credentialId:credential.id,sourceDigest:envelope.body.source.digest});
 const reuse=await runWebCredentialReuse({envelope,pinnedIssuerKey:webIssuer.publicKey,network:'undeployed',contractAddress:address,holderCommitment:enrollment.holder,issuerId:1n,issuer,administrator:admin,holder,
  assertCurrent:async source=>z.object({current:z.literal(true),sourceDigest:z.string()}).parse(await api({action:'check-midnight-source',envelope:source})),onReceipt:async data=>{await record(data.receipt);}});
 const outcomes=[];
 for(const request of envelope.body.requests){const inspection=await holder.inspect(request.requestId);if(!inspection.found||!inspection.request?.submitted||inspection.request.eligible!==true)throw Error('Expected verified on-chain eligibility');const original=selected.find(r=>r!.id===request.id)!;outcomes.push({scenario:request.kind,audience:original.policy.audience,webRequestId:request.id,requestId:request.requestId,policyHash:request.policyHash,credentialId:credential.id,sourceDigest:reuse.sourceDigest,inspection,receipt:reuse.receipts.find(r=>r.webRequestId===request.id)!.receipt});}
 // Complete the normal web workflow with precisely the same original requests/credential.
 const items=[];for(const policyId of prepared.policyIds){const preview=z.object({ready:z.literal(true),previewHash:z.string(),selected:z.object({id:z.string()})}).parse(await api({action:'prepare-application',companyId:prepared.companyId,policyId,credentialId:credential.id}));items.push({policyId,credentialId:credential.id,key:crypto.randomUUID(),previewHash:preview.previewHash});}
 await api({action:'submit-applications',companyId:prepared.companyId,consent:true,items});
 const after=stateSchema.parse(await api());const webResults=after.presentations.filter(p=>selected.some(r=>r!.id===p.requestId));if(webResults.length!==2||webResults.some(p=>p.credentialId!==credential.id||!p.eligible||!p.verifiedAt))throw Error('Web result linkage failed');
 event('web-results','verified',{count:2,credentialId:credential.id});
 const nonce=()=>new Uint8Array(randomBytes(32)),negative=nonce();await record(await admin.advanceTime());await record(await admin.createRequest(negative,{holder:bytes32(enrollment.holder),audience:nonce(),nonce:nonce(),deadline:BigInt(Math.floor(Date.now()/1000)+600),policy:{issuerId:1n,minRevenue:500000000n,maxRevenue:1000000000000n,minFoundedDay:0n,region:0n,requireCertification:false}}));await record(await holder.submit(negative));
 const negativeInspection=await holder.inspect(Buffer.from(negative).toString('hex'));if(!negativeInspection.found||negativeInspection.request?.eligible!==false)throw Error('Negative policy did not produce false');outcomes.push({scenario:'negative',audience:'미충족 비교',credentialId:credential.id,sourceDigest:reuse.sourceDigest,requestId:Buffer.from(negative).toString('hex'),inspection:negativeInspection,receipt:receipts.at(-1)});
 const revokeRequest=nonce();await record(await admin.createRequest(revokeRequest,{holder:bytes32(enrollment.holder),audience:nonce(),nonce:nonce(),deadline:BigInt(Math.floor(Date.now()/1000)+600),policy:{issuerId:1n,minRevenue:0n,maxRevenue:1000000000000n,minFoundedDay:0n,region:0n,requireCertification:false}}));await record(await admin.revokeCredential(bytes32(reuse.sourceDigest)));
 let blocked=false;try{await holder.submit(revokeRequest);}catch(e){for(let error:unknown=e,depth=0;depth<8&&error instanceof Error;depth++,error=error.cause){if(error.message.includes('Credential revoked'))blocked=true;}if(!blocked)throw e;}if(!blocked)throw Error('Revoked credential was accepted');event('revocation','blocked');
 const report={format:'bizproof-web-devnet-evidence-v1',startedAt,completedAt:new Date().toISOString(),network:'undeployed',environment:'Local Devnet',contractAddress:address,source:{origin,credentialId:credential.id,digest:reuse.sourceDigest,issuerPublicKey:webIssuer.publicKey},outcomes,webResults,receipts,events,revokedSubmissionBlocked:true,revocationBlockStage:'SDK circuit assertion after confirmed revoke transaction',artifacts:await artifactManifest(),disclosure:'Actual synthetic web credential and original requests re-proven on a local chain. Web results use Ed25519; chain results use Schnorr/Compact. Original attributes are processed by the web server and this local issuer/prover. This report does not validate another visitor’s application, imply official business certification, or keep a Local Devnet online.'};
 await persistence;await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));event('scenario','complete');await persistence;
}catch(e){await persistence;await writeFile(resolve(out,'failure.json'),JSON.stringify({startedAt,failedAt:new Date().toISOString(),error:e instanceof Error?e.message:'Execution failed',events,receipts},null,2));console.error(e);process.exitCode=1;}
finally{await issuer?.close();await holder?.close();await admin?.close();await wallet?.close();if(cookie){await fetch(origin+'/signout-with-chatgpt',{headers:{cookie},redirect:'manual'}).catch(()=>{});}}
