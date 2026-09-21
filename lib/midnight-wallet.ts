import type {InitialAPI, ConnectedAPI, WalletConnectedAPI} from '@midnight-ntwrk/dapp-connector-api';

export type WalletChoice={id:string;name:string;rdns:string;apiVersion:string;api:InitialAPI};
export class WalletSessionError extends Error {}
export function walletError(error:unknown):string{
 if(error instanceof WalletSessionError)return error.message;
 if(error&&typeof error==='object'&&'type' in error&&error.type==='DAppConnectorAPIError'&&'code' in error){
  const messages:Record<string,string>={Rejected:'지갑에서 요청을 취소했습니다. 다시 시도할 수 있습니다.',PermissionRejected:'지갑에서 이 기능의 접근 권한을 허용하지 않았습니다.',Disconnected:'지갑 연결이 해제되었습니다. 다시 연결하세요.',InvalidRequest:'지갑이 요청 형식을 지원하지 않습니다.',InternalError:'지갑 내부 오류가 발생했습니다. 지갑 상태를 확인하세요.'};
  return messages[String(error.code)]??'지갑 요청을 완료하지 못했습니다.';
 }
 return '지갑 요청을 완료하지 못했습니다. 지갑 상태와 권한을 확인하세요.';
}
export function discoverWallets(registry:unknown):WalletChoice[]{
 if(!registry||typeof registry!=='object')return [];
 return Object.entries(registry).flatMap(([id,value])=>{if(!value||typeof value!=='object')return [];const api=value as InitialAPI;
  return typeof api.name==='string'&&api.name.length>0&&typeof api.apiVersion==='string'&&/^4\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[\w.-]+)?$/.test(api.apiVersion)&&typeof api.connect==='function'?[{id,name:api.name.slice(0,100),rdns:typeof api.rdns==='string'?api.rdns.slice(0,200):'식별자 없음',apiVersion:api.apiVersion,api}]:[];
 });
}
export function duplicateWallets(wallets:WalletChoice[]){return wallets.some((w,i)=>wallets.some((other,j)=>i!==j&&(w.name.trim().toLowerCase()===other.name.trim().toLowerCase()||(w.rdns!=='식별자 없음'&&w.rdns===other.rdns))));}
export async function inspectWallet(api:ConnectedAPI,network:string){
 const status=await api.getConnectionStatus();if(status.status!=='connected')throw new WalletSessionError('지갑 연결이 해제되었습니다.');if(status.networkId!==network)throw new WalletSessionError('선택한 네트워크와 지갑 네트워크가 다릅니다.');
 const config=await api.getConfiguration();if(config.networkId!==network)throw new WalletSessionError('지갑 서비스 설정의 네트워크가 다릅니다.');
 const addresses=await api.getShieldedAddresses();if(!addresses.shieldedAddress)throw new WalletSessionError('지갑 주소를 확인할 수 없습니다.');
 const host=(uri:string|undefined)=>{if(!uri)return '지갑 제공 증명 방식';try{return new URL(uri).host;}catch{return '잘못된 서비스 주소';}};
 return {network,address:addresses.shieldedAddress,checkedAt:new Date().toISOString(),indexer:host(config.indexerUri),node:host(config.substrateNodeUri),prover:host(config.proverServerUri)};
}
export type WalletReport=Awaited<ReturnType<typeof inspectWallet>>;
// Memory-only session. Closing discards local access; API 4 has no permission-revocation method.
export class WalletSession{
 private generation=0;
 private api?:ConnectedAPI;
 private report?:WalletReport;
 close(){this.generation++;this.api=undefined;this.report=undefined;}
 private current(generation:number){if(generation!==this.generation)throw new WalletSessionError('이전 지갑 요청이 취소되었습니다.');}
 async connect(choice:WalletChoice,network:string){
  this.close();const generation=this.generation;
  const api=await choice.api.connect(network);this.current(generation);
  await api.hintUsage(['getConnectionStatus','getConfiguration','getShieldedAddresses']);this.current(generation);
  const report=await inspectWallet(api,network);this.current(generation);
  this.api=api;this.report=report;return this.check();
 }
 async check(){
  const generation=this.generation,api=this.api,previous=this.report;
  if(!api||!previous)throw new WalletSessionError('지갑을 다시 연결하세요.');
  try{const report=await inspectWallet(api,previous.network);this.current(generation);
   if(report.address!==previous.address)throw new WalletSessionError('지갑 계정이 변경되었습니다. 다시 연결하세요.');
   this.report=report;return report;
  }catch(error){if(generation===this.generation)this.close();throw error;}
 }
 private async read<T>(method:keyof WalletConnectedAPI,read:(api:ConnectedAPI)=>Promise<T>){
  const generation=this.generation;await this.check();this.current(generation);const api=this.api!;
  try{await api.hintUsage([method]);this.current(generation);await this.check();this.current(generation);
   const value=await read(api);await this.check();this.current(generation);return value;
  }catch(error){this.current(generation);await this.check();this.current(generation);throw error;}
 }
 dust(){return this.read('getDustBalance',async api=>{const value=await api.getDustBalance();if(typeof value.balance!=='bigint'||typeof value.cap!=='bigint'||value.balance<BigInt(0)||value.cap<BigInt(0))throw new WalletSessionError('DUST 응답 형식을 확인할 수 없습니다.');return {balance:value.balance.toString(),cap:value.cap.toString()};});}
 history(page:number){if(!Number.isSafeInteger(page)||page<1||page>1000)throw new WalletSessionError('거래 내역 페이지가 잘못되었습니다.');return this.read('getTxHistory',async api=>{
  const entries=await api.getTxHistory(page,5);if(!Array.isArray(entries)||entries.length>5)throw new WalletSessionError('거래 내역 응답 형식을 확인할 수 없습니다.');
  return entries.map(entry=>{if(!/^[a-f\d]{64}$/i.test(entry.txHash))throw new WalletSessionError('거래 해시 형식이 잘못되었습니다.');
   const status=entry.txStatus.status;if(!['pending','confirmed','finalized','discarded'].includes(status))throw new WalletSessionError('거래 상태 형식이 잘못되었습니다.');
   const sections='executionStatus' in entry.txStatus?Object.values(entry.txStatus.executionStatus):[];
   if(sections.some(v=>v!=='Success'&&v!=='Failure'))throw new WalletSessionError('거래 실행 결과 형식이 잘못되었습니다.');
   return {hash:entry.txHash,status,label:status==='pending'?'전송 대기':status==='discarded'?'폐기':sections.includes('Failure')?'실행 실패 포함':status==='confirmed'?'포함됨 · 확정 대기':sections.length?'확정 · 실행 성공':'확정 · 실행 결과 없음'};
  });
 });}
}


