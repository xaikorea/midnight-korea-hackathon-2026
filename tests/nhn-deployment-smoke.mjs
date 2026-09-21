import assert from 'node:assert/strict';
const base=process.env.SMOKE_BASE??'http://127.0.0.1:3100',origin=process.env.BIZPROOF_APP_ORIGIN??'https://bizproof.xaikorea.ai.kr';
const headers={origin,host:new URL(origin).host,'x-forwarded-proto':new URL(origin).protocol.slice(0,-1)};
async function request(path,method='GET',body,cookie=''){const r=await fetch(base+path,{method,headers:{...headers,cookie,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});return r;}
assert.equal((await request('/api/platform')).status,401);
assert.equal((await fetch(base+'/api/platform',{headers:{...headers,'oai-authenticated-user-id':'admin','oai-authenticated-user-email':'admin@example.invalid'}})).status,401);
async function login(){const r=await request('/signin-with-chatgpt','POST');assert.equal(r.status,303,await r.text());return r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');}
const a=await login(),b=await login();
async function post(action,data={},status=200){const r=await request('/api/platform','POST',{action,...data},a+'; bizproof-persona=admin');const v=await r.json();assert.equal(r.status,status,JSON.stringify(v));return v;}
let r=await request('/api/platform','GET',undefined,a);let s=await r.json();const actor=s.actor;
const j=await post('create-demo-journey');s=await (await request('/api/platform','GET',undefined,b)).json();assert.notEqual(s.actor,actor);assert.equal(s.demoJourneys.some(x=>x.id===j.id),false);
for(const name of ['buyer','grant']){const p=await post('present',{requestId:j.requestIds[name],credentialId:j.credentialId,consent:true});s=await (await request('/api/platform','GET',undefined,a)).json();const presentation=s.presentations.find(p=>p.requestId===j.requestIds[name]);assert.ok(presentation);await post('verify-presentation',{id:presentation.id});}
s=await (await request('/api/platform','GET',undefined,a)).json();assert.ok(['buyer','grant'].every(n=>s.presentations.find(p=>p.requestId===j.requestIds[n]).verifiedAt));
assert.equal((await request('/api/admin/analytics','GET',undefined,a)).status,403);assert.equal((await request('/api/evidence','POST',{},a)).status,403);
if(process.env.TEST_ADMIN_PASSWORD){const response=await fetch(base+'/api/demo-admin',{method:'POST',headers:{...headers,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'admin',password:process.env.TEST_ADMIN_PASSWORD}),redirect:'manual'});assert.equal(response.status,303,await response.text());const adm=response.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');assert.equal((await request('/api/admin/analytics','GET',undefined,adm)).status,200);assert.equal((await request('/api/platform','GET',undefined,adm)).status,401);}
await request('/signout-with-chatgpt','GET',undefined,a);assert.equal((await request('/api/platform','GET',undefined,a)).status,401);await request('/signout-with-chatgpt','GET',undefined,b);
console.log(JSON.stringify({pass:true,actor,journey:j.id,checks:['anonymous/header forgery denied','independent workspaces','same credential buyer+grant verified','admin isolation','upload blocked','logout invalidates session'],networkProof:false}));
