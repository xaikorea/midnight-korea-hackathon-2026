// Read-only public deployment check. No password-change request is sent.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const base='https://bizproof.xaikorea.ai.kr';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--host-resolver-rules=MAP bizproof.xaikorea.ai.kr 203.0.113.10']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  let attemptedChange=false;
  // Defense in depth: even an accidental form submission cannot reach the change endpoint.
  await context.route('**/api/admin/password',route=>{attemptedChange=true;return route.abort()});
  const page=await context.newPage();
  await page.goto(base+'/admin/security');await page.waitForURL(base+'/admin/login');
  const password=fs.readFileSync('outputs/test-admin-access.txt','utf8').split(/\r?\n/).find(s=>s.startsWith('Password: ')).slice(10);
  await page.getByLabel('관리자 아이디').fill('admin');await page.getByLabel('관리자 비밀번호').fill(password);
  await Promise.all([page.waitForURL(base+'/admin'),page.getByRole('button',{name:'관리자 로그인',exact:true}).click()]);
  await page.getByRole('link',{name:'비밀번호 변경',exact:true}).click();
  await page.getByRole('heading',{name:'비밀번호 변경',exact:true}).waitFor();
  for(const name of ['현재 비밀번호','새 비밀번호','새 비밀번호 확인'])assert.equal(await page.getByLabel(name,{exact:true}).count(),1);
  assert.equal(await page.getByLabel('새 비밀번호',{exact:true}).getAttribute('minlength'),'8');
  assert.equal(await page.getByLabel('새 비밀번호 확인',{exact:true}).getAttribute('minlength'),'8');
  fs.mkdirSync('outputs',{recursive:true});await page.screenshot({path:'outputs/admin-password-public-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'outputs/admin-password-public-mobile.png',fullPage:true});
  const fresh=page.getByLabel('새 비밀번호',{exact:true});await fresh.fill('1234567');
  assert.equal(await fresh.evaluate(el=>el.validity.tooShort),true);await fresh.fill('');
  assert.equal(await page.evaluate(async()=> (await fetch('/api/admin/analytics')).status),200);
  assert.equal(attemptedChange,false);
  console.log('PASS public read-only: anonymous redirect, existing login, password menu, required fields, min 8, desktop/mobile, authorized analytics; no password-change request sent');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
