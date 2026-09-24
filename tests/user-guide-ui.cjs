const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.SMOKE_BASE||'http://127.0.0.1:3114';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:base.startsWith('https://bizproof.')?['--host-resolver-rules=MAP bizproof.xaikorea.ai.kr 203.0.113.10']:[]});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage(),errors=[];
 page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await ctx.addCookies([{name:'bp-analytics-optout',value:'1',url:base}]);
 await ctx.addInitScript(()=>localStorage.setItem('bp-analytics-notice','1'));
 try{
  fs.mkdirSync('outputs',{recursive:true});
  await page.goto(base+'/guide',{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'이용자 가이드',exact:true}).waitFor();
  assert.equal(await page.locator('article.guide-topic').count(),22);
  assert.equal(await page.locator('time').getAttribute('datetime'),'2026-09-24');
  assert.equal(await page.locator('.guide-essential-steps > li').count(),3);
  assert.equal(await page.locator('#guide-faq details').count(),12);
  const search=page.getByLabel('이용자 가이드 검색');
  await search.fill('애니메이션');assert.ok(await page.locator('#guide-process').count());assert.ok(await page.locator('article.guide-topic').count()<22);
  // A shortcut must restore filtered-out articles before navigating to its anchor.
  await page.locator('.guide-extra-help').first().locator('summary').click();
  await page.getByRole('link',{name:'보유 자격 검사',exact:true}).click();
  assert.equal(await search.inputValue(),'');await page.locator('#guide-credentials').waitFor();assert.ok(page.url().endsWith('#guide-credentials'));
  await search.fill('비밀번호');assert.ok((await page.locator('#guide-admin-password').innerText()).includes('8자 이상'));
  assert.equal(await page.locator('#guide-admin-password .guide-open').getAttribute('href'),'/admin/security');
  await search.fill('no-such-topic-987');await page.getByRole('heading',{name:'검색 결과가 없습니다.'}).waitFor();
  await page.getByRole('button',{name:'모든 안내 보기'}).click();assert.equal(await page.locator('article.guide-topic').count(),22);
  await page.getByText('완료라고 나오는데 애니메이션은 계속 움직여요.',{exact:true}).click();
  assert.match(await page.locator('#guide-faq details[open]').innerText(),/중복 제출되지 않습니다/);
  await page.getByText('제출했는데 아직 완료가 아니에요.',{exact:true}).click();
  assert.match(await page.locator('#guide-analytics').innerText(),/검색은 목록에만/);
  assert.match(await page.locator('#guide-privacy').innerText(),/직접 입력한 이름은 미인증/);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'outputs/guide-current-desktop.png'});
  await page.locator('#guide-public-demo').scrollIntoViewIfNeeded();await page.screenshot({path:'outputs/guide-current-quickstart.png'});
  await page.setViewportSize({width:390,height:844});
  for(const selector of ['.guide-hero','#guide-public-demo','#guide-process','#guide-admin-password']){
   await page.locator(selector).scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.locator('#guide-public-demo').scrollIntoViewIfNeeded();await page.screenshot({path:'outputs/guide-current-mobile.png'});
  await page.goto(base+'/?view=guide',{waitUntil:'networkidle'});await page.getByRole('heading',{name:'대상을 고르고, 확인한 뒤 제출하세요.',exact:true}).waitFor();
  await page.goto(base+'/welcome',{waitUntil:'domcontentloaded'});
  const notice=page.getByLabel('방문 분석 안내',{exact:true});if(await notice.isVisible())await notice.getByRole('button',{name:'확인',exact:true}).click();
  await page.getByRole('button',{name:'내 체험 공간 시작하기'}).click();await page.waitForURL('**/?view=apply');await page.getByRole('button',{name:'모두 선택',exact:true}).waitFor();
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'이용자 가이드',exact:true}).click();await page.getByRole('heading',{name:'이용자 가이드',exact:true}).waitFor();
  assert.equal(await page.locator('article.guide-topic').count(),22);
  await page.locator('#guide-process .guide-open').click();await page.waitForURL('**/process');await page.getByRole('heading',{name:'처리 과정 관제',exact:true}).waitFor();
  await page.goto(base+'/?view=guide',{waitUntil:'networkidle'});
  await page.locator('#guide-credentials .guide-open').click();await page.waitForURL('**/?view=credentials');await page.getByRole('button',{name:'자격 보기',exact:true}).waitFor();
  await page.goto(base+'/?view=guide',{waitUntil:'networkidle'});
  await page.locator('#guide-admin-password .guide-open').click();await page.waitForURL('**/admin/login');
  await page.goto(base+'/signout-with-chatgpt',{waitUntil:'domcontentloaded'});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,base,topics:22,faq:12,checks:['current three-step flow','animation and password search','shortcut resets search','FAQ','mobile overflow','anonymous and signed-in guide','menu and feature links','admin link requires authentication']}));
 }finally{await ctx.close();await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
