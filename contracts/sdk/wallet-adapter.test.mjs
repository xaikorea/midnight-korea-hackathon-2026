import test from 'node:test';
import assert from 'node:assert/strict';
import {MidnightBech32m,ShieldedAddress,ShieldedCoinPublicKey,ShieldedEncryptionPublicKey} from '@midnight-ntwrk/wallet-sdk-address-format';
import {bindDappWallet} from './wallet-adapter.ts';
import {walletIndexer} from './config.ts';
test('connector adapter decodes public keys and blocks network/account changes before signing',async()=>{
 const shieldedAddress=MidnightBech32m.encode('undeployed',new ShieldedAddress(new ShieldedCoinPublicKey(Buffer.alloc(32,2)),new ShieldedEncryptionPublicKey(Buffer.alloc(32,3)))).asString();let status={status:'connected',networkId:'undeployed'},currentAddress=shieldedAddress,balanced=false;
 const api={hintUsage:async()=>{},getConfiguration:async()=>({networkId:'undeployed'}),getShieldedAddresses:async()=>({shieldedAddress:currentAddress}),getConnectionStatus:async()=>status,balanceUnsealedTransaction:async()=>{balanced=true;return {tx:'invalid'};}};
 const binding=await bindDappWallet(api,'undeployed');assert.equal(binding.provider.getCoinPublicKey(),'02'.repeat(32));assert.equal(binding.provider.getEncryptionPublicKey(),'03'.repeat(32));status={status:'connected',networkId:'preprod'};await assert.rejects(binding.provider.balanceTx({}),/네트워크/);assert.equal(balanced,false);status={status:'connected',networkId:'undeployed'};currentAddress='another-account';await assert.rejects(binding.provider.balanceTx({}),/계정/);assert.equal(balanced,false);currentAddress=shieldedAddress;await assert.rejects(binding.provider.balanceTx({serialize:()=>new Uint8Array([1])}),/16진수/);await assert.rejects(bindDappWallet(api,'preprod'),/네트워크/);
});

test('wallet indexer preferences validate protocols and invalidate changed service configuration',async()=>{
 assert.throws(()=>walletIndexer({networkId:'preprod',indexerUri:'http://remote.example',indexerWsUri:'wss://remote.example'},'preprod'),/주소/);
 assert.throws(()=>walletIndexer({networkId:'preprod',indexerUri:'https://user:secret@remote.example',indexerWsUri:'wss://remote.example'},'preprod'),/주소/);
 const services={networkId:'undeployed',indexerUri:'http://127.0.0.1:8088/api/v4/graphql',indexerWsUri:'ws://127.0.0.1:8088/api/v4/graphql/ws'};
 assert.equal(walletIndexer(services,'undeployed').indexer,services.indexerUri);
 const shieldedAddress=MidnightBech32m.encode('undeployed',new ShieldedAddress(new ShieldedCoinPublicKey(Buffer.alloc(32,6)),new ShieldedEncryptionPublicKey(Buffer.alloc(32,7)))).asString();let called=false;
 const api={hintUsage:async()=>{},getConfiguration:async()=>services,getConnectionStatus:async()=>({status:'connected',networkId:'undeployed'}),getShieldedAddresses:async()=>({shieldedAddress}),balanceUnsealedTransaction:async()=>{called=true;return {tx:'00'};}};
 const binding=await bindDappWallet(api,'undeployed',{useWalletIndexer:true});assert.equal(binding.indexerConfiguration.indexer,services.indexerUri);services.indexerUri='http://127.0.0.1:9999';await assert.rejects(binding.provider.balanceTx({}),/설정/);assert.equal(called,false);
});

test('delegated proof uses wallet provider, preserves rejection and blocks account changes during permissions',async()=>{
 const address=MidnightBech32m.encode('undeployed',new ShieldedAddress(new ShieldedCoinPublicKey(Buffer.alloc(32,4)),new ShieldedEncryptionPublicKey(Buffer.alloc(32,5)))).asString();
 let current=address,proofs=0,fail=false,changeOnHint=false;const hints=[];
 const keys={getZKIR:async()=>new Uint8Array([1]),getProverKey:async()=>new Uint8Array([2]),getVerifierKey:async()=>new Uint8Array([3])};
 const rejected={type:'DAppConnectorAPIError',code:'PermissionRejected'};
 const api={getConfiguration:async()=>({networkId:'undeployed'}),getConnectionStatus:async()=>({status:'connected',networkId:'undeployed'}),getShieldedAddresses:async()=>({shieldedAddress:current}),hintUsage:async names=>{hints.push(names);if(changeOnHint)current='another-account';},getProvingProvider:async material=>{assert.equal(material,keys);if(fail)throw rejected;return {check:async()=>[1n],prove:async(bytes,key,binding)=>{proofs++;assert.deepEqual(bytes,new Uint8Array([9]));assert.equal(key,'submit');assert.equal(binding,7n);return new Uint8Array([8]);}};}};
 const wallet=await bindDappWallet(api,'undeployed',{keyMaterialProvider:keys});
 // Test double transaction exercises the official createProofProvider adapter, not a cryptographic proof.
 const tx={prove:async provider=>{assert.deepEqual(await provider.check(new Uint8Array([9]),'submit'),[1n]);return provider.prove(new Uint8Array([9]),'submit',7n);}};
 assert.deepEqual(await wallet.proofProvider.proveTx(tx),new Uint8Array([8]));assert.equal(proofs,1);assert.ok(hints.some(h=>h.includes('getProvingProvider')));
 fail=true;await assert.rejects(wallet.proofProvider.proveTx(tx),e=>e===rejected);assert.equal(proofs,1);fail=false;changeOnHint=true;await assert.rejects(wallet.proofProvider.proveTx(tx),/계정/);assert.equal(proofs,1);
});
