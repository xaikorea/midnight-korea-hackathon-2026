import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,randomUUID} from 'node:crypto';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {sourceCanonical} from './web-source.ts';
import {deriveIssuedBinding,originalPayload,sourceHash,verifyIssuedSource} from './issued-source.ts';
import {IssuerVault} from './issuer.ts';
import {Simulator} from '../runtime.mjs';
test('remote issuer original and platform job use separate keys and bind actual Compact proofs',async()=>{
 const issuerKey=generateKeyPairSync('ed25519'),platformKey=generateKeyPairSync('ed25519'),now=Math.floor(Date.now()/1000),iso=new Date(now*1000).toISOString();
 const signWith=(key,body)=>sign(null,Buffer.from(sourceCanonical(body)),key).toString('base64');
 const original={id:'remote-'+randomUUID(),proofVersion:3,companyId:'issuer-demo-company',issuerId:'issuer-independent-demo',schemaId:'business-v1',remoteBinding:{requestId:randomUUID(),scope:'e'.repeat(64),identitySessionId:randomUUID(),identityMode:'simulated',documentHash:'d'.repeat(64)},claims:{revenue:300000000,foundedOn:'2025-02-01',region:'서울',certified:true},issuedAt:iso,expiresAt:new Date((now+86400)*1000).toISOString(),keyId:'issuer',status:'active',source:{kind:'synthetic',reference:'fixture',period:'fixture',method:'synthetic',reviewer:'fixture',reviewedAt:iso,documents:[],notice:'synthetic unit fixture'},signature:''};original.signature=signWith(issuerKey.privateKey,originalPayload(original));
 const requests=[];for(const kind of ['buyer','grant']){const policy={id:kind,name:kind,audience:kind,kind,version:1,minRevenue:kind==='buyer'?200000000:null,maxRevenue:kind==='grant'?100000000:null,maxAgeMonths:null,region:null,requireCertification:false,issuerIds:[original.issuerId],createdAt:iso,status:'active'};requests.push({id:randomUUID(),companyId:original.companyId,policyId:kind,policyHash:await sourceHash(policy),policy,nonce:randomUUID(),createdAt:iso,expiresAt:new Date((now+86400)*1000).toISOString()});}
 const sim=new Simulator(),target={contractAddress:'a'.repeat(64),holder:Buffer.from(sim.holder).toString('hex')},jobId=randomUUID(),body={context:'bizproof:midnight:issued-source:v2',jobId,keyId:'platform',scope:original.remoteBinding.scope,referenceTime:now,consentExpiresAt:now+5400,original,originalRequests:requests,binding:await deriveIssuedBinding(original,requests,now,target,now,now+5400)},envelope={body,signature:signWith(platformKey.privateKey,body)},pins={platform:{keyId:'platform',publicKey:platformKey.publicKey.export({format:'jwk'})},issuer:{issuerId:original.issuerId,keyId:'issuer',publicKey:issuerKey.publicKey.export({format:'jwk'})}},expected={jobId,scope:body.scope,...target};
 const checked=await verifyIssuedSource(envelope,pins,expected),b=checked.binding;
 await assert.rejects(verifyIssuedSource(envelope,{...pins,platform:{...pins.platform,publicKey:pins.issuer.publicKey}},expected));
 const changed=structuredClone(envelope);changed.body.binding.requests[0].policy.minRevenue=1;changed.signature=signWith(platformKey.privateKey,changed.body);await assert.rejects(verifyIssuedSource(changed,pins,expected),/Converted/);
 await mkdir('outputs',{recursive:true});const dir=await mkdtemp(resolve('outputs/issued-vault-')),vault=new IssuerVault({network:'undeployed',accountId:'issued-test',storageDirectory:dir,passwordProvider:()=> 'Local!Synthetic_Only_123'},target.contractAddress);
 try{const registered=await vault.create(3n);sim.invoke('registerIssuer',[3n,registered.publicKey]);const att=await vault.issue(3n,{credentialId:Buffer.from(b.source.digest,'hex'),revenue:BigInt(b.claims.revenue),foundedDay:BigInt(b.claims.foundedDay),region:BigInt(b.claims.region),certified:b.claims.certified,expiresAt:BigInt(now+5400)},sim.holder);
 for(const r of b.requests){const policy={issuerId:3n,...Object.fromEntries(Object.entries(r.policy).map(([k,v])=>[k,typeof v==='number'?BigInt(v):v]))};assert.equal(sim.submit(sim.request(policy),att.claims,att.signature),r.kind==='buyer');}
 sim.invoke('revokeCredential',[Buffer.from(b.source.digest,'hex')]);assert.throws(()=>sim.submit(sim.request({issuerId:3n}),att.claims,att.signature),/revoked/);
 }finally{await vault.close();}
});
