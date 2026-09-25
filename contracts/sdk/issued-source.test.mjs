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
 // New request snapshots preserve submission time while consent uses the current job clock.
 const datedOriginal=structuredClone(original);datedOriginal.claims.foundedOn='2019-09-03';datedOriginal.signature=signWith(issuerKey.privateKey,originalPayload(datedOriginal));
 const datedRequests=structuredClone(requests);
 for(const r of datedRequests){Object.assign(r.policy,{minRevenue:null,maxRevenue:null,maxAgeMonths:84,ageReferenceDate:'2026-09-03',ageComparison:r.policy.kind==='buyer'?'lte':'lt',sourceUrl:'https://example.com/policy',sourceVersion:'synthetic boundary fixture'});r.policyHash=await sourceHash(r.policy);r.evaluationAt=iso;}
 const datedBinding=await deriveIssuedBinding(datedOriginal,datedRequests,now,target,now,now+5400);
 const foundedDay=Math.floor(Date.parse(datedOriginal.claims.foundedOn)/864e5);
 assert.equal(datedBinding.requests[0].policy.minFoundedDay,foundedDay);
 assert.equal(datedBinding.requests[1].policy.minFoundedDay,foundedDay+1);
 const datedBody={...body,original:datedOriginal,originalRequests:datedRequests,binding:datedBinding};
 await verifyIssuedSource({body:datedBody,signature:signWith(platformKey.privateKey,datedBody)},pins,expected);
 const notYetFounded={...datedOriginal,claims:{...datedOriginal.claims,foundedOn:'2026-09-04'}};
 await assert.rejects(deriveIssuedBinding(notYetFounded,datedRequests,now,target,now,now+5400),/기준일 이후/);
 const futureEvaluation=structuredClone(datedBody);futureEvaluation.originalRequests[0].evaluationAt=new Date((now+1)*1000).toISOString();
 await assert.rejects(verifyIssuedSource({body:futureEvaluation,signature:signWith(platformKey.privateKey,futureEvaluation)},pins,expected),/Original policy/);
 const moved=structuredClone(datedBody);moved.originalRequests[1].policy.ageReferenceDate='2026-09-02';moved.originalRequests[1].policyHash=await sourceHash(moved.originalRequests[1].policy);
 await assert.rejects(verifyIssuedSource({body:moved,signature:signWith(platformKey.privateKey,moved)},pins,expected),/Converted/);
 // Rolling legacy policy also freezes at the signed evaluation time for new jobs.
 const rolling=structuredClone(requests);for(const r of rolling){r.createdAt='2026-09-03T00:00:00.000Z';r.evaluationAt=r.createdAt;r.policy.maxAgeMonths=84;r.policyHash=await sourceHash(r.policy);}
 const start=Date.parse('2026-09-03T00:00:00Z')/1000,end=Date.parse('2026-09-25T00:00:00Z')/1000;
 const early=await deriveIssuedBinding(datedOriginal,rolling,start,target,now,now+5400),late=await deriveIssuedBinding(datedOriginal,rolling,end,target,now,now+5400);
 assert.equal(early.requests[0].policy.minFoundedDay,late.requests[0].policy.minFoundedDay);
 await assert.rejects(verifyIssuedSource(envelope,{...pins,platform:{...pins.platform,publicKey:pins.issuer.publicKey}},expected));
 const changed=structuredClone(envelope);changed.body.binding.requests[0].policy.minRevenue=1;changed.signature=signWith(platformKey.privateKey,changed.body);await assert.rejects(verifyIssuedSource(changed,pins,expected),/Converted/);
 await mkdir('outputs',{recursive:true});const dir=await mkdtemp(resolve('outputs/issued-vault-')),vault=new IssuerVault({network:'undeployed',accountId:'issued-test',storageDirectory:dir,passwordProvider:()=> 'Local!Synthetic_Only_123'},target.contractAddress);
 try{const registered=await vault.create(3n);sim.invoke('registerIssuer',[3n,registered.publicKey]);const att=await vault.issue(3n,{credentialId:Buffer.from(b.source.digest,'hex'),revenue:BigInt(b.claims.revenue),foundedDay:BigInt(b.claims.foundedDay),region:BigInt(b.claims.region),certified:b.claims.certified,expiresAt:BigInt(now+5400)},sim.holder);
 for(const r of b.requests){const policy={issuerId:3n,...Object.fromEntries(Object.entries(r.policy).map(([k,v])=>[k,typeof v==='number'?BigInt(v):v]))};assert.equal(sim.submit(sim.request(policy),att.claims,att.signature),r.kind==='buyer');}
 const datedAtt=await vault.issue(3n,{credentialId:Buffer.from(datedBinding.source.digest,'hex'),revenue:BigInt(datedBinding.claims.revenue),foundedDay:BigInt(foundedDay),region:BigInt(datedBinding.claims.region),certified:true,expiresAt:BigInt(now+5400)},sim.holder);
 for(const r of datedBinding.requests){const policy={issuerId:3n,...Object.fromEntries(Object.entries(r.policy).map(([k,v])=>[k,typeof v==='number'?BigInt(v):v]))};assert.equal(sim.submit(sim.request(policy),datedAtt.claims,datedAtt.signature),r.kind==='buyer');}
 sim.invoke('revokeCredential',[Buffer.from(b.source.digest,'hex')]);assert.throws(()=>sim.submit(sim.request({issuerId:3n}),att.claims,att.signature),/revoked/);
 }finally{await vault.close();}
});
