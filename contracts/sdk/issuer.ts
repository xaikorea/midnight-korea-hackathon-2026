// Schnorr signing adapted from example-zkloan; see ../LICENSE-APACHE-2.0.
import {randomBytes} from 'node:crypto';
import {ecMulGenerator} from '@midnight-ntwrk/compact-runtime';
import {pureCircuits,type BusinessClaims} from '../managed/contract/index.js';
import {privateStorage,type StorageOptions} from './storage.ts';
import {address} from './config.ts';
const order=6554484396890773809930967563523245729705921265872317281365359162392183254199n;
const scalar=()=>BigInt('0x'+randomBytes(32).toString('hex'))%(order-1n)+1n;
export class IssuerVault{
 private readonly storage;private running=false;
 constructor(options:Omit<StorageOptions,'role'>,contractAddress:string){this.storage=privateStorage<{secret:bigint}>({...options,role:'issuer'});this.storage.provider.setContractAddress(address(contractAddress));}
 private keyId(id:bigint){if(id<0n||id>65535n)throw Error('발급자 ID 범위를 확인하세요.');return 'issuer:'+id;}
 async create(id:bigint){if(this.running)throw Error('발급자 키 작업이 진행 중입니다.');this.running=true;try{const keyId=this.keyId(id);if(await this.storage.provider.get(keyId))throw Error('이미 생성한 발급자 키 ID입니다. 새 ID로 교체하세요.');const secret=scalar();await this.storage.provider.set(keyId,{secret});return {issuerId:id,publicKey:ecMulGenerator(secret)};}finally{this.running=false;}}
 async publicKey(id:bigint){const key=await this.storage.provider.get(this.keyId(id));if(!key)throw Error('발급자 키가 없습니다.');return ecMulGenerator(key.secret);}
 async issue(id:bigint,claims:BusinessClaims,holder:Uint8Array){
  if(holder.length!==32||claims.credentialId.length!==32||claims.revenue<0n||claims.revenue>1000000000000n||claims.foundedDay<0n||claims.foundedDay>BigInt(Math.floor(Date.now()/864e5))||claims.region<1n||claims.region>65535n||claims.expiresAt<=BigInt(Math.floor(Date.now()/1000))||claims.expiresAt>BigInt(Math.floor(Date.now()/1000)+365*86400)||typeof claims.certified!=='boolean')throw Error('발급 속성·보유자·유효기간을 확인하세요.');
  const key=await this.storage.provider.get(this.keyId(id));if(!key)throw Error('발급자 키가 없습니다.');const pk=ecMulGenerator(key.secret),nonce=scalar(),announcement=ecMulGenerator(nonce);const challenge=pureCircuits.signingChallenge(announcement.x,announcement.y,pk.x,pk.y,pureCircuits.credentialMessage(claims,holder))%(1n<<248n);
  return {issuerId:id,holder:holder.slice(),claims:structuredClone(claims),signature:{announcement,response:(nonce+challenge*key.secret)%order}};
 }
 close(){return this.storage.close();}
}
