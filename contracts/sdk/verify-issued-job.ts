// Separate read-only process: no wallet, issuer attestation key or executor credential.
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createPrivateKey,sign} from 'node:crypto';
import {z} from 'zod';
import {verifyContractState} from '@midnight-ntwrk/midnight-js-contracts';
import {ContractCall,ContractDeploy,entryPointHash} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {publicProvider,zkConfigProvider} from './public-state.ts';
import {ledger} from '../managed/contract/index.js';
import {bytes32,circuits} from './config.ts';
import {sourceCanonical} from './web-source.ts';
import {sourceHash} from './issued-source.ts';
import {verificationTaskSchema,jobVerificationSchema} from './proof-job-protocol.ts';
import {proofWorkerApi,readWorkerConfig} from './proof-worker-api.ts';

const config=await readWorkerConfig('verifier'),api=proofWorkerApi(config,'verifier'),id=z.string().uuid().parse(process.argv[2]);
const timer=setTimeout(()=>{console.error('Indexer unavailable or timed out. Job remains unverified.');process.exit(1);},90000);
try{
 const task=verificationTaskSchema.parse(await api({action:'task',id})),b=task.binding,provider=publicProvider('undeployed');
 if(new Set(task.receipts.map(r=>r.txId)).size!==task.receipts.length||task.receipts.some(r=>r.contractAddress!==b.contractAddress))throw Error('Duplicate or unrelated receipts');
 const keys=await Promise.all(circuits.map(async c=>[c,await zkConfigProvider.getVerifierKey(c)] as const));
 const state=await provider.queryContractState(b.contractAddress);if(!state)throw Error('Original contract unavailable');verifyContractState(keys.map(([c,k])=>[c,k]),state);
 const view=ledger(state.data),revoked=view.revoked.member(bytes32(task.sourceDigest));if(revoked!==task.revocation)throw Error('Current chain revocation differs from expected issuer status');
 for(const expected of task.receipts){
  const tx=await provider.watchForTxData(expected.txId);for(const field of ['status','txHash','blockHash','blockHeight','blockTimestamp'] as const)if(tx[field]!==expected[field])throw Error('Finalized transaction mismatch: '+field);
  const actions=[...(tx.tx.intents?.values()??[])].flatMap(intent=>intent.actions);
  const connected=actions.some(action=>expected.operation==='deploy'?action instanceof ContractDeploy&&action.address===b.contractAddress:action instanceof ContractCall&&action.address===b.contractAddress&&entryPointHash(action.entryPoint)===entryPointHash(expected.operation));
  if(!connected)throw Error('Receipt transaction does not execute the declared operation on this contract');
  const at=await provider.queryContractState(b.contractAddress,{type:'blockHeight',blockHeight:tx.blockHeight});if(!at)throw Error('Contract did not exist at receipt block');verifyContractState(keys.map(([c,k])=>[c,k]),at);
 }
 const results=[];
 if(!task.revocation){
  if(task.receipts.filter(r=>r.operation==='submit').length!==2||task.receipts.filter(r=>r.operation==='createRequest').length!==2)throw Error('Both request receipts required');
  for(const r of b.requests){const key=bytes32(r.requestId);if(!view.requests.member(key)||!view.results.member(key)||view.cancelled.member(key))throw Error('Original request absent / cancelled / unsubmitted');const actual=view.requests.lookup(key);
   if(Buffer.from(actual.holder).toString('hex')!==b.holder||Buffer.from(actual.audience).toString('hex')!==r.audience||Buffer.from(actual.nonce).toString('hex')!==r.nonce||actual.deadline!==BigInt(r.deadline)||actual.policy.issuerId!==1n)throw Error('Holder / recipient / nonce / deadline mismatch');
   for(const field of ['minRevenue','maxRevenue','minFoundedDay','region'] as const)if(actual.policy[field]!==BigInt(r.policy[field]))throw Error('Original policy differs from chain policy');
   if(actual.policy.requireCertification!==r.policy.requireCertification)throw Error('Certification policy mismatch');
   const eligible=b.claims.revenue>=r.policy.minRevenue&&b.claims.revenue<=r.policy.maxRevenue&&b.claims.foundedDay>=r.policy.minFoundedDay&&(r.policy.region===0||r.policy.region===b.claims.region)&&(!r.policy.requireCertification||b.claims.certified);
   if(view.results.lookup(key)!==eligible)throw Error('Chain result differs from source eligibility');
   results.push({id:r.id,requestId:r.requestId,policyHash:r.policyHash,eligible});
  }
 }else if(!task.receipts.some(r=>r.operation==='revokeCredential'))throw Error('Revocation receipt required');
 const body=jobVerificationSchema.parse({context:'bizproof:midnight:job-verification:v1',jobId:id,challenge:task.challenge,taskDigest:await sourceHash(task),sourceDigest:task.sourceDigest,network:'undeployed',contractAddress:b.contractAddress,checkedAt:new Date().toISOString(),contractCodeVerified:true,receiptsVerified:task.receipts.length,results,revoked});
 const envelope={body,signature:sign(null,Buffer.from(sourceCanonical(body)),createPrivateKey({key:config.key,format:'jwk'})).toString('base64')};
 await api({action:'verify',envelope});const directory=resolve(process.argv[3]??'outputs/issued-proof-worker',id);await mkdir(directory,{recursive:true});await writeFile(resolve(directory,revoked?'revocation-verification.json':'independent-verification.json'),JSON.stringify(body,null,2));console.log(JSON.stringify(body,null,2));
}finally{clearTimeout(timer);}
