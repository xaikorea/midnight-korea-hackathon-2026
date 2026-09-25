const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chromium',headless:true});try{
 const context=await browser.newContext(),page=await context.newPage(),base='http://localhost:5173',errors=[];page.on('pageerror',e=>errors.push(e.message));
 const before=await (await context.request.get(base+'/api/auth/session')).json();assert.equal(before.mode,'demo');assert.equal(before.authenticated,false);
 await page.goto(base+'/api/auth/login?return_to=/?view=settings',{waitUntil:'networkidle'});await page.getByRole('heading',{name:'로그인 · 업무 접근 권한'}).waitFor();
 const session=await (await context.request.get(base+'/api/auth/session')).json();assert.equal(session.authenticated,true);assert.equal(session.user.roles.length,5);assert.equal(session.accountUrl,null);
 assert.equal((await context.request.post(base+'/api/auth/logout',{headers:{origin:'https://evil.test'},maxRedirects:0})).status(),403);
 assert.equal((await context.request.post(base+'/api/auth/logout',{headers:{origin:base},maxRedirects:0})).status(),303);
 assert.deepEqual(errors,[]);await context.close();console.log('PASS authentication UI: unified demo login, session metadata, settings panel and same-origin logout.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
