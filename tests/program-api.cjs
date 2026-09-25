const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict'),Module=require('node:module');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
(async()=>{
 let state={companies:[],audit:[]},version=0,role='company',actor='alice',mode='demo',authenticated=true,allowAccess=true,scanStatus='clean',scanDown=false,organization='org-a';const files=new Map();
 const env={BUCKET:{put:async(key,body,options)=>files.set(key,{body,customMetadata:options?.customMetadata}),delete:async key=>files.delete(key),get:async key=>{const v=files.get(key);return v?{arrayBuffer:async()=>typeof v.body==='string'?new TextEncoder().encode(v.body).buffer:v.body,customMetadata:v.customMetadata}:null;}}};
 const original=Module._load,nativeFetch=global.fetch,priorPilot=process.env.BIZPROOF_PROGRAM_PILOT,priorAssignments=process.env.BIZPROOF_PROGRAM_REVIEWERS;
 Module._load=function(id,parent,...rest){if(id==='cloudflare:workers')return {env};if(id==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>authenticated?{userId:actor,storageOwner:'room',authMode:mode,organization}:null,getActiveRole:async()=>role};if(id==='./store'&&parent.filename.endsWith('program-http.ts'))return {readState:async()=>({state:structuredClone(state),version}),saveState:async(owner,s,v)=>{assert.equal(v,version);state=s;version++;},ConflictError:class extends Error{}};if(id.startsWith('@/'))id=path.resolve(id.slice(2))+'.ts';return original.call(this,id,parent,...rest);};
 global.fetch=async(url,init)=>{if(String(url).endsWith('/check'))return Response.json({allowed:allowAccess});if(scanDown)throw Error('offline');const sha256=Buffer.from(await crypto.subtle.digest('SHA-256',init.body)).toString('hex');return Response.json({status:scanStatus,sha256,engine:'ClamAV fixture',databaseVersion:'1234',databaseUpdatedAt:new Date().toISOString(),scannedAt:new Date().toISOString()});};
 try{
  const api=require('../lib/program-http.ts'),{syntheticProgramPdf}=require('../lib/program-documents.ts');
  const req=(body,origin='http://localhost')=>new Request('http://localhost/api/programs',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
  const invoke=async(fn,...args)=>{try{return await fn(...args);}catch(e){return api.programFailure(e);}};
  const post=async(fn,body,status=200,...args)=>{const r=await invoke(fn,req(body),...args),v=await r.json();assert.equal(r.status,status,JSON.stringify(v));return v;};
  authenticated=false;assert.equal((await invoke(api.getPrograms,new Request('http://localhost'))).status,401);authenticated=true;
  assert.equal((await invoke(api.preparePrograms,req({scenario:'normal'},'https://foreign.invalid'))).status,403);
  const prepared=await post(api.preparePrograms,{scenario:'normal'});const companyId=prepared.companyId;
  const preview=await post(api.precheckPrograms,{companyId},200,'seongsu-2026-h2');
  const saved=await post(api.createProgramApplication,{consent:preview.consent,confirmed:true});
  assert.equal((await post(api.createProgramApplication,{consent:preview.consent,confirmed:true})).id,saved.id);
  actor='bob';await post(api.createProgramApplication,{consent:preview.consent,confirmed:true},403);assert.equal((await invoke(api.packageProgram,new Request('http://localhost'),saved.id)).status,403);actor='alice';
  const list=await (await api.getPrograms(new Request('http://localhost'))).json();assert.equal(list.profiles.length,6);assert.ok(!JSON.stringify(list).includes('privateKey'));assert.ok(!JSON.stringify(list).includes('"facts":'));

  const manual=saved.precheck.checks.find(c=>c.outcome==='manual_review'),review={revision:0,ruleId:manual.id,decision:'confirmed',reason:'Synthetic documents reviewed for this internal preparation.',evidenceIds:[saved.precheck.documents[0].id]};
  await post(api.reviewPrograms,review,403,saved.id);role='buyer';await post(api.reviewPrograms,review,403,saved.id);role='grant';
  await post(api.reviewPrograms,{...review,evidenceIds:[crypto.randomUUID()]},422,saved.id);await post(api.reviewPrograms,review,200,saved.id);await post(api.reviewPrograms,review,409,saved.id);
  role='company';const packageResponse=await api.packageProgram(new Request('http://localhost'),saved.id),manifest=await packageResponse.json();assert.equal(manifest.externalReceipt,null);assert.equal(manifest.current.unchanged,true);assert.ok(!JSON.stringify(manifest).includes('privateKey'));assert.ok(!JSON.stringify(manifest).includes('"facts":'));
  const {verification,...payload}=manifest;assert.equal(await require('../lib/signatures.ts').verify(verification.publicKey,{context:verification.context,payload},verification.signature),true);
  const d=manifest.documents[0];const download=await api.downloadProgramDocument(new Request('http://localhost'),d.id);assert.equal(download.headers.get('X-Content-Type-Options'),'nosniff');assert.equal((await download.arrayBuffer()).byteLength>100,true);
  assert.equal((await invoke(api.uploadProgramDocument,req({}))).status,403);
  mode='keycloak';process.env.BIZPROOF_PROGRAM_PILOT='true';env.BIZPROOF_ACCESS_CONTROL='openfga';env.OPENFGA_URL='http://127.0.0.1:18380';env.OPENFGA_STORE_ID='01ARZ3NDEKTSV4RRFFQ69G5FAV';env.OPENFGA_MODEL_ID='01ARZ3NDEKTSV4RRFFQ69G5FAW';env.BIZPROOF_MALWARE_SCAN='clamav';env.CLAMAV_BRIDGE_URL='http://127.0.0.1:4012';env.CLAMAV_BRIDGE_TOKEN='x'.repeat(32);
  await post(api.preparePrograms,{scenario:'normal'},403);
  allowAccess=false;await post(api.precheckPrograms,{companyId},403,'seongsu-2026-h2');assert.equal((await invoke(api.downloadProgramDocument,new Request('http://localhost'),d.id)).status,403);allowAccess=true;
  role='grant';await post(api.reviewPrograms,{...review,revision:1},403,saved.id);process.env.BIZPROOF_PROGRAM_REVIEWERS=JSON.stringify([{actor:'alice',organization:'org-a',profileId:'seongsu-2026-h2'}]);organization='org-b';assert.equal((await (await api.getPrograms(new Request('http://localhost'))).json()).applications.length,0);await post(api.reviewPrograms,{...review,revision:1},403,saved.id);organization='org-a';assert.equal((await (await api.getPrograms(new Request('http://localhost'))).json()).applications.length,1);await post(api.reviewPrograms,{...review,revision:1},200,saved.id);
  role='company';const pdf=await syntheticProgramPdf('pilot','ir',1),large=new Uint8Array(3*1024*1024).fill(32);large.set(new Uint8Array(pdf));
  const upload=bytes=>invoke(api.uploadProgramDocument,new Request('http://localhost/api/program-documents?profileId=seongsu-2026-h2&companyId='+companyId+'&type=ir',{method:'POST',headers:{origin:'http://localhost','content-type':'application/pdf'},body:bytes}));
  const originalCount=files.size;scanStatus='infected';assert.equal((await upload(large.buffer)).status,422);assert.equal(files.size,originalCount);scanStatus='clean';scanDown=true;assert.equal((await upload(pdf)).status,503);assert.equal(files.size,originalCount);scanDown=false;
  assert.equal((await upload(await syntheticProgramPdf('pilot','ir',11))).status,422);assert.equal(files.size,originalCount);
  const valid=await upload(large.buffer);assert.equal(valid.status,200,await valid.clone().text());assert.equal(files.size,originalCount+1);const uploaded=await valid.json();const downloaded=await api.downloadProgramDocument(new Request('http://localhost'),uploaded.id);assert.equal((await downloaded.arrayBuffer()).byteLength,large.byteLength);
  scanStatus='infected';assert.equal((await invoke(api.downloadProgramDocument,new Request('http://localhost'),uploaded.id)).status,422);
  console.log('PASS program APIs: authentication/origin, actor-bound consent, duplicate submission, role/org/company ACLs, review revision, signed manifest privacy, synthetic download, pilot PDF >2MB/page cap, malware outage/infection before persistence and on download.');
 }finally{Module._load=original;global.fetch=nativeFetch;if(priorPilot===undefined)delete process.env.BIZPROOF_PROGRAM_PILOT;else process.env.BIZPROOF_PROGRAM_PILOT=priorPilot;if(priorAssignments===undefined)delete process.env.BIZPROOF_PROGRAM_REVIEWERS;else process.env.BIZPROOF_PROGRAM_REVIEWERS=priorAssignments;}
})().catch(e=>{console.error(e);process.exitCode=1;});
