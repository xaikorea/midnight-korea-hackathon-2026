const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Module=require('node:module'),assert=require('node:assert/strict'),crypto=require('node:crypto');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const root=fs.mkdtempSync(path.resolve('outputs/issuance-recovery-'));process.env.BIZPROOF_DATA_DIR=path.join(root,'web');
Object.assign(process.env,{BIZPROOF_PUBLIC_DEMO:'true',BIZPROOF_DEMO_AUTO_RUN:'true'});
const env=require('../lib/node-bindings.ts').env,load=Module._load;Module._load=function(id,...args){if(id==='cloudflare:workers')return {env};return load.call(this,id,...args);};
const {openIssuer}=require('../services/issuer/core.mjs'),protocol=require('../services/issuer/protocol.mjs'),service=openIssuer(path.join(root,'issuer'));
Object.assign(process.env,{BIZPROOF_ISSUER_URL:'http://127.0.0.1:12345',BIZPROOF_ISSUER_SERVICE_SECRET:'fixture-'.repeat(10),BIZPROOF_ISSUER_TRUST:JSON.stringify({issuerId:protocol.ISSUER_ID,keyId:service.metadata.keyId,publicKey:service.metadata.publicKey})});
const realFetch=global.fetch,RealDate=Date;let clock=RealDate.now(),fault='',decisionCalls=0;global.Date=class extends RealDate {constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
global.fetch=async(url,init)=>{const u=new URL(url),body=init.body?JSON.parse(init.body):null,auth=protocol.verifyAuthorization(process.env.BIZPROOF_ISSUER_SERVICE_SECRET,init.headers.Authorization.slice(9));service.consumeAuthorization(auth);
 if(fault==='offline')throw Error('offline fixture');
 if(u.pathname.endsWith('/decisions')){decisionCalls++;if(fault==='before'){fault='';throw Error('failed before commit');}}
 let value;try{value=service.handle(init.method,u.pathname,auth.scope,body,u.searchParams);}catch(e){return Response.json({error:e.message},{status:e.status??500});}
 if(fault==='after'&&u.pathname.endsWith('/decisions')){fault='';throw Error('lost committed response');}
 return Response.json(value);
};
let jobs=require('../lib/demo-issuance-jobs.ts');const {issuerScope}=require('../lib/remote-issuer.ts'),{readState}=require('../lib/store.ts');
const owner=()=> 'demo-'+crypto.randomUUID(),input=()=>({key:crypto.randomUUID(),documentHash:service.metadata.documentHash,consent:true});
async function start(who=owner()){const scope=await issuerScope(who,who);return {who,scope,job:await jobs.startDemoIssuanceJob(who,scope,input())};}
(async()=>{try{
 const a=await start();fault='before';let result=await jobs.processDemoIssuanceJob(a.job.id,a.who);assert.equal(result.autoJob.status,'retry');const id=result.autoJob.requestId;assert.ok(id);
 const calls=decisionCalls;delete require.cache[require.resolve('../lib/demo-issuance-jobs.ts')];jobs=require('../lib/demo-issuance-jobs.ts');clock+=16000;await jobs.recoverDemoIssuanceJobs();
 let stored=(await jobs.listDemoIssuanceJobs(a.who))[0];assert.equal(stored.status,'complete');assert.equal(stored.requestId,id);assert.equal(decisionCalls,calls+1);assert.equal((await readState(a.who)).state.credentialReceipts.length,1);
 const b=await start();fault='after';result=await jobs.processDemoIssuanceJob(b.job.id,b.who);assert.equal(result.autoJob.status,'retry');const afterCalls=decisionCalls;clock+=16000;await jobs.recoverDemoIssuanceJobs();assert.equal((await jobs.listDemoIssuanceJobs(b.who))[0].status,'complete');assert.equal(decisionCalls,afterCalls,'committed approval is not replayed');
 const c=await start();await Promise.all([jobs.processDemoIssuanceJob(c.job.id,c.who),jobs.processDemoIssuanceJob(c.job.id,c.who)]);assert.equal((await readState(c.who)).state.credentials.filter(v=>v.remoteBinding).length,1);
 const crashed=await start();fault='before';await jobs.processDemoIssuanceJob(crashed.job.id,crashed.who);stored=(await jobs.listDemoIssuanceJobs(crashed.who))[0];
 stored.status='running';stored.leaseUntil=clock+120000;await env.DB.prepare('UPDATE demo_issuance_jobs SET payload=? WHERE id=?').bind(JSON.stringify(stored),stored.id).run();
 await jobs.recoverDemoIssuanceJobs();assert.equal((await jobs.listDemoIssuanceJobs(crashed.who))[0].status,'running');
 clock+=120001;await jobs.recoverDemoIssuanceJobs();assert.equal((await jobs.listDemoIssuanceJobs(crashed.who))[0].status,'complete');assert.equal((await readState(crashed.who)).state.credentialReceipts.length,1);
 const d=await start();fault='before';result=await jobs.processDemoIssuanceJob(d.job.id,d.who);const r=service.handle('GET','/v1/issuance-requests/'+result.autoJob.requestId,d.scope,null);service.handle('POST','/v1/issuance-requests/'+r.id+'/decisions',d.scope,{key:crypto.randomUUID(),revision:r.revision,decision:'reject',reason:'fixture rejection'});clock+=16000;await jobs.recoverDemoIssuanceJobs();assert.equal((await jobs.listDemoIssuanceJobs(d.who))[0].status,'blocked');
 const e=await start();fault='offline';for(let n=0;n<6;n++){await jobs.processDemoIssuanceJob(e.job.id,e.who);stored=(await jobs.listDemoIssuanceJobs(e.who))[0];clock=stored.nextAttemptAt+1;}assert.equal(stored.status,'needs_attention');
 await assert.rejects(jobs.resumeDemoIssuanceJob(owner(),e.job.id));fault='';result=await jobs.resumeDemoIssuanceJob(e.who,e.job.id);assert.equal(result.autoJob.status,'complete');
 const f=await start();clock=f.job.expiresAt+1;assert.equal((await jobs.processDemoIssuanceJob(f.job.id,f.who)).autoJob.status,'blocked');
 process.env.BIZPROOF_DEMO_AUTO_RUN='false';await assert.rejects(jobs.processDemoIssuanceJob(c.job.id,c.who));process.env.BIZPROOF_DEMO_AUTO_RUN='true';
 await assert.rejects(jobs.startDemoIssuanceJob(a.who,a.scope,{...input(),consent:false}));await assert.rejects(jobs.startDemoIssuanceJob(a.who,a.scope,{...input(),documentHash:'0'.repeat(64)}));
 assert.ok(!JSON.stringify(jobs.publicDemoIssuanceJob(a.job)).includes(a.scope));
 console.log('PASS durable automatic issuance: restart recovery, failed/lost approval response, same request and credential, concurrent leases, rejection preserved, bounded retries, scoped resume, consent expiry and disabled mode.');
 }finally{global.Date=RealDate;global.fetch=realFetch;Module._load=load;service.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
