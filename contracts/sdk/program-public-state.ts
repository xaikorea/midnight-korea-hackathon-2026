import {fileURLToPath} from 'node:url';
export const programAssets=fileURLToPath(new URL('../managed-program/',import.meta.url));
import {createHash} from 'node:crypto';
import {indexerPublicDataProvider} from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import {NodeZkConfigProvider} from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import {verifyContractState} from '@midnight-ntwrk/midnight-js-contracts';
import type {PublicDataProvider,FinalizedTxData} from '@midnight-ntwrk/midnight-js-types';
import {SucceedEntirely} from '@midnight-ntwrk/midnight-js-types';
import {ledger} from '../managed-program/contract/index.js';
import {address,bytes32,circuits,configuration,type Network,type Circuit,type IndexerConfiguration} from './config.ts';
export const zkConfigProvider=new NodeZkConfigProvider<Circuit>(programAssets);
export function publicProvider(network:Network,services?:IndexerConfiguration){const c=services??configuration(network);return indexerPublicDataProvider(c.indexer,c.indexerWs);}
export async function artifactManifest(){const entries=await Promise.all(circuits.map(async id=>{const [prover,verifier,ir]=await Promise.all([zkConfigProvider.getProverKey(id),zkConfigProvider.getVerifierKey(id),zkConfigProvider.getZKIR(id)]);return {circuit:id,proverBytes:prover.length,verifierBytes:verifier.length,irBytes:ir.length,verifierSha256:createHash('sha256').update(verifier).digest('hex')};}));return {sdkVersion:'4.1.1',compiler:'0.31.1',runtime:'0.16.0',circuits:entries,proofGenerated:false,networkConnected:false};}
export async function inspectContract(provider:PublicDataProvider,network:Network,contractAddress:string,requestHex?:string){
 const id=address(contractAddress);const requestId=requestHex?bytes32(requestHex):undefined;
 const state=await provider.queryContractState(id);if(!state)return {network,contractAddress:id,found:false as const,checkedAt:new Date().toISOString()};
 // Do not parse an unrelated contract as a BizProof contract just because its address exists.
 const keys=await Promise.all(circuits.map(async circuit=>[circuit,await zkConfigProvider.getVerifierKey(circuit)] as const));
 verifyContractState(keys.map(([c,k])=>[c,k]),state);const view=ledger(state.data);
 let request:undefined|{id:string;exists:boolean;cancelled:boolean;submitted:boolean;eligible:boolean|null;deadline?:string;expired:boolean};
 if(requestId){const exists=view.requests.member(requestId),submitted=view.results.member(requestId);request={id:requestHex!.toLowerCase(),exists,cancelled:view.cancelled.member(requestId),submitted,expired:exists&&view.requests.lookup(requestId).deadline<=view.trustedTime,eligible:submitted?view.results.lookup(requestId):null,...(exists?{deadline:view.requests.lookup(requestId).deadline.toString()}:{})};}
 return {network,contractAddress:id,found:true as const,contractCodeVerified:true,checkedAt:new Date().toISOString(),trustedTime:view.trustedTime.toString(),issuerCount:view.issuerKeys.size().toString(),revokedCount:view.revoked.size().toString(),requestCount:view.requests.size().toString(),resultCount:view.results.size().toString(),...(request?{request}:{}),notice:'인덱서에서 조회한 공개 상태입니다. 업무 자격과의 연결 또는 특정 proof 생성 완료를 자동으로 보장하지 않습니다.'};
}
export function publicReceipt(network:Network,contractAddress:string,operation:string,tx:FinalizedTxData){if(tx.status!==SucceedEntirely)throw Error('거래가 전체 성공으로 확정되지 않았습니다.');return {network,contractAddress:address(contractAddress),operation,txId:tx.txId,txHash:tx.txHash,blockHash:tx.blockHash,blockHeight:tx.blockHeight,blockTimestamp:tx.blockTimestamp,status:tx.status,mode:'midnight-finalized' as const};}
export function subscribeContract(provider:PublicDataProvider,network:Network,contractAddress:string,onState:(data:{network:Network;contractAddress:string;trustedTime:string;resultCount:string})=>void,onError:()=>void){
 const id=address(contractAddress);let closed=false;let queue=Promise.resolve();
 // Load keys inside the observed task so a rejected load cannot escape unhandled.
 let keys:Promise<readonly (readonly [Circuit,Awaited<ReturnType<typeof zkConfigProvider.getVerifierKey>>])[]>|undefined;
 const subscription=provider.contractStateObservable(id,{type:'latest'}).subscribe({next:state=>{
  queue=queue.then(async()=>{if(closed)return;keys??=Promise.all(circuits.map(async circuit=>[circuit,await zkConfigProvider.getVerifierKey(circuit)] as const));const expected=await keys;if(closed)return;verifyContractState(expected.map(([c,k])=>[c,k]),state);const view=ledger(state.data);if(!closed)onState({network,contractAddress:id,trustedTime:view.trustedTime.toString(),resultCount:view.results.size().toString()});}).catch(()=>{keys=undefined;if(!closed)onError();});
 },error:()=>{if(!closed){closed=true;onError();}}});
 return {unsubscribe(){closed=true;subscription.unsubscribe();},get closed(){return closed||subscription.closed;}};
}
