const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.SMOKE_BASE||'http://127.0.0.1:3100';
(async()=>{
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chromium',headless:true,args:[]});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
 page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await context.addCookies([{name:'bp-analytics-optout',value:'1',url:base}]);
 await context.addInitScript(()=>localStorage.setItem('bp-analytics-notice','1'));
 try{
  await page.goto(base+'/verification',{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'성공과 거절을 함께 확인합니다'}).waitFor();
  assert.equal(await page.locator('.evidence-results article').count(),3);
  assert.match(await page.locator('.evidence-stats').innerText(),/11건/);
  assert.match(await page.locator('.evidence-disclosure').first().innerText(),/현재 방문자의 신청을 온체인 검증한 결과가 아니며/);
  await page.locator('.evidence-results summary').first().click();
  assert.match(await page.locator('.evidence-results article').first().innerText(),/SucceedEntirely/);
  const download=page.waitForEvent('download');await page.getByRole('link',{name:'실행 증거 JSON'}).click();
  const file=await download;assert.equal(file.suggestedFilename(),'midnight-web-devnet.json');
  fs.mkdirSync('outputs/verification-ui',{recursive:true});await file.saveAs('outputs/verification-ui/evidence.json');
  assert.equal(JSON.parse(fs.readFileSync('outputs/verification-ui/evidence.json')).receipts.length,11);
  let writes=0;page.on('request',r=>{if(['POST','PUT','PATCH','DELETE'].includes(r.method())&&/midnight|application/.test(r.url()))writes++});
  await page.getByRole('button',{name:'기록 재생',exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector('input[type=range]').value)>0);
  assert.ok(Number(await page.getByRole('slider').inputValue())>0);
  await page.getByRole('button',{name:'재생 일시정지'}).click();assert.equal(writes,0);
  await page.getByRole('button',{name:'로컬 체인 현재 상태 대조'}).click();
  await page.locator('.evidence-local-status').filter({hasText:'로그인'}).waitFor();
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'outputs/verification-ui/desktop.png'});
  await page.setViewportSize({width:390,height:844});
  for(const selector of ['.evidence-intro','.evidence-results','.evidence-identifiers','.evidence-flow']){await page.locator(selector).scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow: '+selector)}
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'outputs/verification-ui/mobile.png'});
  // Corrupt a downloaded report in this test context only; the UI must fail closed.
  await page.route('**/evidence/midnight-web-devnet.json',route=>route.fulfill({status:200,contentType:'application/json',body:'{"receipts":[]}'}));
  await page.reload({waitUntil:'networkidle'});await page.getByRole('alert').filter({hasText:'완료로 추정하지 않습니다'}).waitFor();
  assert.equal(await page.locator('.evidence-results').count(),0);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({pass:true,base,checks:['archived evidence disclosure','three results and 11 receipts','JSON download','replay performs no writes','unavailable live check fails visibly','mobile overflow','invalid evidence fails closed']}));
 }finally{await context.close();await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
