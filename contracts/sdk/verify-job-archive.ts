// Re-check archived finalized receipts after a host move without reopening a job.
import {readFile,writeFile} from 'node:fs/promises';
import {z} from 'zod';
import {verifyContractState} from '@midnight-ntwrk/midnight-js-contracts';
import {ContractCall,ContractDeploy,entryPointHash} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {publicProvider,zkConfigProvider} from './public-state.ts';
import {jobReceiptSchema} from './proof-job-protocol.ts';
import {bytes32,circuits} from './config.ts';
import {ledger} from '../managed/contract/index.js';
const hex=z.string().regex(/^[a-f0-9]{64}$/);
const report=z.object({receipts:z.object({jobId:z.string().uuid(),network:z.literal('undeployed'),contractAddress:hex,sourceDigest:hex,receipts:z.array(jobReceiptSchema).min(1)})}).parse(JSON.parse(await readFile(process.argv[2],'utf8'))).receipts;
const timer=setTimeout(()=>{console.error('Original chain archive verification timed out');process.exit(1);},90000);
try{
 const provider=publicProvider('undeployed'),keys=await Promise.all(circuits.map(async c=>[c,await zkConfigProvider.getVerifierKey(c)] as const));
 if(new Set(report.receipts.map(r=>r.txId)).size!==report.receipts.length)throw Error('Duplicate receipt');
 for(const receipt of report.receipts){
  if(receipt.contractAddress!==report.contractAddress)throw Error('Unrelated contract');
  const tx=await provider.watchForTxData(receipt.txId);
  for(const k of ['status','txHash','blockHash','blockHeight','blockTimestamp'] as const)if(tx[k]!==receipt[k])throw Error('Archived transaction differs from chain');
  const actions=[...(tx.tx.intents?.values()??[])].flatMap(i=>i.actions);
  if(!actions.some(a=>receipt.operation==='deploy'?a instanceof ContractDeploy&&a.address===report.contractAddress:a instanceof ContractCall&&a.address===report.contractAddress&&entryPointHash(a.entryPoint)===entryPointHash(receipt.operation)))throw Error('Transaction operation differs');
 }
 const state=await provider.queryContractState(report.contractAddress);if(!state)throw Error('Original contract missing');
 verifyContractState(keys.map(([c,k])=>[c,k]),state);
 const revoked=ledger(state.data).revoked.member(bytes32(report.sourceDigest));
 if(report.receipts.some(r=>r.operation==='revokeCredential')&&!revoked)throw Error('Archived revocation missing');
 const result={checkedAt:new Date().toISOString(),jobId:report.jobId,network:report.network,contractAddress:report.contractAddress,receiptsVerified:report.receipts.length,compiledContractKeysMatch:true,revoked,mode:'read-only-archive-comparison',newTransactions:0};
 if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{clearTimeout(timer);}
