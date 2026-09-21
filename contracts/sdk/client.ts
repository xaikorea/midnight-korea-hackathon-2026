import {TransactionMonitor,type TransactionState} from './transaction-state.ts';
import {privateStorage} from './storage.ts';
import {randomBytes} from 'node:crypto';

import {httpClientProofProvider} from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import {deployContract,findDeployedContract,submitCallTx,type ContractProviders} from '@midnight-ntwrk/midnight-js-contracts';
import type {MidnightProvider,WalletProvider,FinalizedTxData,ProofProvider} from '@midnight-ntwrk/midnight-js-types';
import {pureCircuits,type BusinessClaims,type Request as ChainRequest,type Schnorr_SchnorrSignature} from '../managed/contract/index.js';
import {compiledContract,type BusinessContract,type PrivateState} from './contract.ts';
import {activateNetwork,address,configuration,type Network,type IndexerConfiguration} from './config.ts';
import {inspectContract,publicProvider,publicReceipt,subscribeContract,zkConfigProvider} from './public-state.ts';

export type WalletBinding={network:Network;accountId:string;provider:WalletProvider&MidnightProvider;proofProvider?:ProofProvider;indexerConfiguration?:IndexerConfiguration};
export type ClientOptions={network:Network;wallet:WalletBinding;passwordProvider:()=>string|Promise<string>;storageDirectory:string;role:'administrator'|'holder'};
// One instance owns one account/contract. Never expose this object or provider private results through an HTTP DTO.
export class BizProofClient{
 readonly providers:ContractProviders<BusinessContract>;
 readonly network:Network;readonly privateStateId:string;readonly role:ClientOptions['role'];
 private readonly subscriptions=new Set<ReturnType<typeof subscribeContract>>();private closed=false;
 private readonly transactions=new TransactionMonitor();
 watchTransactions(listener:(state:TransactionState)=>void){if(this.closed)throw Error('종료된 SDK 클라이언트입니다.');return this.transactions.subscribe(listener);}
 private contractAddress?:string;private running=false;private readonly storage;
 constructor(options:ClientOptions){
  if(options.wallet.network!==options.network||!options.wallet.accountId.trim())throw Error('지갑 네트워크·계정 연결을 확인하세요.');activateNetwork(options.network);
  this.network=options.network;this.role=options.role;this.privateStateId='bizproof:'+options.role;
  const config=configuration(options.network);
  this.storage=privateStorage<PrivateState>({...options,accountId:options.wallet.accountId});
  this.providers={privateStateProvider:this.storage.provider,publicDataProvider:publicProvider(options.network,options.wallet.indexerConfiguration),zkConfigProvider,proofProvider:options.wallet.proofProvider??httpClientProofProvider(config.proofServer,zkConfigProvider,{timeout:300000}),walletProvider:options.wallet.provider,midnightProvider:options.wallet.provider};
 }
 private async exclusive<T>(action:()=>Promise<T>):Promise<T>{if(this.closed)throw Error('종료된 SDK 클라이언트입니다.');if(this.running)throw Error('이 계정의 SDK 작업이 진행 중입니다. 완료 후 다시 실행하세요.');this.running=true;try{return await action();}finally{this.running=false;}}
 private requireRole(role:ClientOptions['role']){if(this.role!==role)throw Error('해당 작업의 SDK 역할이 다릅니다.');}
 private location(){if(this.closed)throw Error('종료된 SDK 클라이언트입니다.');if(!this.contractAddress)throw Error('먼저 배포하거나 기존 컨트랙트에 연결하세요.');return this.contractAddress;}
 async deploy(initialTime=BigInt(Math.floor(Date.now()/1000))){return this.exclusive(()=>this.transactions.run('deploy',async()=>{this.requireRole('administrator');if(this.contractAddress)throw Error('이미 컨트랙트에 연결된 클라이언트입니다.');const deployed=await deployContract(this.providers,{compiledContract,privateStateId:this.privateStateId,initialPrivateState:{secret:new Uint8Array(randomBytes(32))},args:[initialTime]});this.contractAddress=deployed.deployTxData.public.contractAddress;return publicReceipt(this.network,this.contractAddress,'deploy',deployed.deployTxData.public);}));}
 async join(contractAddress:string){return this.exclusive(async()=>{const id=address(contractAddress);if(this.contractAddress&&this.contractAddress!==id)throw Error('다른 컨트랙트에는 새 클라이언트로 연결하세요.');const report=await inspectContract(this.providers.publicDataProvider,this.network,id);if(!report.found)throw Error('배포된 BizProof 컨트랙트를 찾을 수 없습니다.');this.providers.privateStateProvider.setContractAddress(id);const saved=await this.providers.privateStateProvider.get(this.privateStateId);if(!saved)throw Error('이 계정·역할의 암호화 비공개 상태가 없습니다. 신규 보유자는 enrollHolder를 사용하세요.');await findDeployedContract(this.providers,{compiledContract,contractAddress:id,privateStateId:this.privateStateId});this.contractAddress=id;return report;});}
 async enrollHolder(contractAddress:string){return this.exclusive(async()=>{this.requireRole('holder');const id=address(contractAddress);if(this.contractAddress&&this.contractAddress!==id)throw Error('다른 컨트랙트에 이미 연결되어 있습니다.');const report=await inspectContract(this.providers.publicDataProvider,this.network,id);if(!report.found)throw Error('배포된 BizProof 컨트랙트가 필요합니다.');this.providers.privateStateProvider.setContractAddress(id);const existing=await this.providers.privateStateProvider.get(this.privateStateId);if(!existing)await this.providers.privateStateProvider.set(this.privateStateId,{secret:new Uint8Array(randomBytes(32))});this.contractAddress=id;const state=await this.providers.privateStateProvider.get(this.privateStateId);return {network:this.network,contractAddress:id,holder:Buffer.from(pureCircuits.holderKey(state!.secret)).toString('hex')};});}
 async storeAttestation(claims:BusinessClaims,signature:Schnorr_SchnorrSignature){return this.exclusive(async()=>{this.requireRole('holder');this.location();const state=await this.providers.privateStateProvider.get(this.privateStateId);if(!state)throw Error('보유자 상태가 없습니다.');if(claims.credentialId.length!==32||claims.expiresAt<=BigInt(Math.floor(Date.now()/1000)))throw Error('자격 식별값·유효기간을 확인하세요.');await this.providers.privateStateProvider.set(this.privateStateId,{...state,claims,signature});return {stored:true,signatureVerified:false,notice:'비공개 저장 완료. 서명 검증은 submit 회로에서 수행됩니다.'};});}
 private async transact(operation:string,call:()=>Promise<{public:FinalizedTxData}>){return this.exclusive(()=>this.transactions.run(operation,async()=>{const id=this.location();const result=await call();return publicReceipt(this.network,id,operation,result.public);}));}
 registerIssuer(issuerId:bigint,key:{x:bigint;y:bigint}){this.requireRole('administrator');return this.transact('registerIssuer',()=>submitCallTx(this.providers,{compiledContract,contractAddress:this.location(),privateStateId:this.privateStateId,circuitId:'registerIssuer',args:[issuerId,key]}));}
 createRequest(id:Uint8Array,request:ChainRequest){this.requireRole('administrator');return this.transact('createRequest',()=>submitCallTx(this.providers,{compiledContract,contractAddress:this.location(),privateStateId:this.privateStateId,circuitId:'createRequest',args:[id,request]}));}
 submit(id:Uint8Array){this.requireRole('holder');return this.transact('submit',()=>submitCallTx(this.providers,{compiledContract,contractAddress:this.location(),privateStateId:this.privateStateId,circuitId:'submit',args:[id]}));}
 revokeCredential(id:Uint8Array){this.requireRole('administrator');return this.transact('revokeCredential',()=>submitCallTx(this.providers,{compiledContract,contractAddress:this.location(),privateStateId:this.privateStateId,circuitId:'revokeCredential',args:[id]}));}
 cancelRequest(id:Uint8Array){this.requireRole('administrator');return this.transact('cancelRequest',()=>submitCallTx(this.providers,{compiledContract,contractAddress:this.location(),privateStateId:this.privateStateId,circuitId:'cancelRequest',args:[id]}));}
 suspendIssuer(id:bigint){this.requireRole('administrator');return this.transact('suspendIssuer',()=>submitCallTx(this.providers,{compiledContract,contractAddress:this.location(),privateStateId:this.privateStateId,circuitId:'suspendIssuer',args:[id]}));}
 resumeIssuer(id:bigint){this.requireRole('administrator');return this.transact('resumeIssuer',()=>submitCallTx(this.providers,{compiledContract,contractAddress:this.location(),privateStateId:this.privateStateId,circuitId:'resumeIssuer',args:[id]}));}
 advanceTime(timestamp=BigInt(Math.floor(Date.now()/1000))){this.requireRole('administrator');return this.transact('advanceTime',()=>submitCallTx(this.providers,{compiledContract,contractAddress:this.location(),privateStateId:this.privateStateId,circuitId:'advanceTime',args:[timestamp]}));}
 rotateAdministrator(next:Uint8Array){this.requireRole('administrator');if(next.length!==32||next.every(x=>x===0))throw Error('새 관리자 식별값을 확인하세요.');return this.transact('rotateAdministrator',()=>submitCallTx(this.providers,{compiledContract,contractAddress:this.location(),privateStateId:this.privateStateId,circuitId:'rotateAdministrator',args:[next]}));}
 watch(onState:Parameters<typeof subscribeContract>[3],onError:()=>void){if(this.closed)throw Error('종료된 SDK 클라이언트입니다.');const subscription=subscribeContract(this.providers.publicDataProvider,this.network,this.location(),onState,onError);this.subscriptions.add(subscription);return {unsubscribe:()=>{subscription.unsubscribe();this.subscriptions.delete(subscription);}};}
 inspect(requestHex?:string){return inspectContract(this.providers.publicDataProvider,this.network,this.location(),requestHex);}
 async close(){if(this.running)throw Error('진행 중인 작업을 먼저 완료하세요.');for(const subscription of this.subscriptions)subscription.unsubscribe();this.subscriptions.clear();await this.storage.close();this.transactions.clear();this.closed=true;}
 async exportEncryptedState(){return this.exclusive(async()=>{this.location();return this.providers.privateStateProvider.exportPrivateStates();});}
}
