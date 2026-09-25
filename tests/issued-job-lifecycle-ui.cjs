// Opt-in integration check against the exact job created by proof-jobs-ui.cjs.
// Run the actual executor and independent verifier between these phases.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=path.resolve(process.env.SMOKE_OUTPUT||'outputs/proof-jobs-ui'),job=JSON.parse(fs.readFileSync(path.join(source,'job.json'),'utf8')),phase=process.argv[2];
assert.ok(['confirmed','revoke','revoked'].includes(phase));
(async()=>{const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chromium'}),context=await browser.newContext({storageState:path.join(source,'private-browser-state.json'),viewport:{width:1440,height:1100},reducedMotion:'reduce'}),page=await context.newPage();
try{
const get=async()=>{const r=await context.request.get(job.origin+'/api/proof-jobs');assert.equal(r.status(),200);const b=await r.json(),j=b.jobs.find(j=>j.id===job.id);assert.ok(j);assert.equal(j.sourceDigest,job.sourceDigest);assert.deepEqual(j.requests,job.requests);return j;};
let current=await get();
if(phase==='confirmed'){
 assert.equal(current.status,'confirmed');assert.equal(current.revocation,'none');assert.equal(current.receipts.length,8);assert.equal(current.verification.receiptsVerified,8);assert.equal(current.verification.results.length,2);assert.ok(current.verification.results.every(r=>r.eligible));
}else if(phase==='revoke'){
 assert.equal(current.status,'confirmed');const r=await context.request.post(job.origin+'/api/issuance',{headers:{Origin:job.origin},data:{action:'revoke',id:job.credentialId,key:crypto.randomUUID(),reason:'동일 자격의 실제 체인 취소 검증'}});assert.equal(r.status(),200);current=await get();assert.equal(current.status,'blocked');assert.equal(current.revocation,'pending');
 const response=await context.request.post(job.origin+'/api/platform',{headers:{Origin:job.origin},data:{action:'prepare-application',companyId:'issuer-demo-company',credentialId:job.credentialId,policyId:'issuer-demo-buyer'}});assert.equal(response.ok(),false,'revoked credential cannot prepare another application');
}else{
 assert.equal(current.status,'blocked');assert.equal(current.revocation,'confirmed');assert.equal(current.verification.revoked,true);assert.equal(current.receipts.length,9);assert.equal(current.verification.receiptsVerified,9);
}
fs.writeFileSync(path.join(source,phase+'-public-status.json'),JSON.stringify(current,null,2));
await page.goto(job.origin+'/chain-jobs');const card=page.locator('article.proof-job').filter({hasText:job.id});await card.getByRole('heading',{name:phase==='confirmed'?'체인 결과 확인':'새 사용 차단',exact:true}).waitFor();
if(phase==='revoked')await card.getByText(/발급기관 취소 \+ 체인 취소 확인/).waitFor();
await page.screenshot({path:path.join(source,phase+'-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(source,phase+'-mobile.png'),fullPage:true});
console.log(JSON.stringify({phase,jobId:job.id,status:current.status,revocation:current.revocation,transactions:current.receipts.length,contract:current.contractAddress}));
}finally{await browser.close();}})().catch(e=>{console.error(String(e.message??e).split('Call log:')[0]);process.exit(1);});
