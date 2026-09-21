import {publicReceipt} from './public-state.ts';
type Receipt=ReturnType<typeof publicReceipt>;
export type TransactionState=Readonly<{status:'idle'}|{status:'pending';operation:string;startedAt:string}|{status:'finalized';operation:string;startedAt:string;finishedAt:string;receipt:Receipt}|{status:'unconfirmed';operation:string;startedAt:string;finishedAt:string;notice:string}>;
// Observability must never change transaction execution or expose SDK errors/private payloads.
export class TransactionMonitor{
 private state:TransactionState={status:'idle'};
 private listeners=new Set<(state:TransactionState)=>void>();
 subscribe(listener:(state:TransactionState)=>void){this.listeners.add(listener);this.notify(listener);return {unsubscribe:()=>this.listeners.delete(listener)};}
 private notify(listener:(state:TransactionState)=>void){try{listener(structuredClone(this.state));}catch{/* Consumer failures must not turn a finalized transaction into an error. */}}
 private publish(state:TransactionState){this.state=state;for(const listener of this.listeners)this.notify(listener);}
 async run(operation:string,action:()=>Promise<Receipt>){
  if(this.state.status==='pending')throw Error('거래가 진행 중입니다.');
  const startedAt=new Date().toISOString();this.publish({status:'pending',operation,startedAt});
  try{const receipt=await action();if(receipt.status!=='SucceedEntirely'||receipt.mode!=='midnight-finalized')throw Error('거래 확정 상태를 확인하세요.');this.publish({status:'finalized',operation,startedAt,finishedAt:new Date().toISOString(),receipt});return receipt;}
  catch(error){this.publish({status:'unconfirmed',operation,startedAt,finishedAt:new Date().toISOString(),notice:'성공 확정을 확인하지 못했습니다. 전송 이후의 오류일 수도 있으므로 체인 상태를 확인한 뒤 재시도하세요.'});throw error;}
 }
 clear(){this.listeners.clear();this.state={status:'idle'};}
}
