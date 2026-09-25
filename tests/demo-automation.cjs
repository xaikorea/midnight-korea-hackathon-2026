// Real isolated SQLite and synthetic files. No network, real identities or chain transactions.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict'),Module=require('node:module'),crypto=require('node:crypto');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
fs.mkdirSync('outputs',{recursive:true});process.env.BIZPROOF_DATA_DIR=fs.mkdtempSync(path.resolve('outputs/demo-automation-'));
Object.assign(process.env,{BIZPROOF_PUBLIC_DEMO:'true',BIZPROOF_DEMO_AUTO_RUN:'true',BIZPROOF_APP_ORIGIN:'http://localhost'});
const env=require('../lib/node-bindings.ts').env,load=Module._load;
let actor='demo-'+crypto.randomUUID(),owner=actor,mode='demo',role='company',authenticated=true;
Module._load=function(id,parent,...rest){if(id==='cloudflare:workers')return {env};if(id==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>authenticated?{userId:actor,storageOwner:owner,authMode:mode}:null,getActiveRole:async()=>role};if(id.startsWith('@/'))id=path.resolve(id.slice(2))+'.ts';return load.call(this,id,parent,...rest);};
const pair=crypto.generateKeyPairSync('ed25519');process.env.BIZPROOF_PROCESSING_KEY=JSON.stringify({keyId:'test',publicKey:pair.publicKey.export({format:'jwk'}),privateKey:pair.privateKey.export({format:'jwk'})});
const {POST}=require('../app/api/program-demo/route.ts'),jobs=require('../lib/program-proof-jobs.ts'),store=require('../lib/store.ts');
const input={profileId:'ai-hub-2026-leading',scenario:'normal',consent:true,scope:'synthetic-preparation-and-local-devnet-90-minutes'};
async function post(body=input,origin='http://localhost'){const r=await POST(new Request('http://localhost/api/program-demo',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)}));return {status:r.status,body:await r.json()};}
(async()=>{try{
 authenticated=false;assert.equal((await post()).status,401);authenticated=true;
 assert.equal((await post(input,'https://other.invalid')).status,403);
 assert.equal((await post({...input,consent:false})).status,400);
 assert.equal((await post({...input,scope:'different'})).status,400);
 mode='keycloak';assert.equal((await post()).status,403);mode='demo';
 role='buyer';assert.equal((await post()).status,403);role='company';
 owner='demo-'+crypto.randomUUID();assert.equal((await post()).status,403);owner=actor;
 process.env.BIZPROOF_PUBLIC_DEMO='false';assert.equal((await post()).status,403);process.env.BIZPROOF_PUBLIC_DEMO='true';
 process.env.BIZPROOF_DEMO_AUTO_RUN='false';assert.equal((await post()).status,403);process.env.BIZPROOF_DEMO_AUTO_RUN='true';
 const first=await post();assert.equal(first.status,200,JSON.stringify(first.body));assert.equal(first.body.job.status,'queued');assert.equal(first.body.job.approvalMode,'automatic-synthetic');assert.equal(first.body.job.officialReceipt,null);
 assert.ok(first.body.precheck.checks.some(c=>c.outcome==='manual_review'),'actual institutional review is not fabricated');
 const again=await post();assert.equal(again.body.application.id,first.body.application.id);assert.equal(again.body.job.id,first.body.job.id);
 const claim=await jobs.programWorkerCommand('fixture',{action:'claim',id:first.body.job.id});assert.ok(claim.lease);assert.equal((await jobs.getProgramJob(first.body.job.id)).status,'running');
 // A process failure remains an exception, never automatic success or an unsafe replay.
 await jobs.programWorkerCommand('fixture',{action:'failed',id:first.body.job.id,lease:claim.lease});
 assert.equal((await jobs.getProgramJob(first.body.job.id)).status,'needs_attention');assert.equal((await post()).body.job.status,'needs_attention');
 const negative=await post({...input,scenario:'negative'});assert.ok(negative.body.precheck.checks.some(c=>c.outcome==='fail'));assert.equal(negative.body.job.status,'queued');
 const s=await store.readState(owner);assert.equal(s.state.programData.applications.length,2);assert.equal(s.state.programData.documents.length,26);
 const credential=s.state.programData.credentials.find(c=>c.companyId===first.body.companyId);credential.status='revoked';await store.saveState(owner,s.state,s.version);
 await assert.rejects(jobs.requestProgramJob(owner,actor,first.body.application.id));
 assert.ok(!JSON.stringify(first.body).includes('privateKey'));assert.ok(!JSON.stringify(first.body).includes('"facts":'));
 console.log('PASS demo automation: opt-in and public-only gates, identity/role/origin/consent, real synthetic files, automatic queue, duplicate recovery, negative/manual results preserved, worker failure stops, revoked original rejected.');
 }finally{Module._load=load;}})().catch(e=>{console.error(e);process.exitCode=1;});
