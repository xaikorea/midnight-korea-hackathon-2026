const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3136';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Use an isolated local synthetic server only.');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chromium'});
 try{
  const ctx=await browser.newContext({viewport:{width:1440,height:1050}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const entry=await ctx.request.post(base+'/signin-with-chatgpt',{headers:{Origin:base},maxRedirects:0});assert.equal(entry.status(),303);
  await page.goto(base+'/?view=apply',{waitUntil:'networkidle'});
  const optOut=page.getByRole('button',{name:'이 브라우저 수집 중지',exact:true});if(await optOut.isVisible())await optOut.click();
  await page.getByRole('button',{name:'실제 기관·구매사 준비',exact:true}).click();
  const workspace=page.getByRole('region',{name:'실제 사례 준비'});
  const preparedResponse=page.waitForResponse(r=>r.url().endsWith('/api/programs')&&r.request().method()==='POST');await workspace.getByRole('button',{name:'시연 자료 불러오기'}).click();const prepared=await preparedResponse;assert.equal(prepared.status(),200,await prepared.text());
  await workspace.getByRole('combobox',{name:'신청 기업',exact:true}).getByRole('option',{name:/가상 재사용기업 · normal/}).waitFor({state:'attached'});
  await workspace.getByRole('button',{name:/서울창업허브 성수 · 2026 하반기/}).click();
  await workspace.getByRole('button',{name:'보유 자료로 사전 확인'}).click();
  const result=page.getByRole('region',{name:'사전 확인 결과'});await result.waitFor();await result.getByText(/유효 자격 2개 재사용 · 근거 문서 [0-9]+개/).waitFor();
  assert.equal(await result.getByRole('button',{name:'제출 준비 기록 저장'}).isEnabled(),false);
  await result.getByRole('checkbox').check();await result.getByRole('button',{name:'제출 준비 기록 저장'}).click();await result.getByText(/내부 준비 기록이 저장되었습니다/).waitFor();
  const records=page.getByRole('region',{name:'기관별 준비 기록'});await records.getByRole('link',{name:'제출 준비 목록 다운로드 (JSON)'}).waitFor();
  const url=await records.getByRole('link',{name:'제출 준비 목록 다운로드 (JSON)'}).getAttribute('href');const response=await ctx.request.get(base+url);assert.equal(response.status(),200);const manifest=await response.json();assert.equal(manifest.externalReceipt,null);assert.equal(manifest.current.unchanged,true);assert.equal(manifest.documents.length,4);assert.ok(!JSON.stringify(manifest).includes('privateKey'));assert.ok(!JSON.stringify(manifest).includes('"facts":'));
  const file=await ctx.request.get(base+manifest.documents[0].downloadUrl);assert.equal(file.status(),200);assert.ok((await file.body()).subarray(0,5).toString()==='%PDF-');
  fs.mkdirSync('outputs/program-implementation',{recursive:true});await page.screenshot({path:'outputs/program-implementation/desktop.png',fullPage:true});
  await workspace.getByRole('button',{name:/서울 AI 허브 · 2026 1차 선도기업/}).click();await workspace.getByRole('button',{name:'보유 자료로 사전 확인'}).click();await result.getByText('2025 매출 20억원 또는 누적 투자 30억원',{exact:true}).waitFor();
  const or=await ctx.request.post(base+'/api/programs/ai-hub-2026-leading/precheck',{headers:{Origin:base},data:{companyId:'demo-program-normal'}});const other=await or.json();assert.equal(other.precheck.windowStatus,'closed');assert.ok(manifest.application.precheck.credentialDigests.every(c=>other.precheck.credentialDigests.some(d=>d.id===c.id)));
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'outputs/program-implementation/mobile.png',fullPage:true});
  // The browser cannot upload actual evidence in public mode or review as an applicant.
  const blocked=await ctx.request.post(base+'/api/program-documents',{headers:{Origin:base,'Content-Type':'application/pdf'},data:Buffer.from('%PDF-fixture')});assert.equal(blocked.status(),403);
  const review={revision:0,ruleId:'move',decision:'confirmed',reason:'Synthetic review in browser test only.',evidenceIds:[manifest.documents[0].id]};assert.equal((await ctx.request.post(base+`/api/program-applications/${manifest.application.id}/review`,{headers:{Origin:base},data:review})).status(),403);
  const second=await browser.newContext();try{assert.equal((await second.request.get(base+url)).status(),401);await second.request.post(base+'/signin-with-chatgpt',{headers:{Origin:base},maxRedirects:0});assert.equal((await second.request.get(base+url)).status(),409);}finally{await second.close();}
  assert.deepEqual(errors,[]);console.log('PASS program browser flow: prepare persisted PDFs, select real profile, reusable signed credentials, consent/save/manifest/download, closed round, private tenant boundaries, blocked public upload/review, desktop/mobile no overflow.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
