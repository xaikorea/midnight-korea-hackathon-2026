const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {launchIdentity,redirectSession}=require('../lib/identity-browser.ts');
const session={id:crypto.randomUUID(),status:'pending',expiresAt:Date.now()+600000,documentHash:'a'.repeat(64),documentSigned:false};
const launch={identityVerificationId:'bizproof-'+session.id,storeId:'test-store',channelKey:'test-channel',customData:'test-only'};
(async()=>{
 let checked=0;
 const check=async id=>{assert.equal(id,session.id);checked++;return {...session,status:'pending'};};
 const sdk={requestIdentityVerification:async input=>{assert.equal(input.redirectUrl,'https://pilot.example.test/identity-pilot');return {identityVerificationId:launch.identityVerificationId};}};
 assert.equal((await launchIdentity(sdk,session,launch,'https://pilot.example.test',check)).status,'pending','SDK success cannot mark verified');
 assert.equal(checked,1);
 assert.equal((await launchIdentity({requestIdentityVerification:async()=>({code:'CANCELLED'})},session,launch,'https://pilot.example.test',check)).status,'pending','SDK error also reconciles server result');
 await assert.rejects(launchIdentity({requestIdentityVerification:async()=>({identityVerificationId:'another'})},session,launch,'https://pilot.example.test',check));
 await assert.rejects(launchIdentity(sdk,session,launch,'http://untrusted.test',check));
 assert.equal(redirectSession('https://pilot.example.test/identity-pilot?identityVerificationId='+launch.identityVerificationId,session),session.id);
 assert.throws(()=>redirectSession('https://pilot.example.test/identity-pilot?identityVerificationId=forged',session));
 assert.throws(()=>redirectSession('https://pilot.example.test/identity-pilot?identityVerificationId='+launch.identityVerificationId,{...session,expiresAt:0}));
 console.log('PASS identity browser contract: server truth, SDK cancellation, original transaction binding, HTTPS callback, expired/forged redirect; no provider account used.');
})().catch(e=>{console.error(e);process.exitCode=1;});
