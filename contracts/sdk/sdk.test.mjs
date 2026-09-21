import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const outputDirectory=fileURLToPath(new URL('../../outputs/',import.meta.url));
await mkdir(outputDirectory,{recursive:true});
import {createUnprovenDeployTx,createUnprovenCallTxFromInitialStates} from '@midnight-ntwrk/midnight-js-contracts';
import {sampleCoinPublicKey,sampleEncryptionPublicKey,sampleSigningKey,LedgerParameters,ZswapChainState} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {ledger} from '../managed/contract/index.js';
import {Simulator} from '../runtime.mjs';
import {compiledContract} from './contract.ts';
import {artifactManifest,inspectContract,zkConfigProvider,publicReceipt} from './public-state.ts';
import {prepareDeployment} from './prepare.ts';
import {activateNetwork,bytes32} from './config.ts';
import {IssuerVault} from './issuer.ts';
import {privateStorage} from './storage.ts';
import {BizProofClient} from './client.ts';

test('official SDK prepares deployment and executes registerIssuer; verifies installed contract keys',async()=>{
 activateNetwork('undeployed');const manifest=await artifactManifest();assert.equal(manifest.circuits.length,9);assert.ok(manifest.circuits.every(c=>c.proverBytes>0&&c.verifierSha256.length===64));
 const report=await prepareDeployment();assert.equal(report.transactionPrepared,true);assert.equal(report.proofGenerated,false);assert.equal(report.contractDeployed,false);assert.equal('private' in report,false);
 const sim=new Simulator(),coin=sampleCoinPublicKey(),enc=sampleEncryptionPublicKey();const deployed=await createUnprovenDeployTx({zkConfigProvider,walletProvider:{getCoinPublicKey:()=>coin,getEncryptionPublicKey:()=>enc}},{compiledContract,signingKey:sampleSigningKey(),args:[sim.now],initialPrivateState:{secret:sim.adminSecret}});
 const inspection=await inspectContract({queryContractState:async()=>deployed.public.initialContractState},'undeployed',deployed.public.contractAddress,'00'.repeat(32));assert.equal(inspection.contractCodeVerified,true);assert.equal(inspection.request.exists,false);assert.equal(inspection.request.eligible,null);
 const call=await createUnprovenCallTxFromInitialStates(zkConfigProvider,{compiledContract,circuitId:'registerIssuer',contractAddress:deployed.public.contractAddress,args:[1n,sim.state.issuerKeys.lookup(1n)],coinPublicKey:coin,initialContractState:deployed.public.initialContractState,initialZswapChainState:new ZswapChainState(),ledgerParameters:LedgerParameters.initialParameters(),initialPrivateState:{secret:sim.adminSecret}},enc);assert.equal(ledger(call.public.nextContractState).issuerKeys.member(1n),true);
 await assert.rejects(inspectContract({queryContractState:async()=>sim.context.currentQueryContext.state},'undeployed','bad'),/주소/);
 assert.equal((await inspectContract({queryContractState:async()=>null},'undeployed','00'.repeat(32))).found,false);
});
test('encrypted issuer key persists; one attestation is reused for buyer and grant',async()=>{
 const directory=await mkdtemp(resolve(outputDirectory,'sdk-vault-')),contract='a1'.repeat(32),options={network:'undeployed',accountId:'fictional-issuer',storageDirectory:directory,passwordProvider:()=> 'Demo!Key_7mZ9#qT2$vR6'};const sim=new Simulator();
 let vault=new IssuerVault(options,contract);const created=await vault.create(2n);await assert.rejects(vault.create(2n),/이미/);await vault.close();vault=new IssuerVault(options,contract);assert.deepEqual(await vault.publicKey(2n),created.publicKey);sim.invoke('registerIssuer',[2n,created.publicKey]);const attestation=await vault.issue(2n,sim.claims,sim.holder);const buyer=sim.request({issuerId:2n}),grant=sim.request({issuerId:2n,minRevenue:0n,maxRevenue:500000000n});assert.equal(sim.submit(buyer,attestation.claims,attestation.signature),true);assert.equal(sim.submit(grant,attestation.claims,attestation.signature),true);assert.throws(()=>sim.submit(sim.request({issuerId:2n}),{...attestation.claims,revenue:800000000n},attestation.signature));await vault.close();
 const wrongPassword=new IssuerVault({...options,passwordProvider:()=> 'Wrong!Key_7mZ9#qT2$vR6'},contract);await assert.rejects(wrongPassword.publicKey(2n));await wrongPassword.close();
});
test('private storage scopes accounts and contracts, encrypts exports and closes cleanly',async()=>{
 const directory=await mkdtemp(resolve(outputDirectory,'sdk-private-'));const base={network:'undeployed',accountId:'fictional-holder',role:'holder',storageDirectory:directory,passwordProvider:()=> 'Demo!Key_7mZ9#qT2$vR6'};const a=privateStorage(base);a.provider.setContractAddress('a2'.repeat(32));await a.provider.set('credential',{secret:new Uint8Array(32).fill(71),marker:'PRIVATE-SENTINEL-DO-NOT-EXPORT',number:123n});const encrypted=await a.provider.exportPrivateStates();assert.equal(encrypted.format,'midnight-private-state-export');assert.ok(!JSON.stringify(encrypted).includes('PRIVATE-SENTINEL'));a.provider.setContractAddress('b2'.repeat(32));assert.equal(await a.provider.get('credential'),null);await a.close();
 const b=privateStorage({...base,accountId:'different-holder'});b.provider.setContractAddress('a2'.repeat(32));assert.equal(await b.provider.get('credential'),null);await b.close();const restored=privateStorage(base);restored.provider.setContractAddress('a2'.repeat(32));assert.equal((await restored.provider.get('credential')).number,123n);await restored.close();
 async function checkFiles(path){for(const f of await readdir(path,{withFileTypes:true})){const p=resolve(path,f.name);if(f.isDirectory())await checkFiles(p);else assert.ok(!(await readFile(p)).includes(Buffer.from('PRIVATE-SENTINEL')));}}await checkFiles(directory);
});
test('failed receipts are rejected and private SDK payloads never enter public receipt',()=>{
 assert.throws(()=>publicReceipt('undeployed','00'.repeat(32),'submit',{status:'FailEntirely'}));const receipt=publicReceipt('undeployed','00'.repeat(32),'submit',{status:'SucceedEntirely',txId:'public-id',txHash:'hash',blockHash:'block',blockHeight:1,blockTimestamp:1,private:{secret:'hidden'},tx:{raw:'hidden'}});assert.equal('tx' in receipt,false);assert.equal('private' in receipt,false);assert.equal(receipt.mode,'midnight-finalized');assert.throws(()=>bytes32('../private'),/식별값/);
 assert.throws(()=>new BizProofClient({network:'undeployed',wallet:{network:'preprod',accountId:'account'},role:'holder'}),/네트워크/);
});

