import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceCanonical} from './web-source.ts';
import {verifyProgramNumericSource} from './program-source.ts';
import {Simulator,signClaims,randomId} from '../program-runtime.mjs';
const payload=c=>({context:'bizproof:program-credential:1',body:Object.fromEntries(Object.entries(c).filter(([k])=>!['signature','status'].includes(k)))});
async function signer(){const keys=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);return {publicKey:await crypto.subtle.exportKey('jwk',keys.publicKey),sign:async b=>Buffer.from(await crypto.subtle.sign('Ed25519',keys.privateKey,new TextEncoder().encode(sourceCanonical(b)))).toString('base64')};}
test('independent program signatures become request/company-bound numeric Compact attestation',async()=>{
 const sim=new Simulator(),now=Number(sim.now),platform=await signer(),first=await signer(),second=await signer();
 const doc={id:'synthetic-evidence',sha256:'a'.repeat(64)},originals=[];
 for(const [index,key,facts] of [[1,first,{registered:true,foundedOn:'2023-03-01'}],[2,second,{revenueKrw:1000000000,fiscalYear:2025,investmentKrw:3400000000,plannedResidents:17}]]){const c={id:'credential-'+index,schemaVersion:'bizproof:program-facts:1',companyId:'synthetic-company',registration:'DEMO-001',issuerId:'issuer-'+index,keyId:'key-'+index,facts,evidence:[doc],issuedAt:new Date((now-100)*1000).toISOString(),expiresAt:new Date((now+86400)*1000).toISOString(),status:'active',source:'synthetic',signature:''};c.signature=await key.sign(payload(c));originals.push(c);}
 const pins={platform:platform.publicKey,issuers:[{issuerId:'issuer-1',keyId:'key-1',publicKey:first.publicKey,facts:['registered','foundedOn'],active:true},{issuerId:'issuer-2',keyId:'key-2',publicKey:second.publicKey,facts:['revenueKrw','fiscalYear','investmentKrw','plannedResidents'],active:true}]};
 const policy={minRevenue:2000000000,minInvestment:3000000000,fiscalYear:2025,requireFinance:true,minResidents:15,minFoundedDay:0,maxFoundedDay:4294967295,issuerId:1};
 const body={context:'bizproof:program-numeric-source:1',network:'undeployed',applicationId:'application-fixture',companyId:'synthetic-company',registration:'DEMO-001',actor:'fixture-actor',profileId:'ai-hub-2026-leading',profileHash:'b'.repeat(64),nonce:'c'.repeat(64),holder:Buffer.from(sim.holder).toString('hex'),contractAddress:'d'.repeat(64),issuedAt:now,expiresAt:now+300,policy,originals,documents:[doc],coverage:['finance-or','residents'],fullEligibility:false};
 const envelope={body,signature:await platform.sign(body)},current=async()=>'active',verified=await verifyProgramNumericSource(envelope,pins,body,current,now);assert.equal(verified.fullEligibility,false);
 const requestId=randomId(),numericPolicy=Object.fromEntries(Object.entries(policy).map(([k,v])=>[k,typeof v==='number'?BigInt(v):v]));
 sim.invoke('createRequest',[requestId,{holder:sim.holder,audience:randomId(),nonce:Buffer.from(body.nonce,'hex'),companyCommitment:verified.claims.companyCommitment,profileDigest:Buffer.from(body.profileHash,'hex'),policy:numericPolicy,deadline:BigInt(now+300)}]);
 const signature=signClaims(sim.providerSecret,verified.claims,sim.holder);assert.equal(sim.submit(requestId,verified.claims,signature),true);assert.throws(()=>sim.submit(requestId,verified.claims,signature),/Replay/);
 await assert.rejects(verifyProgramNumericSource(envelope,pins,{...body,actor:'other'},current,now));await assert.rejects(verifyProgramNumericSource(envelope,pins,{...body,policy:{...policy,minRevenue:0}},current,now));
 await assert.rejects(verifyProgramNumericSource(envelope,pins,body,async()=> 'revoked',now));await assert.rejects(verifyProgramNumericSource(envelope,pins,body,async()=> 'unknown',now));await assert.rejects(verifyProgramNumericSource(envelope,pins,body,current,now+301));
 const resigned=async b=>({body:b,signature:await platform.sign(b)});
 const tampered=structuredClone(body);tampered.originals[1].facts.investmentKrw=9999999999;await assert.rejects(verifyProgramNumericSource(await resigned(tampered),pins,body,current,now),'platform signature cannot replace original issuer signature');
 const mixed=structuredClone(body);mixed.originals[0].companyId='other-company';mixed.originals[0].signature=await first.sign(payload(mixed.originals[0]));await assert.rejects(verifyProgramNumericSource(await resigned(mixed),pins,body,current,now));
 const missing=structuredClone(body);delete missing.originals[1].facts.investmentKrw;missing.originals[1].signature=await second.sign(payload(missing.originals[1]));await assert.rejects(verifyProgramNumericSource(await resigned(missing),pins,body,current,now));
 const untrusted=structuredClone(pins);untrusted.issuers[1].facts=['foundedOn'];await assert.rejects(verifyProgramNumericSource(envelope,untrusted,body,current,now));
 const sameDataNewTarget={...body,contractAddress:'e'.repeat(64)};await assert.rejects(verifyProgramNumericSource(envelope,pins,sameDataNewTarget,current,now));
});
