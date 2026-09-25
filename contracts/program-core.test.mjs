import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulator,signClaims,randomId} from './program-runtime.mjs';
import {pureCircuits} from './managed-program/contract/index.js';
const signed=(s,patch)=>{const c={...s.claims,...patch};return [c,signClaims(s.providerSecret,c,s.holder)];};
test('numeric core: revenue/year OR investment, residents, lower and upper founding bounds',()=>{
 const s=new Simulator(),policy={minRevenue:2000000000n,minInvestment:3000000000n,fiscalYear:2025n,requireFinance:true,minResidents:15n,minFoundedDay:18000n,maxFoundedDay:20700n,issuerId:1n};
 for(const revenue of [1999999999n,2000000000n])for(const investment of [2999999999n,3000000000n])for(const fiscalYear of [2024n,2025n])for(const plannedResidents of [14n,15n])for(const foundedDay of [17999n,18000n,20700n,20701n]){
  const claims={...s.claims,revenue,investment,fiscalYear,plannedResidents,foundedDay};
  const expected=((fiscalYear===2025n&&revenue>=2000000000n)||investment>=3000000000n)&&plannedResidents>=15n&&foundedDay>=18000n&&foundedDay<=20700n;
  assert.equal(pureCircuits.coreEligible(claims,policy),expected);
 }
});
test('request-bound signed aggregation: true, false, replay, signature, holder and company guards',()=>{
 const s=new Simulator(),id=s.request();assert.equal(s.submit(id),true);assert.throws(()=>s.submit(id),/Replay/);
 assert.equal(s.submit(s.request(),...signed(s,{investment:1n,revenue:1n})),false);
 assert.throws(()=>s.submit(s.request(),{...s.claims,investment:0n},s.signature),/assertion|signature|Schnorr/i);
 assert.throws(()=>s.submit(s.request(),...signed(s,{companyCommitment:randomId()})),/Company/);
 assert.throws(()=>s.submit(s.request(),s.claims,s.signature,randomId()),/holder/);
 assert.throws(()=>s.submit(s.request(),...signed(s,{issuedAt:s.now+1n})),/not yet/);
 assert.throws(()=>s.submit(s.request(),...signed(s,{expiresAt:s.now})),/expired/);
 assert.equal(s.submit(s.request({maxFoundedDay:s.claims.foundedDay-1n})),false,'future founding date produces a proved false result');
});
test('trusted ledger gates remain effective in the separate contract',()=>{
 const s=new Simulator(),id=s.request();s.invoke('cancelRequest',[id]);assert.throws(()=>s.submit(id),/Cancelled/);
 const next=s.request();s.invoke('suspendIssuer',[1n]);assert.throws(()=>s.submit(next),/suspended/);s.invoke('resumeIssuer',[1n]);s.invoke('revokeCredential',[s.claims.credentialId]);assert.throws(()=>s.submit(next),/revoked/);
 const other=new Simulator(),expired=other.request();other.invoke('advanceTime',[other.now+86400n]);assert.throws(()=>other.submit(expired),/Request expired/);
 assert.throws(()=>new Simulator().request({minFoundedDay:10n,maxFoundedDay:9n}),/founding/);
});
