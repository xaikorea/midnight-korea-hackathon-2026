const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const ctx=await browser.newContext({viewport:{width:1440,height:1040}});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173/signin-with-chatgpt?return_to=/',{waitUntil:'networkidle',timeout:90000});
 async function post(action,payload={},expected=200){const r=await ctx.request.post('http://localhost:5173/api/platform',{data:{action,...payload}});const value=await r.json();assert.equal(r.status(),expected,JSON.stringify(value));return value;}
 await post('switch-role',{role:'admin'});
 let state=await (await ctx.request.get('http://localhost:5173/api/platform')).json();assert.equal(state.engine.mode,'signed-demo');assert.ok(!JSON.stringify(state.issuers).includes('privateKey'));
 const anon=await browser.newContext();assert.equal((await anon.request.get('http://localhost:5173/api/platform')).status(),401);await anon.close();
 const csrf=await ctx.request.post('http://localhost:5173/api/platform',{headers:{Origin:'https://attacker.invalid'},data:{action:'settings',name:'invalid'}});assert.equal(csrf.status(),403);
 // UI path: create a request, submit a credential with consent, verify result.
 await page.reload({waitUntil:'networkidle'});
 await page.getByRole('button',{name:'검증 요청 만들기',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'저장하기'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 const row=page.getByRole('row').filter({hasText:'2026 협력사 사전 등록'}).first();await row.getByRole('button',{name:'열기'}).click();
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'자격 검증 후 제출'}).click();await page.getByRole('heading',{name:'조건을 충족합니다'}).waitFor();
 await page.getByRole('button',{name:'서명 및 유효성 확인'}).click();await page.getByText(/검증기관 확인 완료/).waitFor();await page.screenshot({path:'outputs/bizproof-verification.png',fullPage:true});
 state=await (await ctx.request.get('http://localhost:5173/api/platform')).json();const pres=state.presentations.at(-1);await post('verify-presentation',{id:pres.id},409);
 const grant=await post('create-request',{companyId:'hanbit',policyId:'grant-startup'});const gp=await post('present',{requestId:grant.id,credentialId:'credential-hanbit',consent:true});assert.equal(gp.eligible,true);await post('verify-presentation',{id:gp.id});
 const premium=await post('create-request',{companyId:'hanbit',policyId:'vendor-premium'});const pp=await post('present',{requestId:premium.id,credentialId:'credential-hanbit',consent:true});assert.equal(pp.eligible,false);await post('verify-presentation',{id:pp.id});
 const mismatch=await post('create-request',{companyId:'hanbit',policyId:'vendor-standard'});await post('present',{requestId:mismatch.id,credentialId:'credential-nova',consent:true},403);await post('cancel-request',{id:mismatch.id});await post('present',{requestId:mismatch.id,credentialId:'credential-hanbit',consent:true},409);
 const exported=await (await ctx.request.get('http://localhost:5173/api/platform?export=credential&id=credential-hanbit')).json();const tampered=structuredClone(exported.credential);tampered.claims.revenue=999999999;await post('import-credential',{credential:tampered},422);await post('import-credential',{credential:exported.credential});
 await post('rotate-key',{id:'issuer-bizproof'});await post('import-credential',{credential:exported.credential});
 await post('switch-role',{role:'buyer'});state=await (await ctx.request.get('http://localhost:5173/api/platform')).json();assert.ok(state.credentials.every(c=>!('claims'in c)&&!('signature'in c)));assert.ok(state.requests.every(r=>r.policy.kind==='buyer'));assert.equal((await ctx.request.get('http://localhost:5173/api/platform?export=credential&id=credential-hanbit')).status(),403);await post('issue-credential',{},403);await post('verify-presentation',{id:gp.id},403);
 await post('switch-role',{role:'admin'});const fresh=await post('issue-credential',{companyId:'hanbit',issuerId:'issuer-bizproof',schemaId:'business-v1',claims:{revenue:300000000,foundedOn:'2024-09-01',region:'서울',certified:true},days:180});await post('revoke-credential',{id:fresh.id,reason:'검증 테스트: 취소 처리'});const rr=await post('create-request',{companyId:'hanbit',policyId:'vendor-standard'});await post('present',{requestId:rr.id,credentialId:fresh.id,consent:true},422);await post('cancel-request',{id:rr.id});
 await page.goto('http://localhost:5173/?view=overview',{waitUntil:'networkidle'});await page.screenshot({path:'outputs/bizproof-overview.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'outputs/bizproof-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile horizontal overflow');
 assert.deepEqual(errors,[]);console.log('PASS: UI issue flow, vendor/grant reuse, negative policy, cross-company, replay, tamper, key rotation, revocation, role redaction, CSRF, login, mobile');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

