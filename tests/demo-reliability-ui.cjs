// Run against an isolated Node + synthetic issuer deployment. The operator controls
// issuer outage / web restart between phases; no production fault injection here.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3116',phase=process.argv[2],dir='outputs/demo-reliability-ui';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Isolated loopback deployment only');
if(!['prepare','outage','recovered'].includes(phase))throw Error('Expected prepare, outage or recovered phase');
(async()=>{fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},...(phase!=='prepare'?{storageState:dir+'/private-session.json'}:{})}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(45000);
 if(phase==='prepare'){
  await ctx.addCookies([{name:'bp-analytics-optout',value:'1',url:base}]);await ctx.addInitScript(()=>localStorage.setItem('bp-analytics-notice','1'));
  assert.equal((await ctx.request.post(base+'/signin-with-chatgpt',{headers:{Origin:base},maxRedirects:0})).status(),303);
  await page.goto(base+'/issuance',{waitUntil:'networkidle'});await page.getByRole('button',{name:'동의하고 자동 발급·수신',exact:true}).waitFor();
  const catalog=await (await ctx.request.get(base+'/api/issuance')).json();
  fs.writeFileSync(dir+'/private-job.json',JSON.stringify({key:crypto.randomUUID(),documentHash:catalog.catalog.documentHash}));await ctx.storageState({path:dir+'/private-session.json'});
  await page.goto(base+'/verification',{waitUntil:'networkidle'});await page.getByRole('heading',{name:'블록체인은 어디까지 검증하나요?',exact:true}).waitFor();
  assert.match(await page.locator('#blockchain-scope').innerText(),/동일 운영자가 관리/);assert.match(await page.locator('#blockchain-scope').innerText(),/현대제철·POSCO·SK하이닉스/);
  await page.locator('#blockchain-scope').scrollIntoViewIfNeeded();await page.screenshot({path:dir+'/scope-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.locator('#blockchain-scope').scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:dir+'/scope-mobile.png'});
 }else if(phase==='outage'){
  const input=JSON.parse(fs.readFileSync(dir+'/private-job.json','utf8'));
  const res=await ctx.request.post(base+'/api/issuance',{headers:{Origin:base},data:{action:'apply',...input,automatic:true,consent:true}});assert.equal(res.status(),200);
  const v=await res.json();assert.equal(v.autoJob.status,'retry');assert.equal(v.autoJob.attempts,1);assert.ok(!v.receipt);
  fs.writeFileSync(dir+'/private-job.json',JSON.stringify({...input,id:v.autoJob.id}));
  await page.goto(base+'/issuance',{waitUntil:'networkidle'});const status=page.getByRole('complementary',{name:'자동 발급 복구 상태'});await status.getByText('연결 복구 후 자동 재시도',{exact:true}).waitFor();
  await page.reload({waitUntil:'networkidle'});assert.match(await status.innerText(),/브라우저를 닫아도 서버가 처리/);assert.equal(await page.getByText('자동 발급·수신 완료',{exact:true}).count(),0);
  await page.screenshot({path:dir+'/outage-persisted.png'});
 }else{
  const input=JSON.parse(fs.readFileSync(dir+'/private-job.json','utf8'));let data;
  for(let n=0;n<25;n++){const response=await ctx.request.get(base+'/api/issuance');if(response.ok()){data=await response.json();const job=data.autoJobs.find(j=>j.id===input.id);assert.ok(job);if(job.status==='complete')break;assert.ok(!['blocked','needs_attention'].includes(job.status));}await page.waitForTimeout(4000);}
  assert.equal(data.autoJobs.find(j=>j.id===input.id).status,'complete');assert.equal(data.requests.length,1);assert.equal(data.receipts.length,1);assert.equal(data.receipts[0].status,'active');
  await page.goto(base+'/issuance',{waitUntil:'networkidle'});await page.getByText('자동 발급·수신 완료',{exact:true}).waitFor();await page.getByRole('link',{name:'이 자격으로 두 곳에 신청',exact:true}).waitFor();
  await page.screenshot({path:dir+'/recovered-after-restart.png'});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  fs.writeFileSync(dir+'/result.json',JSON.stringify({pass:true,sameJob:true,requests:1,credentials:1,phase,at:new Date().toISOString()}));
 }
 assert.deepEqual(errors,[]);console.log('PASS isolated reliability UI '+phase);
}finally{await browser.close();}})().catch(e=>{console.error(e.message.split('Call log:')[0]);process.exitCode=1;});
