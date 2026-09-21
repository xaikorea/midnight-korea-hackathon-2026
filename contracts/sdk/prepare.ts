import {randomBytes} from 'node:crypto';
import {createUnprovenDeployTx} from '@midnight-ntwrk/midnight-js-contracts';
import {sampleCoinPublicKey,sampleEncryptionPublicKey,sampleSigningKey} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {compiledContract} from './contract.ts';
import {activateNetwork} from './config.ts';
import {zkConfigProvider,artifactManifest} from './public-state.ts';
// Exercises the real SDK and compiled constructor without requesting proof, wallet signature or chain submission.
export async function prepareDeployment(){activateNetwork('undeployed');const manifest=await artifactManifest();const result=await createUnprovenDeployTx({zkConfigProvider,walletProvider:{getCoinPublicKey:()=>sampleCoinPublicKey(),getEncryptionPublicKey:()=>sampleEncryptionPublicKey(),balanceTx:async()=>{throw Error('오프라인 준비에서는 지갑을 호출하지 않습니다.');}}},{compiledContract,signingKey:sampleSigningKey(),initialPrivateState:{secret:new Uint8Array(randomBytes(32))},args:[BigInt(Math.floor(Date.now()/1000))]});
 // Never return the SDK's private constructor outputs or serialized unproven transaction.
 return {mode:'midnight-sdk-unproven' as const,sdkVersion:'4.1.1',constructorExecuted:true,transactionPrepared:!!result.public,proofGenerated:false,networkConnected:false,contractDeployed:false,artifactCount:manifest.circuits.length,at:new Date().toISOString(),notice:'공식 SDK로 미증명 배포 거래를 구성했습니다. 임시 테스트 키를 사용하며 proof·지갑 승인·체인 배포는 수행하지 않았습니다.'};
}
