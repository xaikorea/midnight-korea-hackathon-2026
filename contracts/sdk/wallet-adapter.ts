import type {ConnectedAPI} from '@midnight-ntwrk/dapp-connector-api';
import {MidnightBech32m,ShieldedAddress} from '@midnight-ntwrk/wallet-sdk-address-format';
import {bech32m} from '@scure/base';
import {Transaction} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {createProofProvider} from '@midnight-ntwrk/midnight-js-types';
import type {KeyMaterialProvider} from '@midnight-ntwrk/dapp-connector-api';
import type {WalletBinding} from './client.ts';
import {walletIndexer,type Network} from './config.ts';
const hex=(value:Uint8Array)=>Array.from(value,b=>b.toString(16).padStart(2,'0')).join('');
const decode=(value:string)=>{if(!/^(?:[a-f\d]{2})+$/i.test(value))throw Error('지갑 거래 응답은 16진수 바이트여야 합니다.');return Uint8Array.from(value.match(/../g)!,v=>parseInt(v,16));};
// Use a connected API provided by the user's extension. Never request seeds or signing keys.
export async function bindDappWallet(api:ConnectedAPI,network:Network,options:{keyMaterialProvider?:KeyMaterialProvider;useWalletIndexer?:boolean}={}):Promise<WalletBinding>{
 await api.hintUsage(['getConnectionStatus','getConfiguration','getShieldedAddresses']);
 const config=await api.getConfiguration();if(config.networkId!==network)throw Error('지갑 설정의 네트워크가 다릅니다.');
 const indexerConfiguration=options.useWalletIndexer?walletIndexer(config,network):undefined;
 const addresses=await api.getShieldedAddresses();
 // address-format 3.1.2 parses with scure's default 90-character limit, while shielded addresses exceed it.
 // Keep checksum, exact prefix/network and 64-byte payload checks; only widen the bounded length.
 const raw=bech32m.decodeToBytes(addresses.shieldedAddress,200);if(raw.prefix!=='mn_shield-addr_'+network||raw.bytes.length!==64)throw Error('지갑 주소의 네트워크·형식을 확인하세요.');
 const decoded=new MidnightBech32m('shield-addr',network,Buffer.from(raw.bytes)).decode(ShieldedAddress,network);
 const coin=hex(new Uint8Array(decoded.coinPublicKey.data)),encryption=hex(new Uint8Array(decoded.encryptionPublicKey.data));
 if(coin.length!==64||encryption.length!==64)throw Error('지갑 공개키 길이가 잘못되었습니다.');
 async function assertConnected(){const state=await api.getConnectionStatus();if(state.status!=='connected'||state.networkId!==network)throw Error('지갑이 연결 해제되었거나 네트워크가 변경되었습니다.');const current=await api.getShieldedAddresses();if(current.shieldedAddress!==addresses.shieldedAddress)throw Error('지갑 계정이 변경되었습니다. 새 SDK 클라이언트로 연결하세요.');const services=await api.getConfiguration();if(services.networkId!==network||(indexerConfiguration&&JSON.stringify(walletIndexer(services,network))!==JSON.stringify(indexerConfiguration)))throw Error('지갑 서비스 설정이 변경되었습니다. 다시 연결하세요.');}
 await assertConnected();
 // Delegation is explicitly selected by the caller. Never silently send private proving data to another server.
 const proofProvider=options.keyMaterialProvider?createProofProvider({
  async check(preimage,key){await assertConnected();await api.hintUsage(['getProvingProvider']);await assertConnected();const prover=await api.getProvingProvider(options.keyMaterialProvider!);await assertConnected();const result=await prover.check(preimage,key);await assertConnected();return result;},
  async prove(preimage,key,binding){await assertConnected();await api.hintUsage(['getProvingProvider']);await assertConnected();const prover=await api.getProvingProvider(options.keyMaterialProvider!);await assertConnected();const result=await prover.prove(preimage,key,binding);await assertConnected();return result;}
 }):undefined;
 let active=false;
 async function exclusive<T>(operation:()=>Promise<T>){if(active)throw Error('지갑 승인 작업이 이미 진행 중입니다.');active=true;try{return await operation();}finally{active=false;}}
 return {network,accountId:addresses.shieldedAddress,...(proofProvider?{proofProvider}:{}),...(indexerConfiguration?{indexerConfiguration}:{}),provider:{getCoinPublicKey:()=>coin,getEncryptionPublicKey:()=>encryption,
  balanceTx(tx,ttl){return exclusive(async()=>{await assertConnected();if(ttl&&ttl.getTime()<=Date.now())throw Error('거래 유효기간이 지났습니다.');await api.hintUsage(['balanceUnsealedTransaction']);await assertConnected();if(ttl&&ttl.getTime()<=Date.now())throw Error('거래 유효기간이 지났습니다.');const result=await api.balanceUnsealedTransaction(hex(tx.serialize()),{payFees:true});await assertConnected();if(ttl&&ttl.getTime()<=Date.now())throw Error('지갑 승인 중 거래 유효기간이 지났습니다.');return Transaction.deserialize('signature','proof','binding',decode(result.tx));});},
  submitTx(tx){return exclusive(async()=>{await assertConnected();const id=tx.identifiers()[0];if(!id)throw Error('거래 식별값이 없습니다.');await api.hintUsage(['submitTransaction']);await assertConnected();await api.submitTransaction(hex(tx.serialize()));return id;});}
 }};
}
