import {setTimeout as delay} from 'node:timers/promises';

// A newly started genesis wallet may have positive DUST but not enough for a fee.
// Retry ONLY a failed local balancing calculation. Never submit or retry a transaction here.
export async function balanceWithDustWait<T>(balance:()=>Promise<T>,options:{deadline:number;onWait:()=>void;now?:()=>number;wait?:(ms:number)=>Promise<unknown>}):Promise<T>{
 const now=options.now??Date.now,wait=options.wait??delay;
 let notified=false;
 for(;;){
  if(now()>=options.deadline)throw Error('Local Devnet DUST did not become sufficient before the balancing deadline. No transaction was submitted.');
  try{return await balance();}
  catch(error){
   const description=error instanceof Error?`${error.name}: ${error.message}`:'';
   if(!description.includes('Wallet.InsufficientFunds')||!description.includes('dust'))throw error;
   if(!notified){options.onWait();notified=true;}
   await wait(Math.min(2000,Math.max(0,options.deadline-now())));
  }
 }
}
