import type {ZswapSecretKeys,DustSecretKey,FinalizedTransaction,TransactionId} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type {UnboundTransaction} from '@midnight-ntwrk/midnight-js-types';
import type {WalletBinding} from './client.ts';
import type {Network} from './config.ts';
// Structural adapter for an already initialized/synchronized WalletFacade (wallet-sdk 1.2.x).
// Seed creation, funding and wallet lifecycle remain with the wallet owner.
export function bindWalletFacade<Recipe>(context:{network:Network;accountId:string;shieldedSecretKeys:ZswapSecretKeys;dustSecretKey:DustSecretKey;assertReady:()=>Promise<void>;wallet:{balanceUnboundTransaction(tx:UnboundTransaction,keys:{shieldedSecretKeys:ZswapSecretKeys;dustSecretKey:DustSecretKey},options:{ttl:Date}):Promise<Recipe>;finalizeRecipe(recipe:Recipe):Promise<FinalizedTransaction>;submitTransaction(tx:FinalizedTransaction):Promise<TransactionId>}}):WalletBinding{
 return {network:context.network,accountId:context.accountId,provider:{getCoinPublicKey:()=>context.shieldedSecretKeys.coinPublicKey,getEncryptionPublicKey:()=>context.shieldedSecretKeys.encryptionPublicKey,async balanceTx(tx,ttl){await context.assertReady();const deadline=ttl??new Date(Date.now()+30*60*1000);if(deadline.getTime()<=Date.now())throw Error('거래 유효기간이 지났습니다.');const recipe=await context.wallet.balanceUnboundTransaction(tx,{shieldedSecretKeys:context.shieldedSecretKeys,dustSecretKey:context.dustSecretKey},{ttl:deadline});await context.assertReady();return context.wallet.finalizeRecipe(recipe);},async submitTx(tx){await context.assertReady();return context.wallet.submitTransaction(tx);}}};
}
