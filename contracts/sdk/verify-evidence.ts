import {readFile,writeFile} from 'node:fs/promises';
import {z} from 'zod';
import {inspectContract,publicProvider} from './public-state.ts';
import {ledger} from '../managed/contract/index.js';
import {bytes32} from './config.ts';
const hex=z.string().regex(/^[a-f0-9]{64}$/);
const report=z.object({network:z.literal('undeployed'),contractAddress:hex,source:z.object({digest:hex}),outcomes:z.array(z.object({scenario:z.enum(['buyer','grant','negative']),requestId:hex})).length(3),receipts:z.array(z.object({contractAddress:hex,txId:z.string(),txHash:hex,blockHash:hex,blockHeight:z.number(),status:z.literal('SucceedEntirely')})).min(10)}).parse(JSON.parse(await readFile(process.argv[2]??'outputs/midnight-web-devnet/report.json','utf8')));
const provider=publicProvider('undeployed');
const timer=setTimeout(()=>{console.error('Verification timed out: the original Local Devnet and indexer must remain available.');process.exit(1);},60000);
try{
 for(const expected of report.receipts){if(expected.contractAddress!==report.contractAddress)throw Error('Report contract mismatch');const tx=await provider.watchForTxData(expected.txId);for(const key of ['status','txHash','blockHash','blockHeight'] as const){if(tx[key]!==expected[key])throw Error('Indexer transaction mismatch: '+key);}}
 for(const expected of report.outcomes){const result=await inspectContract(provider,'undeployed',report.contractAddress,expected.requestId);if(!result.found||!result.request?.submitted||result.request.eligible!==(expected.scenario!=='negative'))throw Error('Compiled contract / request outcome mismatch');}
 const state=await provider.queryContractState(report.contractAddress);if(!state||!ledger(state.data).revoked.member(bytes32(report.source.digest)))throw Error('Source credential digest is not revoked on this chain');
 const result={verifiedAt:new Date().toISOString(),network:'undeployed',contractAddress:report.contractAddress,finalizedReceipts:report.receipts.length,compiledContractKeysMatch:true,requestResults:[true,true,false],sourceRevocationConfirmed:true,notice:'Independent read-only comparison against the currently running original Local Devnet. No wallet or private state used.'};
 console.log(JSON.stringify(result,null,2));if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(result,null,2));
}finally{clearTimeout(timer);}
