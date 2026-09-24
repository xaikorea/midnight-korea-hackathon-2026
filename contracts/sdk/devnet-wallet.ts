// Wallet initialization adapted from midnightntwrk/example-zkloan (eff9030d), Apache-2.0.
// Copyright (C) 2025 Midnight Foundation. SPDX-License-Identifier: Apache-2.0
// Public genesis funding is for the isolated Local Devnet ONLY. Never use this wallet remotely.
import {HDWallet,Roles,WalletFacade,ShieldedWallet,DustWallet,UnshieldedWallet,createKeystore,InMemoryTransactionHistoryStorage,WalletEntrySchema,PublicKey} from '@midnight-ntwrk/wallet-sdk';
import {ZswapSecretKeys,DustSecretKey,LedgerParameters,nativeToken} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {firstValueFrom,filter,timeout} from 'rxjs';
import {WebSocket} from 'ws';
import {configuration} from './config.ts';
import {bindWalletFacade} from './facade-adapter.ts';

export async function createDevnetWallet(onStatus:(status:string)=>void){
 Object.assign(globalThis,{WebSocket});
 const network='undeployed' as const,c=configuration(network);
 const hd=HDWallet.fromSeed(Buffer.from('0'.repeat(63)+'1','hex'));
 if(hd.type!=='seedOk')throw Error('Local Devnet wallet initialization failed');
 const derived=hd.hdWallet.selectAccount(0).selectRoles([Roles.Zswap,Roles.NightExternal,Roles.Dust]).deriveKeysAt(0);
 hd.hdWallet.clear();if(derived.type!=='keysDerived')throw Error('Local Devnet key derivation failed');
 const shieldedSecretKeys=ZswapSecretKeys.fromSeed(derived.keys[Roles.Zswap]);
 const dustSecretKey=DustSecretKey.fromSeed(derived.keys[Roles.Dust]);
 const keystore=createKeystore(derived.keys[Roles.NightExternal],network);
 const base={networkId:network,indexerClientConnection:{indexerHttpUrl:c.indexer,indexerWsUrl:c.indexerWs}};
 const relayURL=new URL('ws://127.0.0.1:9944'),provingServerUrl=new URL(c.proofServer);
 const history=()=>new InMemoryTransactionHistoryStorage(WalletEntrySchema);
 const shieldedConfig={...base,relayURL,provingServerUrl,txHistoryStorage:history()};
 const unshieldedConfig={...base,txHistoryStorage:history()};
 const dustConfig={...base,relayURL,provingServerUrl,costParameters:{additionalFeeOverhead:300_000_000_000_000n,feeBlocksMargin:5},txHistoryStorage:history()};
 const wallet=await WalletFacade.init({configuration:{...shieldedConfig,...unshieldedConfig,...dustConfig},
  shielded:()=>ShieldedWallet(shieldedConfig).startWithSecretKeys(shieldedSecretKeys),
  unshielded:()=>UnshieldedWallet(unshieldedConfig).startWithPublicKey(PublicKey.fromKeyStore(keystore)),
  dust:()=>DustWallet(dustConfig).startWithSecretKey(dustSecretKey,LedgerParameters.initialParameters().dust)});
 try{
  await wallet.start(shieldedSecretKeys,dustSecretKey);onStatus('wallet-sync');
  let state=await firstValueFrom(wallet.state().pipe(filter(s=>s.isSynced&&(s.unshielded?.balances[nativeToken().raw]??0n)>0n),timeout(180000)));
  const coins=state.unshielded.availableCoins.filter(c=>c.meta.registeredForDustGeneration===false);
  if(coins.length){onStatus('dust-registration');const recipe=await wallet.registerNightUtxosForDustGeneration(coins,keystore.getPublicKey(),payload=>keystore.signData(payload));await wallet.submitTransaction(await wallet.finalizeRecipe(recipe));}
  onStatus('dust-ready');state=await firstValueFrom(wallet.state().pipe(filter(s=>s.isSynced&&s.dust.balance(new Date())>0n),timeout(180000)));
  const binding=bindWalletFacade({network,accountId:'local-devnet-genesis-demo',shieldedSecretKeys,dustSecretKey,wallet,assertReady:async()=>{await firstValueFrom(wallet.state().pipe(filter(s=>s.isSynced),timeout(120000)));}});
  return {binding,close:()=>wallet.stop()};
 }catch(e){await wallet.stop();throw e;}
}
