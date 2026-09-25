// Read-only independent verifier. No wallet or executor signing material.
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createPrivateKey,sign} from 'node:crypto';
import {z} from 'zod';
import {verifyContractState} from '@midnight-ntwrk/midnight-js-contracts';
import {ContractCall,ContractDeploy,entryPointHash} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {publicProvider,zkConfigProvider} from './program-public-state.ts';
import {ledger} from '../managed-program/contract/index.js';
import {bytes32,circuits} from './config.ts';
import {sourceCanonical} from './web-source.ts';
import {sourceHash} from './issued-source.ts';
import {programTaskSchema,programVerificationSchema} from './program-execution.ts';
import {proofWorkerApi,readWorkerConfig} from './proof-worker-api.ts';
const config=await readWorkerConfig('verifier'),baseApi=proofWorkerApi(config,'verifier'),api=(body:Record<string,unknown>)=>baseApi({...body,family:'program'}),id=z.string().uuid().parse(process.argv[2]);
const timer=setTimeout(()=>{console.error('Program indexer verification timed out');process.exit(1);},90000);
try{
 const task=programTaskSchema.parse(await api({action:'task',id})),b=task.binding,provider=publicProvider('undeployed');
 if(task.jobId!==id||b.jobId!==id||new Set(task.receipts.map(r=>r.txId)).size!==task.receipts.length||task.receipts.some(r=>r.contractAddress!==b.contractAddress))throw Error('Wrong or duplicate receipt linkage');
 for(const operation of ['deploy','registerIssuer','advanceTime','createRequest','submit'])if(task.receipts.filter(r=>r.operation===operation).length!==1)throw Error('Missing or duplicate operation');
 if(task.receipts.length!==5)throw Error('Unexpected operation receipts');
 const keys=await Promise.all(circuits.map(async c=>[c,await zkConfigProvider.getVerifierKey(c)] as const)),state=await provider.queryContractState(b.contractAddress);if(!state)throw Error('Program contract absent');verifyContractState(keys.map(([c,k])=>[c,k]),state);
 for(const expected of task.receipts){
  const tx=await provider.watchForTxData(expected.txId);for(const field of ['status','txHash','blockHash','blockHeight','blockTimestamp'] as const)if(tx[field]!==expected[field])throw Error('Finalized receipt mismatch');
  if(expected.operation==='submit'&&(tx.blockTimestamp>=b.deadline*1000||tx.blockTimestamp<(b.issuedAt-10)*1000))throw Error('Submission is outside execution consent');
  const actions=[...(tx.tx.intents?.values()??[])].flatMap(i=>i.actions);
  if(!actions.some(a=>expected.operation==='deploy'?a instanceof ContractDeploy&&a.address===b.contractAddress:a instanceof ContractCall&&a.address===b.contractAddress&&entryPointHash(a.entryPoint)===entryPointHash(expected.operation)))throw Error('Transaction does not execute the declared contract operation');
  const historical=await provider.queryContractState(b.contractAddress,{type:'blockHeight',blockHeight:tx.blockHeight});if(!historical)throw Error('Contract absent at receipt block');verifyContractState(keys.map(([c,k])=>[c,k]),historical);
 }
 const view=ledger(state.data),key=bytes32(b.requestId);if(view.revoked.member(bytes32(b.claims.credentialId))||view.suspendedIssuers.member(1n)||view.cancelled.member(key)||!view.requests.member(key)||!view.results.member(key))throw Error('Credential or request unavailable');
 const request=view.requests.lookup(key);
 for(const [field,expected] of Object.entries({holder:b.holder,audience:b.audience,nonce:b.nonce,companyCommitment:b.claims.companyCommitment,profileDigest:b.profileHash}))if(Buffer.from(request[field as 'holder']).toString('hex')!==expected)throw Error('Chain request binding mismatch');
 if(request.deadline!==BigInt(b.deadline))throw Error('Consent deadline mismatch');
 for(const [field,expected] of Object.entries(b.policy)){const actual=request.policy[field as keyof typeof request.policy];if(actual!==(typeof expected==='boolean'?expected:BigInt(expected)))throw Error('Policy mismatch');}
 const c=b.claims,p=b.policy,eligible=(!p.requireFinance||(c.fiscalYear===p.fiscalYear&&c.revenue>=p.minRevenue)||c.investment>=p.minInvestment)&&c.plannedResidents>=p.minResidents&&c.foundedDay>=p.minFoundedDay&&c.foundedDay<=p.maxFoundedDay;
 if(eligible!==b.eligible||view.results.lookup(key)!==eligible)throw Error('Original numeric result differs from chain result');
 const body=programVerificationSchema.parse({context:'bizproof:program-verification:2',jobId:id,challenge:task.challenge,taskDigest:await sourceHash(task),contractAddress:b.contractAddress,requestId:b.requestId,sourceDigest:b.sourceDigest,network:'undeployed',eligible,fullEligibility:false,contractCodeVerified:true,receiptsVerified:task.receipts.length,checkedAt:new Date().toISOString()});
 const envelope={body,signature:sign(null,Buffer.from(sourceCanonical(body)),createPrivateKey({key:config.key,format:'jwk'})).toString('base64')};await api({action:'verify',envelope});
 const directory=resolve(process.argv[3],id);await mkdir(directory,{recursive:true});await writeFile(resolve(directory,'program-verification.json'),JSON.stringify(body,null,2));console.log(JSON.stringify(body));
}finally{clearTimeout(timer);}
