const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');

(async()=>{const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chromium'});const page=await browser.newPage({viewport:{width:1440,height:1040}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5173/signin-with-chatgpt?return_to=/',{waitUntil:'networkidle',timeout:90000});await page.getByRole('heading',{name:'한 번의 자격, 더 많은 기회.'}).waitFor();await page.getByText('기업 자격을 불러오는 중입니다.').waitFor({state:'hidden'});await page.screenshot({path:'outputs/bizproof-overview.png',fullPage:true});console.log('body', (await page.locator('.content').innerText()).slice(0,2500));console.log('errors',errors);await browser.close();})().catch(e=>{console.error(e);process.exit(1)});


