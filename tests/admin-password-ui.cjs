const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const mode=process.env.ADMIN_UI_MODE||'stage';
const base=process.env.SMOKE_BASE||'http://127.0.0.1:3111';
if(!['stage','verify-restart'].includes(mode)||base!=='http://127.0.0.1:3111')throw Error('Password mutation test requires the isolated staging origin');
const original='initial-stage-password';
const next='newpass8';
(async()=>{
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chromium',headless:true,args:[]});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  const login=async(p,password)=>{await p.goto(base+'/admin/login');await p.getByLabel('관리자 아이디').fill('admin');await p.getByLabel('관리자 비밀번호').fill(password);await Promise.all([p.waitForURL(base+'/admin'),p.getByRole('button',{name:'관리자 로그인',exact:true}).click()]);};
  const analytics=async p=>p.evaluate(async()=> (await fetch('/api/admin/analytics')).status);
  await login(page,mode==='verify-restart'?next:original);
  if(mode==='verify-restart'){
   assert.equal(await analytics(page),200);
   const bad=await context.request.post(base+'/api/demo-admin',{headers:{origin:base},form:{username:'admin',password:original},maxRedirects:0});assert.equal(bad.status(),401);
   console.log('PASS staging restart: changed password persists; initial environment password stays rejected');return;
  }
  await page.getByRole('link',{name:'비밀번호 변경',exact:true}).click();await page.getByRole('heading',{name:'비밀번호 변경',exact:true}).waitFor();
  const fields={current:page.getByLabel('현재 비밀번호',{exact:true}),fresh:page.getByLabel('새 비밀번호',{exact:true}),confirm:page.getByLabel('새 비밀번호 확인',{exact:true})};
  assert.equal(await fields.fresh.getAttribute('minlength'),'8');
  fs.mkdirSync('outputs',{recursive:true});
  await page.screenshot({path:'outputs/admin-password-'+mode+'-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'outputs/admin-password-'+mode+'-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});

  const other=await browser.newContext(),otherPage=await other.newPage();await login(otherPage,original);
  await fields.current.fill(original);await fields.fresh.fill('1234567');await fields.confirm.fill('1234567');
  await page.getByRole('button',{name:'비밀번호 변경',exact:true}).click();
  assert.equal(await fields.fresh.evaluate(el=>el.validity.tooShort),true);
  await fields.fresh.fill(next);await fields.confirm.fill('mismatch8');await page.getByRole('button',{name:'비밀번호 변경',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'일치하지'}).waitFor();
  await fields.current.fill('wrong-password');await fields.confirm.fill(next);await page.getByRole('button',{name:'비밀번호 변경',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'현재 비밀번호'}).waitFor();
  await fields.current.fill(original);await page.getByRole('button',{name:'비밀번호 변경',exact:true}).click();
  await page.getByRole('status').filter({hasText:'비밀번호를 변경했습니다'}).waitFor();
  assert.equal(await fields.current.inputValue(),'');assert.equal(await fields.fresh.inputValue(),'');assert.equal(await fields.confirm.inputValue(),'');
  assert.equal(await analytics(page),200);assert.equal(await analytics(otherPage),403);
  await page.screenshot({path:'outputs/admin-password-stage-success.png',fullPage:true});
  await page.getByRole('link',{name:'관리자 페이지로 돌아가기'}).click();
  await Promise.all([page.waitForURL(base+'/admin/login'),page.getByRole('button',{name:'로그아웃',exact:true}).click()]);
  const rejected=await context.request.post(base+'/api/demo-admin',{headers:{origin:base},form:{username:'admin',password:original},maxRedirects:0});assert.equal(rejected.status(),401);
  await login(page,next);assert.equal(await analytics(page),200);
  console.log('PASS staging UI: min 8, mismatch, wrong current, actual change, cleared inputs, other-session revocation, logout, old-password rejection and new-password login');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
