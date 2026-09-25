// Browser-only status fixtures complement the actual submission test. No application is submitted.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const base=process.env.SMOKE_BASE||'http://127.0.0.1:3112';
if(base!=='http://127.0.0.1:3112')throw Error('Visual status fixtures require the isolated staging origin');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chromium'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  let run={id:'visual-status-fixture',companyId:'fixture-company',companyName:'상태 검증용 가상 기업',startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'running',committed:false,historySaved:true,policies:[{id:'buyer',audience:'검증용 구매사'},{id:'grant',audience:'검증용 지원기관'}],events:[],engine:{signature:'Ed25519',policy:'local',networkConnected:false}};
  function add(policyId,stage,state,data={}){run.events.push({seq:run.events.length+1,policyId,stage,state,message:'브라우저 상태 검증용 가상 기록',at:run.updatedAt,elapsedMs:run.events.length*2,data});}
  add('buyer','access','success');add('buyer','credential','running');
  await page.route('**/api/process-runs',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({runs:[run]})}));
  await page.goto(base+'/process');const animation=page.getByRole('region',{name:'처리 과정 애니메이션'});
  await animation.waitFor();assert.equal(await animation.getAttribute('data-mode'),'live');
  assert.equal(await animation.locator('[data-stage=credential]').getAttribute('data-state'),'running');
  assert.equal(await animation.getAttribute('data-motion'),'on');
  assert.ok(await animation.evaluate(el=>el.getAnimations({subtree:true}).some(a=>a.playState==='running')));
  await animation.getByRole('button',{name:'동작 효과 끄기',exact:true}).click();assert.equal(await animation.getAttribute('data-motion'),'off');
  await animation.getByRole('button',{name:'동작 효과 켜기',exact:true}).click();
  run={...run,updatedAt:new Date(Date.now()-60000).toISOString()};await page.getByRole('button',{name:'새로고침',exact:true}).click();
  await page.getByText('최근 갱신 없음 · 상태 재확인 필요',{exact:true}).waitFor();assert.equal(await animation.getAttribute('data-motion'),'off');
  add('buyer','credential','failed');add('grant','policy','success',{eligible:false});add('grant','verification','waiting');add(undefined,'commit','success');
  run={...run,status:'partial',committed:true,updatedAt:new Date().toISOString(),completedAt:new Date().toISOString()};
  await page.getByRole('button',{name:'새로고침',exact:true}).click();await page.getByText('일부 처리 완료',{exact:true}).waitFor();
  assert.equal(await animation.locator('[data-stage=credential]').getAttribute('data-state'),'failed');
  assert.equal(await animation.locator('[data-stage=policy]').getAttribute('data-state'),'unmet');
  assert.equal(await animation.locator('[data-stage=verification]').getAttribute('data-state'),'waiting');
  assert.equal(await animation.locator('[data-stage=commit]').getAttribute('data-state'),'success');
  await animation.getByRole('button',{name:'과정 다시보기',exact:true}).click();
  await page.waitForFunction(()=>Number(document.querySelector('.process-animation')?.getAttribute('data-cursor'))>=2);
  // Exercise the visibility subscription without relying on headless tab foreground behavior.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>document.querySelector('.process-animation')?.getAttribute('data-motion')==='off');
  const cursor=await animation.getAttribute('data-cursor');await page.waitForTimeout(1000);assert.equal(await animation.getAttribute('data-cursor'),cursor);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(previous=>Number(document.querySelector('.process-animation')?.getAttribute('data-cursor'))>previous,Number(cursor));
  await animation.getByRole('button',{name:'실제 결과 보기',exact:true}).click();
  await page.screenshot({path:'outputs/process-animation-status-fixture.png',fullPage:false});
  console.log('PASS browser status fixtures: live CSS animation, motion switch, stale stop, failure/manual/unmet/commit distinction, hidden-tab pause and resume');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
