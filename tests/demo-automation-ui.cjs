const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3116';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Isolated synthetic server only.');
(async()=>{const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1050}}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(45000);
 await ctx.addCookies([{name:'bp-analytics-optout',value:'1',url:base}]);await ctx.addInitScript(()=>localStorage.setItem('bp-analytics-notice','1'));
 assert.equal((await ctx.request.post(base+'/signin-with-chatgpt',{headers:{Origin:base},maxRedirects:0})).status(),303);
 await page.goto(base+'/?view=apply',{waitUntil:'networkidle'});await page.getByRole('button',{name:'실제 기관·구매사 준비',exact:true}).click();
 await page.getByRole('button',{name:/서울 AI 허브 · 2026 1차 선도기업/}).click();
 const auto=page.getByRole('region',{name:'공개 데이터 자동 시연'}),start=auto.getByRole('button',{name:'동의한 자료로 자동 시연 시작'});
 assert.equal(await start.isEnabled(),false);await auto.getByRole('checkbox').check();
 async function run(){const response=page.waitForResponse(r=>r.url().endsWith('/api/program-demo')&&r.request().method()==='POST');await start.click();const r=await response;assert.equal(r.status(),200);const v=await r.json();assert.equal(v.job.status,'queued');assert.equal(v.job.approvalMode,'automatic-synthetic');await page.getByRole('region',{name:'기관별 준비 기록'}).getByText('자동 실행 허용',{exact:true}).waitFor();return v;}
 const first=await run();assert.equal((await run()).job.id,first.job.id);
 assert.equal(await page.locator('.program-record').count(),1);assert.equal(await page.locator('.program-route li.done').count(),3);
 assert.equal(await page.getByRole('button',{name:'이 신규 사례의 체인 실행 승인',exact:true}).count(),0);
 const download=await ctx.request.get(base+'/api/program-applications/'+first.application.id+'/package');assert.equal(download.status(),200);assert.equal((await download.json()).externalReceipt,null);
 fs.mkdirSync('outputs/demo-automation',{recursive:true});await auto.scrollIntoViewIfNeeded();await page.screenshot({path:'outputs/demo-automation/desktop.png'});
 await page.setViewportSize({width:390,height:844});await auto.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'outputs/demo-automation/mobile.png'});
 await page.getByRole('combobox',{name:'시연 사례',exact:true}).selectOption('negative');assert.equal(await start.isEnabled(),false);
 await auto.getByRole('checkbox').check();const negative=await run();assert.ok(negative.precheck.checks.some(c=>c.outcome==='fail'));assert.notEqual(negative.job.id,first.job.id);
 assert.deepEqual(errors,[]);console.log('PASS automatic UI: one consent, real prepare/check/save/queue, no admin approval, duplicate reuse, reset consent on scenario change, negative results, download, responsive layout.');
 }finally{await browser.close();}})().catch(e=>{console.error(e.message.split('Call log:')[0]);process.exitCode=1;});
