const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('node:assert/strict'),Module=require('module');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
(async()=>{
 const {seedState}=require('../lib/seed.ts'),{sign}=require('../lib/signatures.ts'),{credentialPayload}=require('../lib/domain.ts');let state=await seedState(),version=0;
 const env={BIZPROOF_ACCESS_CONTROL:'openfga',OPENFGA_URL:'http://127.0.0.1:18380',OPENFGA_STORE_ID:'01ARZ3NDEKTSV4RRFFQ69G5FAV',OPENFGA_MODEL_ID:'01ARZ3NDEKTSV4RRFFQ69G5FAW'};
 let role='company',actor='alice',write=true,offline=false;
 const original=Module._load,nativeFetch=global.fetch;
 Module._load=function(id,...rest){if(id==='cloudflare:workers')return {env};if(id==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>({userId:actor,storageOwner:'room',allowedRoles:[role],displayName:actor,authMode:'keycloak'})};if(id==='next/headers')return {cookies:async()=>({get:()=>({value:role})})};if(id==='@/lib/store')return {readState:async()=>({state:structuredClone(state),version}),saveState:async(_owner,s)=>{state=s;version++;},ConflictError:class extends Error{}};if(id.startsWith('@/'))id=path.resolve(id.slice(2))+'.ts';return original.call(this,id,...rest);};
 const {fgaCompany}=require('../lib/openfga.ts');global.fetch=async(_url,init)=>{if(offline)throw Error('offline');const {tuple_key:t}=JSON.parse(init.body);return Response.json({allowed:t.object===fgaCompany('room','hanbit')&&(t.relation!=='can_write_business'||write)});};
 try{const api=require('../app/api/platform/route.ts');async function post(action,data={},status=200){const r=await api.POST(new Request('http://localhost/api/platform',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({action,...data})}));const body=await r.json();assert.equal(r.status,status,JSON.stringify(body));return body;}
 const get=()=>api.GET(new Request('http://localhost/api/platform'));
 let r=await get(),view=await r.json();assert.deepEqual(view.companies.map(c=>c.id),['hanbit']);assert.equal(view.credentials.length,1);
 assert.equal((await api.GET(new Request('http://localhost/api/platform?export=credential&id=credential-nova'))).status,404);
 await post('export-portable-credential',{id:'credential-nova',consent:true},403);await post('update-company-profile',{id:'nova'},403);
 write=false;await post('wallet-organize',{id:'credential-hanbit',data:{favorite:true,archived:false,category:''}},403);write=true;
 offline=true;assert.equal((await get()).status,503);offline=false;
 const credentialId='credential-hanbit';role='issuer';await post('issue-credential',{companyId:'hanbit',issuerId:'issuer-bizproof',schemaId:'business-v1',claims:state.credentials[0].claims,days:1},422);
 role='company';const request=await post('create-request',{companyId:'hanbit',policyId:'vendor-standard'});await post('present',{requestId:request.id,credentialId,consent:true},422);
 // Signed, fixture-reviewed credential: tests enforcement, not document authenticity.
 const evidenceBytes=new TextEncoder().encode('reviewed fixture document').buffer,hash=Buffer.from(await crypto.subtle.digest('SHA-256',evidenceBytes)).toString('hex');env.BUCKET={get:async()=>({customMetadata:{},arrayBuffer:async()=>evidenceBytes})};
 state.evidence.push({id:'e',companyId:'hanbit',sha256:hash,key:'e',name:'fixture',size:1,mime:'text/plain',createdAt:new Date().toISOString()});
 const c=state.credentials[0];c.source={kind:'document-review',reference:'fixture',period:'2026',method:'fixture review',reviewer:'issuer-user',reviewedAt:new Date().toISOString(),documents:[{id:'e',name:'fixture',sha256:hash}],notice:'fixture'};c.signature=await sign(state.issuers[0].privateKey,credentialPayload(c));
 role='issuer';await post('issue-authority',{credentialId,holder:'Alice',title:'Officer',scope:'buyer',days:1},422);
 const a=await post('issue-authority',{credentialId,holderUserId:'alice',holder:'Alice',title:'Officer',scope:'buyer',days:1});
 role='company';await post('present',{requestId:request.id,credentialId,consent:true},422);actor='bob';await post('present',{requestId:request.id,credentialId,authorityId:a.id,consent:true},422);actor='alice';
 const p=await post('present',{requestId:request.id,credentialId,authorityId:a.id,consent:true});assert.equal(p.submittedBy,'alice');
 role='issuer';await post('revoke-authority',{id:a.id,reason:'employment ended'});role='buyer';await post('verify-presentation',{id:p.id},422);
 assert.equal(state.requests.find(x=>x.id===request.id).status,'submitted');
 role='issuer';const replacement=await post('issue-authority',{credentialId,holderUserId:'alice',holder:'Alice',title:'Officer',scope:'buyer',days:1});
 role='company';const next=await post('create-request',{companyId:'hanbit',policyId:'vendor-standard'});const valid=await post('present',{requestId:next.id,credentialId,authorityId:replacement.id,consent:true});role='buyer';assert.equal((await post('verify-presentation',{id:valid.id})).eligible,true);
 role='issuer';const grantAuthority=await post('issue-authority',{credentialId,holderUserId:'alice',holder:'Alice',title:'Officer',scope:'grant',days:1});role='company';const grantRequest=await post('create-request',{companyId:'hanbit',policyId:'grant-startup'});const grantPresentation=await post('present',{requestId:grantRequest.id,credentialId,authorityId:grantAuthority.id,consent:true});role='buyer';await post('verify-presentation',{id:grantPresentation.id},403);role='grant';assert.equal((await post('verify-presentation',{id:grantPresentation.id})).eligible,true);
 role='issuer';const draft=await post('save-draft',{data:{companyId:'hanbit',issuerId:'issuer-bizproof',schemaId:'business-v1',claims:c.claims,days:1,labels:[],note:'',evidenceIds:['e']}});await post('publish-draft',{id:draft.id,revision:1},400);const reviewed=await post('publish-draft',{id:draft.id,revision:1,source:{reference:'fixture source',period:'2026',method:'reviewed original fixture',confirmed:true}});assert.equal(state.credentials.find(x=>x.id===reviewed.id).source.documents[0].sha256,hash);assert.equal(state.credentials.find(x=>x.id===reviewed.id).source.reviewer,'alice');
 console.log('PASS operational API: resource ACL read/write, export isolation, outage, unreviewed issuance/submission, mandatory actor-bound authority, revocation recheck, valid end-to-end (fixtures)');
 }finally{Module._load=original;global.fetch=nativeFetch;}
})().catch(e=>{console.error(e);process.exit(1)});