test('contract subscription verifies code, reports invalid state and suppresses updates after unsubscribe',async()=>{
 const {subscribeContract}=await import('./public-state.ts');const {Subject}=await import('rxjs');
 const stream=new Subject(),provider={contractStateObservable:()=>stream};const states=[],errors=[];
 const sim=new Simulator();const deployed=await createUnprovenDeployTx({zkConfigProvider,walletProvider:{getCoinPublicKey:()=>sampleCoinPublicKey(),getEncryptionPublicKey:()=>sampleEncryptionPublicKey()}},{compiledContract,signingKey:sampleSigningKey(),args:[sim.now],initialPrivateState:{secret:sim.adminSecret}});
 const sub=subscribeContract(provider,'undeployed',deployed.public.contractAddress,s=>states.push(s),()=>errors.push(true));
 stream.next(deployed.public.initialContractState);await new Promise(r=>setTimeout(r,100));assert.equal(states.length,1);assert.deepEqual(Object.keys(states[0]).sort(),['contractAddress','network','resultCount','trustedTime']);
 stream.next({});await new Promise(r=>setTimeout(r,30));assert.equal(errors.length,1);
 stream.next(deployed.public.initialContractState);sub.unsubscribe();await new Promise(r=>setTimeout(r,30));assert.equal(states.length,1);assert.equal(sub.closed,true);assert.equal(stream.observers.length,0);
});

test('SDK lifecycle rejects calls after close and restricts administrator rotation',async()=>{
 const directory=await mkdtemp(resolve(outputDirectory,'sdk-close-'));const client=new BizProofClient({network:'undeployed',wallet:{network:'undeployed',accountId:'close-test',provider:{}},role:'holder',storageDirectory:directory,passwordProvider:()=> 'Demo!Key_7mZ9#qT2$vR6'});
 assert.throws(()=>client.rotateAdministrator(new Uint8Array(32).fill(1)),/역할/);await client.close();await assert.rejects(client.enrollHolder('aa'.repeat(32)),/종료/);assert.throws(()=>client.inspect(),/종료/);
});


test('transaction monitor isolates observers, blocks duplicates and never auto-retries uncertain submissions',async()=>{
 const {TransactionMonitor}=await import('./transaction-state.ts');const monitor=new TransactionMonitor(),states=[];
 monitor.subscribe(()=>{throw Error('observer failure')});const subscription=monitor.subscribe(state=>states.push(state));
 let release;const pending=monitor.run('submit',()=>new Promise(resolve=>{release=resolve}));
 await assert.rejects(monitor.run('submit',async()=>{}),/진행/);
 const receipt=publicReceipt('undeployed','aa'.repeat(32),'submit',{status:'SucceedEntirely',txId:'id',txHash:'hash',blockHash:'block',blockHeight:1,blockTimestamp:1});release(receipt);assert.deepEqual(await pending,receipt);
 assert.deepEqual(states.map(s=>s.status),['idle','pending','finalized']);states.at(-1).receipt.txId='mutated';
 let current;monitor.subscribe(s=>{current=s});assert.equal(current.receipt.txId,'id');
 let attempts=0;await assert.rejects(monitor.run('revokeCredential',async()=>{attempts++;throw Error('PRIVATE-SENTINEL')}),/PRIVATE-SENTINEL/);
 assert.equal(attempts,1);assert.equal(states.at(-1).status,'unconfirmed');assert.ok(!JSON.stringify(states).includes('PRIVATE-SENTINEL'));
 subscription.unsubscribe();const count=states.length;await assert.rejects(monitor.run('submit',async()=>({...receipt,status:'FailEntirely'})));assert.equal(states.length,count);monitor.clear();
});
