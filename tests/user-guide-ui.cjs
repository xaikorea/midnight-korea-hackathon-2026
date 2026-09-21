const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:5173/guide',{waitUntil:'networkidle'});
await page.getByRole('heading',{name:'이용자 가이드',exact:true}).waitFor();
assert.equal(await page.locator('article.guide-topic').count(),19);
await page.getByLabel('이용자 가이드 검색').fill('Midnight');assert.ok(await page.locator('article.guide-topic').count()<19);
await page.getByRole('button',{name:'초기화',exact:true}).click();
await page.getByLabel('이용자 가이드 검색').fill('no-such-topic-987');await page.getByRole('heading',{name:'검색 결과가 없습니다.'}).waitFor();
await page.getByRole('button',{name:'모든 안내 보기'}).click();assert.equal(await page.locator('article.guide-topic').count(),19);
await page.getByText('제출했는데 아직 완료가 아니에요.',{exact:true}).click();assert.ok(await page.locator('details[open]').count());
await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'outputs/guide-desktop.png'});
await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'outputs/guide-mobile.png'});
await page.goto('http://localhost:5173/?view=guide',{waitUntil:'networkidle'});await page.getByRole('heading',{name:'처음부터, 한 단계씩 함께해요.'}).waitFor();
await page.goto('http://localhost:5173/signin-with-chatgpt?return_to=/',{waitUntil:'networkidle'});await page.setViewportSize({width:1440,height:1000});
await page.getByRole('button',{name:'이용자 가이드',exact:true}).click();await page.getByRole('heading',{name:'이용자 가이드',exact:true}).waitFor();assert.ok(page.url().includes('view=guide'));
await page.locator('#guide-companies').getByRole('link',{name:/이 기능 열기/}).click();await page.getByRole('heading',{name:/공급업체 관계 관리/}).waitFor();assert.ok(page.url().includes('view=companies'));
assert.deepEqual(errors,[]);console.log('PASS: public/anonymous guide, 19 topics, search/reset/empty, FAQ, mobile width, menu navigation and feature link');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});


