const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
(async()=>{const {seedState}=require('../lib/seed.ts'),{exportMidnightSource,checkMidnightSource}=require('../lib/midnight-source.ts'),{verifyWebSource}=require('../contracts/sdk/web-source.ts'),{digest,makeKeys}=require('../lib/signatures.ts'),{credentialPayload}=require('../lib/domain.ts');
 const state=await seedState(),c=state.credentials[0],binding={network:'undeployed',contractAddress:'a'.repeat(64),holder:'b'.repeat(64),requests:[]};
 for(const policy of state.policies.slice(0,2)){const r={id:'r-'+policy.kind,companyId:c.companyId,policyHash:await digest(policy),policy,nonce:crypto.randomUUID(),status:'pending',expiresAt:new Date(Date.now()+3600000).toISOString()};state.requests.push(r);binding.requests.push({id:r.id});}
 const envelope=await exportMidnightSource(state,c,binding,'alice',false),key=state.issuers[0].publicKey,b=await verifyWebSource(envelope,key,binding);
 assert.equal(b.source.digest,await digest(credentialPayload(c)));assert.equal(b.claims.revenue,c.claims.revenue);assert.equal(b.requests.length,2);assert.equal((await checkMidnightSource(state,envelope,'alice',false)).current,true);
 for(const field of ['holder','contractAddress','network'])await assert.rejects(verifyWebSource(envelope,key,{...binding,[field]:'different'}));
 await assert.rejects(verifyWebSource(envelope,(await makeKeys()).publicKey,binding));await assert.rejects(verifyWebSource(envelope,key,binding,b.expiresAt));
 const tampered=structuredClone(envelope);tampered.body.claims.revenue++;await assert.rejects(verifyWebSource(tampered,key,binding));
 await assert.rejects(exportMidnightSource(state,c,binding,'alice',true),/검토/);
 state.requests[0].status='cancelled';await assert.rejects(checkMidnightSource(state,envelope,'alice',false));state.requests[0].status='pending';c.status='revoked';await assert.rejects(checkMidnightSource(state,envelope,'alice',false));c.status='active';
 binding.requests=[binding.requests[0],binding.requests[0]];await assert.rejects(exportMidnightSource(state,c,binding,'alice',false));
 console.log('PASS web-to-Midnight source: same signed credential digest and claims, two policies, trusted key, tamper/target/expiry rejection, current revocation/cancellation checks');
})().catch(e=>{console.error(e);process.exit(1)});
