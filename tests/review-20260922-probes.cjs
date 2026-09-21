const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('node:assert/strict'),Module=require('module');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
(async()=>{const {seedState}=require('../lib/seed.ts'),{sign}=require('../lib/signatures.ts'),{credentialPayload}=require('../lib/domain.ts');let state=await seedState(),version=0,role='company',actor='alice',mode='demo',write=true,offline=false;const env={};const original=Module._load,nativeFetch=global.fetch;
Module._load=function(id,...rest){if(id==='cloudflare:workers')return {env};if(id==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>({userId:actor,storageOwner:'room',allowedRoles:[role],displayName:actor,authMode:mode})};if(id==='next/headers')return {cookies:async()=>({get:()=>({value:role})})};if(id==='@/lib/store')return {readState:async()=>({state:structuredClone(state),version}),saveState:async(_owner,s)=>{state=s;version++},ConflictError:class extends Error{}};if(id.startsWith('@/'))id=path.resolve(id.slice(2))+'.ts';return original.call(this,id,...rest);};
try{const api=require('../app/api/platform/route.ts');async function post(action,data={},status=200){const r=await api.POST(new Request('http://localhost/api/platform',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({action,...data})}));const v=await r.json();assert.equal(r.status,status,JSON.stringify(v));return v;}


const {applicationStatus,applicationStatusCopy}=require('../lib/application-status.ts');
const choice={companyId:'hanbit',policyId:'vendor-standard'};
let preview=await post('prepare-application',choice);const originalInput={...choice,key:crypto.randomUUID(),previewHash:preview.previewHash,consent:true};const submitted=await post('submit-application',originalInput);assert.equal(submitted.status,'submitted');
const NativeDate=Date,future=NativeDate.now()+16*60*1000;global.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[future]))}static now(){return future}};
try{
 role='buyer';await post('verify-presentation',{id:submitted.presentationId},422);role='company';
 const oldReplay=await post('submit-application',originalInput);assert.equal(oldReplay.status,'expired');assert.match(oldReplay.message,/만료/);
 preview=await post('prepare-application',choice);const renewedInput={...choice,key:crypto.randomUUID(),previewHash:preview.previewHash,consent:true};
 await post('submit-application',{...renewedInput,consent:false},400);const renewed=await post('submit-application',renewedInput);assert.equal(renewed.status,'submitted');assert.notEqual(renewed.requestId,submitted.requestId);
 const old=state.requests.find(r=>r.id===submitted.requestId),fresh=state.requests.find(r=>r.id===renewed.requestId);assert.equal(old.status,'expired');assert.notEqual(fresh.nonce,old.nonce);assert.notEqual(renewed.presentationId,submitted.presentationId);
 const count=state.presentations.length;assert.equal((await post('submit-application',renewedInput)).requestId,renewed.requestId);assert.equal(state.presentations.length,count);await post('submit-application',{...renewedInput,key:crypto.randomUUID()},409);
 role='buyer';await post('verify-presentation',{id:submitted.presentationId},409);role='company';await post('cancel-request',{id:renewed.requestId});const replay=await post('submit-application',renewedInput);assert.equal(replay.status,'cancelled');assert.match(replay.message,/취소/);assert.doesNotMatch(replay.message,/검증을 완료/);
 assert.equal(applicationStatusCopy('cancelled').tone,'warning');assert.equal(applicationStatusCopy('expired').tone,'warning');assert.equal(applicationStatusCopy('nonsense').tone,'warning');assert.equal(applicationStatusCopy('submitted').tone,'pending');assert.equal(applicationStatusCopy('verified').tone,'success');
 assert.equal(applicationStatus({...fresh,status:'verified'},state.presentations.find(p=>p.id===renewed.presentationId),future+864e5),'verified');
}finally{global.Date=NativeDate}
state=await seedState();mode='keycloak';role='company';actor='alice';Object.assign(env,{BIZPROOF_ACCESS_CONTROL:'openfga',OPENFGA_URL:'http://127.0.0.1:18380',OPENFGA_STORE_ID:'01ARZ3NDEKTSV4RRFFQ69G5FAV',OPENFGA_MODEL_ID:'01ARZ3NDEKTSV4RRFFQ69G5FAW'});
const {fgaUser}=require('../lib/openfga.ts');let tuples=[],failed=true,approverAllowed=true;
global.fetch=async(url,init)=>{const body=JSON.parse(init.body);if(url.endsWith('/write')){if(failed)throw Error('offline');tuples.push(...body.writes.tuple_keys);return new Response(null,{status:204})}const t=body.tuple_key;let allowed=t.relation==='company'||(approverAllowed&&t.user===fgaUser('approver')&&t.relation==='can_write_business');if(tuples.some(x=>x.user===t.user&&x.object===t.object&&(x.relation===t.relation||(t.relation==='can_write_business'&&x.relation==='business_writer')||(t.relation==='can_write_evidence'&&x.relation==='writer'))))allowed=true;return Response.json({allowed});};
const company=state.companies.find(c=>c.id==='hanbit');let r=await post('request-company-access',{data:{name:company.name,registration:company.registration,industry:company.industry,region:company.region,contact:company.contact},holder:'Alice',title:'담당자',reason:'접근 연결 요청'});actor='approver';role='admin';await post('decide-access-request',{id:r.id,decision:'approve',reason:'소속 확인 완료',confirmed:true},503);assert.equal(state.accessRequests.find(x=>x.id===r.id).status,'provisioning');failed=false;
actor='other-admin';await post('retry-company-access',{id:r.id},403);assert.equal(tuples.length,0);
actor='approver';state.companies.find(c=>c.id==='hanbit').accountStatus='suspended';await post('retry-company-access',{id:r.id},422);assert.equal(tuples.length,0);
state.companies.find(c=>c.id==='hanbit').accountStatus='active';approverAllowed=false;await post('retry-company-access',{id:r.id},403);assert.equal(tuples.length,0);approverAllowed=true;
const stored=state.accessRequests.find(x=>x.id===r.id),approval=structuredClone(stored.approval);delete stored.approval;await post('retry-company-access',{id:r.id},409);state.accessRequests.find(x=>x.id===r.id).approval={...approval,companyId:'nova'};await post('retry-company-access',{id:r.id},403);assert.equal(tuples.length,0);state.accessRequests.find(x=>x.id===r.id).approval=approval;
const beforeRecovery=structuredClone(state);delete state.accessRequests.find(x=>x.id===r.id).approval;
const recovery={id:r.id,reason:'이전 승인 기록과 재직 근거 재확인',confirmed:true};
role='company';await post('reapprove-legacy-company-access',recovery,403);role='admin';
approverAllowed=false;await post('reapprove-legacy-company-access',recovery,403);approverAllowed=true;
state.companies.find(c=>c.id==='hanbit').accountStatus='suspended';await post('reapprove-legacy-company-access',recovery,422);state.companies.find(c=>c.id==='hanbit').accountStatus='active';
await post('reapprove-legacy-company-access',{...recovery,confirmed:false},400);
const originalRegistration=state.accessRequests.find(x=>x.id===r.id).companyData.registration;state.accessRequests.find(x=>x.id===r.id).companyData.registration='mismatch';await post('reapprove-legacy-company-access',recovery,409);state.accessRequests.find(x=>x.id===r.id).companyData.registration=originalRegistration;
assert.equal(tuples.length,0);failed=true;await post('reapprove-legacy-company-access',{...recovery,approval:{actor:'attacker',newCompany:true}},503);
const recovered=state.accessRequests.find(x=>x.id===r.id);assert.equal(recovered.approval.actor,'approver');assert.equal(recovered.approval.newCompany,false);assert.match(recovered.history.at(-1).reason,/재승인/);assert.equal(recovered.status,'provisioning');
await post('reapprove-legacy-company-access',recovery,409);failed=false;
assert.equal((await post('retry-company-access',{id:r.id})).status,'approved');
state=beforeRecovery;tuples=[];
r=await post('retry-company-access',{id:r.id});assert.equal(r.status,'approved');assert.ok(!tuples.some(t=>t.user===fgaUser('other-admin')));
console.log('PASS review regression: pinned approval/actor/scope, suspended and revoked ACL blocked, legacy fails closed, expiry re-consent with new nonce, stale proof rejected, idempotency and explicit cancelled/unknown status');
}finally{Module._load=original;global.fetch=nativeFetch}})().catch(e=>{console.error(e);process.exit(1)});
