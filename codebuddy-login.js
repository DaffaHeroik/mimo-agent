const puppeteer = require('/home/work/.openclaw/tmp/node_modules/puppeteer-extra');
const StealthPlugin = require('/home/work/.openclaw/tmp/node_modules/puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOME = process.env.HOME;

(async () => {
  const email = 'respati1@bozztirex.us';
  const password = 'Daffa112233';

  const browser = await puppeteer.launch({
    executablePath: `${HOME}/.local/chrome/chrome`,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    // Open CodeBuddy auth page
    console.log('[1] Opening CodeBuddy auth page...');
    await page.goto('https://www.codebuddy.ai/auth/realms/copilot/protocol/openid-connect/auth?client_id=console&response_type=code&redirect_uri=https%3A%2F%2Fwww.codebuddy.ai%2Flogin%2Fselect%3Fredirect_uri%3Dhttps%253A%252F%252Fwww.codebuddy.ai%252Fregister%252Fuser%252Fcomplete&v=2210&product=codebuddy', { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(3000);
    
    // First, click "Log in" to switch to login mode
    console.log('[2] Switching to login mode...');
    const allLinks = await page.$$('a');
    for (const link of allLinks) {
      const text = (await page.evaluate(el => el.textContent.trim(), link));
      if (text === 'Log in') {
        await link.click();
        console.log('[✓] Clicked "Log in"');
        await sleep(3000);
        break;
      }
    }
    
    await page.screenshot({ path: '/home/work/.openclaw/workspace/cb-step1.png' });
    
    // Now click "Sign up with Google" (which also works for login)
    console.log('[3] Clicking Google login...');
    const allAnchors = await page.$$('a');
    for (const anchor of allAnchors) {
      const text = (await page.evaluate(el => el.textContent.trim(), anchor));
      const href = await page.evaluate(el => el.href || '', anchor);
      if (text.includes('Google') || href.includes('google')) {
        console.log(`[✓] Clicking: "${text}" href="${href}"`);
        await anchor.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        await sleep(5000);
        break;
      }
    }
    
    await page.screenshot({ path: '/home/work/.openclaw/workspace/cb-step2.png' });
    console.log('[URL after Google click]:', page.url());
    
    // Now on Google sign-in page
    if (page.url().includes('google') || page.url().includes('accounts.google')) {
      console.log('\n[4] On Google sign-in page');
      
      // Enter email
      console.log('[5] Entering email...');
      let emailInput;
      try { emailInput = await page.waitForSelector('input[type="email"]', { timeout: 5000 }); }
      catch { emailInput = await page.waitForSelector('input[type="text"]', { timeout: 10000 }); }
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(email, { delay: 60 });
      await sleep(1000);
      await page.keyboard.press('Enter');
      await sleep(5000);
      await page.screenshot({ path: '/home/work/.openclaw/workspace/cb-step3.png' });
      
      // Enter password
      console.log('[6] Entering password...');
      const pwd = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
      await pwd.click({ clickCount: 3 });
      await pwd.type(password, { delay: 60 });
      await sleep(1000);
      await page.keyboard.press('Enter');
      await sleep(5000);
      await page.screenshot({ path: '/home/work/.openclaw/workspace/cb-step4.png' });
      
      // Handle consent/speedbump
      console.log('[7] Handling post-login...');
      for (let i = 0; i < 10; i++) {
        await sleep(2000);
        const url = page.url();
        
        if (url.includes('codebuddy') && !url.includes('auth') && !url.includes('login')) {
          console.log('[✅] On CodeBuddy!');
          break;
        }
        
        if (url.includes('oauth') || url.includes('consent')) {
          console.log('  → Consent page...');
          const btns = await page.$$('button');
          for (const btn of btns) {
            const t = (await page.evaluate(el => el.textContent, btn)).trim().toLowerCase();
            if (t.includes('lanjutkan') || t.includes('continue') || t.includes('allow') || t.includes('accept')) {
              await btn.click();
              console.log(`  [✓] Clicked: "${t}"`);
              break;
            }
          }
          await sleep(3000); continue;
        }
        
        if (url.includes('speedbump') || url.includes('workspacetermsofservice')) {
          console.log('  → Speedbump...');
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await sleep(1000);
          const btns = await page.$$('button');
          for (const btn of btns) {
            const t = (await page.evaluate(el => el.textContent, btn)).trim().toLowerCase();
            if (t.includes('i understand') || t.includes('next') || t.includes('continue')) {
              await btn.click();
              break;
            }
          }
          await sleep(3000); continue;
        }
        
        break;
      }
    }
    
    await page.screenshot({ path: '/home/work/.openclaw/workspace/cb-final.png' });
    console.log('\n[Final URL]:', page.url());
    
    // Extract cookies
    const cookies = await page.cookies();
    const cbCookies = cookies.filter(c => c.domain.includes('codebuddy') || c.domain.includes('tencent'));
    console.log(`\n[8] Cookies: ${cbCookies.length}`);
    cbCookies.forEach(c => console.log(`  ${c.name} = ${c.value.substring(0, 60)}...`));
    
    fs.writeFileSync('/home/work/.openclaw/workspace/cb-cookies.json', JSON.stringify(cookies, null, 2));
    
    // Test CLI
    console.log('\n[9] Testing CodeBuddy CLI...');
    const { execSync } = require('child_process');
    try {
      const result = execSync('timeout 20 ~/.local/node_modules/.bin/codebuddy -p "Hello, what model are you? Reply in 1 sentence."', {
        encoding: 'utf-8',
        timeout: 25000
      });
      console.log('[✅] CLI Response:', result.trim());
    } catch (e) {
      console.log('[CLI Error]:', e.message.substring(0, 200));
    }
    
  } catch (e) {
    console.error('[Error]:', e.message);
    await page.screenshot({ path: '/home/work/.openclaw/workspace/cb-error.png' }).catch(() => {});
  }

  await browser.close();
  console.log('\n[DONE]');
})();
