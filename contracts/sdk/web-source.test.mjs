import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Simulator} from '../runtime.mjs';
import {IssuerVault} from './issuer.ts';
import {verifyWebSource,sourceCanonical} from './web-source.ts';
test('signed web source claims are reused in actual Compact buyer/grant circuits',async()=>{
 const now=Math.floor(Date.now()/1000),sim=new Simulator();
 const body={format:'bizproof-midnight-source-v1',network:'undeployed',contractAddress:'a'.repeat(64),holder:Buffer.from(sim.holder).toString('hex'),source:{credentialId:'web-id',companyId:'company-id',issuerId:'web-issuer',keyId:'web-key',digest:'c'.repeat(64)},issuedAt:now,expiresAt:now+600,claims:{revenue:321000000,foundedDay:Math.floor(now/86400)-100,region:1,certified:true,expiresAt:now+86400},requests:[{id:'buyer',kind:'buyer',requestId:'1'.repeat(64),audience:'2'.repeat(64),nonce:'3'.repeat(64),policyHash:'4'.repeat(64),deadline:now+600,policy:{minRevenue:200000000,maxRevenue:1e12,minFoundedDay:0,region:0,requireCertification:false}}]};
 const pair=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']),key=await crypto.subtle.exportKey('jwk',pair.publicKey),signature=Buffer.from(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(sourceCanonical(body)))).toString('base64');
 const verified=await verifyWebSource({body,signature},key,body);
 await mkdir('outputs',{recursive:true});const directory=await mkdtemp(resolve('outputs/web-source-vault-'));const vault=new IssuerVault({network:'undeployed',accountId:'source-test',storageDirectory:directory,passwordProvider:()=> 'Fixture!Only_KeepLocal_123'},body.contractAddress);
 try{const registered=await vault.create(3n);sim.invoke('registerIssuer',[3n,registered.publicKey]);const attestation=await vault.issue(3n,{credentialId:Buffer.from(verified.source.digest,'hex'),revenue:BigInt(verified.claims.revenue),foundedDay:BigInt(verified.claims.foundedDay),region:BigInt(verified.claims.region),certified:verified.claims.certified,expiresAt:BigInt(verified.expiresAt)},sim.holder);
 assert.equal(sim.submit(sim.request({issuerId:3n,minRevenue:200000000n}),attestation.claims,attestation.signature),true);
 assert.equal(sim.submit(sim.request({issuerId:3n,minRevenue:0n,maxRevenue:500000000n}),attestation.claims,attestation.signature),true);
 assert.throws(()=>sim.submit(sim.request({issuerId:3n}),{...attestation.claims,revenue:999n},attestation.signature));
 }finally{await vault.close();}
});
