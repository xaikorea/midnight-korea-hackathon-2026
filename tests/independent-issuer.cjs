const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const protocol=require('../services/issuer/protocol.mjs');
const {initializeIssuer}=require('../services/issuer/core.mjs');
const {seedState}=require('../lib/seed.ts'),{credentialPayload,presentationPayload}=require('../lib/domain.ts');
const {digest,verify}=require('../lib/signatures.ts');
const Module=require('node:module'),original=Module._load;Module._load=function(id,...rest){if(id==='cloudflare:workers')return {env:{}};return original.call(this,id,...rest);};
const {importRemoteCredential,issuerCall,remoteCredentialStatus}=require('../lib/remote-issuer.ts');
const {prepareApplication,submitApplication}=require('../lib/application-flow.ts');
const {verifyProcessingResult}=require('../lib/processing-signature.ts');
const {inspectCredential}=require('../lib/credential-family.ts');
const root=path.resolve('outputs/issuer-integration-'+crypto.randomUUID());fs.mkdirSync(root,{recursive:true});
const directory=path.join(root,'issuer'),keys=initializeIssuer(directory),secret=crypto.randomBytes(48).toString('hex'),scope=protocol.hash('tenant-A'),otherScope=protocol.hash('tenant-B');
const processing=crypto.generateKeyPairSync('ed25519');
Object.assign(process.env,{BIZPROOF_ISSUER_SERVICE_SECRET:secret,BIZPROOF_ISSUER_TRUST:JSON.stringify({issuerId:protocol.ISSUER_ID,keyId:keys.keyId,publicKey:keys.publicKey}),BIZPROOF_PROCESSING_KEY:JSON.stringify({keyId:'platform-test',publicKey:processing.publicKey.export({format:'jwk'}),privateKey:processing.privateKey.export({format:'jwk'})})});
let child,base;
async function start(){child=spawn(process.execPath,['services/issuer/server.mjs'],{env:{...process.env,ISSUER_SERVICE_SECRET:secret,ISSUER_DATA_DIR:directory,ISSUER_PORT:'0'},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{let output='';const timeout=setTimeout(()=>reject(Error('Issuer startup timeout')),10000);child.stdout.on('data',b=>{output+=b;const match=output.match(/listening on (\d+)/);if(match){clearTimeout(timeout);resolve('http://127.0.0.1:'+match[1]);}});child.on('exit',code=>{clearTimeout(timeout);reject(Error('Issuer exited '+code));});});process.env.BIZPROOF_ISSUER_URL=base;}
async function stop(){if(child&&!child.killed){const p=new Promise(resolve=>child.once('exit',resolve));child.kill();await p;}}
async function call(method,url,body,scopeValue=scope,status=200){const iat=Date.now(),token=protocol.authorization(secret,{aud:'bizproof-issuer-demo',mode:'synthetic',method,path:url,scope:scopeValue,bodyHash:protocol.hash(body??null),iat,exp:iat+30000,jti:crypto.randomUUID()});const request={method,headers:{Authorization:'BizProof '+token,'Content-Type':'application/json'},body:method==='POST'?JSON.stringify(body):undefined};const response=await fetch(base+url,request),result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return {result,request};}
const key=()=>crypto.randomUUID();
async function apply(){const hash=protocol.hash(protocol.intentBody()),identity=(await call('POST','/v1/identity-sessions',{key:key(),mode:'simulated',documentHash:hash})).result;await call('POST','/v1/identity-sessions/'+identity.id+'/confirm',{key:key(),documentHash:hash,consent:true});return (await call('POST','/v1/issuance-requests',{key:key(),identityId:identity.id,documentHash:hash})).result;}
(async()=>{try{
 await start();
 assert.equal((await fetch(base+'/v1/catalog')).status,401);
 const catalog=await call('GET','/v1/catalog');assert.equal((await fetch(base+'/v1/catalog',catalog.request)).status,401,'service token replay');
 await call('POST','/v1/identity-sessions',{key:key(),mode:'live',documentHash:protocol.hash(protocol.intentBody())},scope,503);
 await call('POST','/v1/identity-sessions',{key:key(),mode:'simulated',documentHash:'0'.repeat(64)},scope,409);
 const doc=protocol.hash(protocol.intentBody()),cancelled=(await call('POST','/v1/identity-sessions',{key:key(),mode:'simulated',documentHash:doc})).result;
 await call('POST','/v1/identity-sessions/'+cancelled.id+'/confirm',{key:key(),documentHash:doc,consent:false},scope,400);
 await call('POST','/v1/identity-sessions/'+cancelled.id+'/confirm',{key:key(),documentHash:doc,consent:true},otherScope,404);
 await call('POST','/v1/identity-sessions/'+cancelled.id+'/cancel',{key:key(),documentHash:doc,consent:false});
 await call('POST','/v1/issuance-requests',{key:key(),identityId:cancelled.id,documentHash:doc},scope,422);
 let r=await apply();const changes={key:key(),revision:r.revision,decision:'needs_changes',reason:'합성 자료의 적용 기간 확인'};
 r=(await call('POST','/v1/issuance-requests/'+r.id+'/decisions',changes)).result;assert.equal(r.status,'needs_changes');
 await call('POST','/v1/issuance-requests/'+r.id+'/resubmit',{key:key(),revision:1,reason:'확인했음'},scope,409);
 r=(await call('POST','/v1/issuance-requests/'+r.id+'/resubmit',{key:key(),revision:r.revision,reason:'합성 자료의 기간을 확인했습니다.'})).result;
 await call('GET','/v1/issuance-requests/'+r.id,undefined,otherScope,404);
 const approve={key:key(),revision:r.revision,decision:'approve',reason:''},url='/v1/issuance-requests/'+r.id+'/decisions';
 const responses=await Promise.all(Array.from({length:5},()=>call('POST',url,approve)));r=responses[0].result;
 assert.equal(new Set(responses.map(v=>v.result.credentialId)).size,1,'only one issuance under concurrent replay');
 await call('POST',url,{...approve,reason:'changed'},scope,409);
 await call('POST',url,{...approve,key:key()},scope,409);
 const credential=(await call('GET','/v1/issuance-requests/'+r.id+'/credential')).result;
 assert.equal(protocol.verifyBody(keys.publicKey,protocol.credentialBody(credential),credential.signature),true);
 assert.equal(protocol.hash(credentialPayload(credential)),protocol.hash(protocol.credentialBody(credential)),'shared payload parity');
 assert.equal(JSON.stringify(credential).includes(keys.privateKey.d),false);
 let state=await seedState();state.schemas[0].id='visitor-random-schema';const receipt=await importRemoteCredential(state,scope,r.id);await importRemoteCredential(state,scope,r.id);
 assert.equal(state.credentials.filter(c=>c.id===receipt.credentialId).length,1);assert.equal(state.issuers.find(i=>i.id===protocol.ISSUER_ID).privateKey,undefined);
 const ctx={actor:'demo-fixture',owner:'demo-fixture',role:'company',authMode:'demo'},inputs=[];
 for(const policyId of ['issuer-demo-buyer','issuer-demo-grant']){const choice={companyId:protocol.COMPANY_ID,policyId,credentialId:receipt.credentialId},preview=await prepareApplication(state,ctx,choice);assert.equal(preview.ready,true);inputs.push({...choice,previewHash:preview.previewHash,key:key(),consent:true});}
 for(const input of inputs){const result=await submitApplication(state,ctx,input);assert.equal(result.status,'verified');}
 const presentations=state.presentations.filter(p=>p.credentialId===receipt.credentialId);assert.equal(presentations.length,2);assert.notEqual(presentations[0].nonce,presentations[1].nonce);assert.notEqual(presentations[0].policyHash,presentations[1].policyHash);
 const remote=state.issuers.find(i=>i.id===protocol.ISSUER_ID);
 for(const p of presentations){assert.equal(p.signerKind,'platform');assert.equal(await verify(keys.publicKey,presentationPayload(p),p.signature),false);assert.equal(await verifyProcessingResult(p,remote),true);assert.equal(await verifyProcessingResult({...p,signerKind:undefined},remote),false);}
 const tampered=structuredClone(credential);tampered.claims.revenue++;assert.equal((await inspectCredential(state,tampered)).valid,false);
 const trust=process.env.BIZPROOF_ISSUER_TRUST;process.env.BIZPROOF_ISSUER_TRUST=JSON.stringify({...JSON.parse(trust),publicKey:processing.publicKey.export({format:'jwk'})});assert.equal((await inspectCredential(state,credential)).valid,false);process.env.BIZPROOF_ISSUER_TRUST=trust;
 await call('POST','/v1/credentials/'+credential.id+'/revocations',{key:key(),reason:'발급 취소 검증'},otherScope,404);
 const before=await remoteCredentialStatus(credential);assert.equal(before.body.status,'active');
 await call('POST','/v1/credentials/'+credential.id+'/revocations',{key:key(),reason:'발급 취소 검증'});
 assert.equal((await remoteCredentialStatus(credential)).body.status,'revoked');assert.equal((await inspectCredential(state,credential)).valid,false);
 await stop();await start();assert.equal((await remoteCredentialStatus(credential)).body.status,'revoked','revocation persists after restart');
 assert.equal((await call('GET','/v1/issuance-requests/'+r.id+'/credential')).result.signature,credential.signature,'original stays immutable');
 const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(path.join(directory,'issuer.sqlite'));const saved=db.prepare('SELECT count(*) n FROM credentials WHERE request_id=?').get(r.id);assert.equal(saved.n,1);db.close();
 await stop();assert.equal((await inspectCredential(state,credential)).valid,false,'unavailable issuer fails closed');
 console.log('PASS independent issuer: separate HTTP process, scoped auth/replay, mock/live boundary, consent binding, review/resubmit, concurrent idempotency, pinned signatures, two applications, platform/issuer key separation, revoke/restart/outage');
}finally{await stop();Module._load=original;if(!root.startsWith(path.resolve('outputs')+path.sep))throw Error('Unsafe cleanup path');fs.rmSync(root,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
