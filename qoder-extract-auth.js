const puppeteer = require('/home/work/.openclaw/tmp/node_modules/puppeteer-extra');
const StealthPlugin = require('/home/work/.openclaw/tmp/node_modules/puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const TMP = '/home/work/.openclaw/tmp';
const QODER_LOGIN_URL = 'https://qoder.com/users/sign-in';

function loadAccounts(file) {
  const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
  return lines.map(line => {
    const [email, password] = line.split('|').map(s => s.trim());
    return { email, password };
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function clickVisibleButton(page, ...texts) {
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const btnText = (await page.evaluate(el => el.textContent, btn)).trim().toLowerCase();
    const disabled = await page.evaluate(el => el.disabled, btn);
    const visible = await page.evaluate(el => el.offsetParent !== null, btn);
    if (disabled || !visible) continue;
    for (const t of texts) {
      if (btnText.includes(t.toLowerCase())) {
        await btn.scrollIntoViewIfNeeded();
        await sleep(500);
        await btn.click();
        console.log(`    [✓] Clicked: "${btnText}"`);
        return true;
      }
    }
  }
  return false;
}

(async () => {
  const accountsFile = process.argv[2] || 'accounts.txt';
  if (!fs.existsSync(accountsFile)) {
    console.error(`[✗] File not found: ${accountsFile}`);
    process.exit(1);
  }

  const accounts = loadAccounts(accountsFile);
  console.log(`[INFO] Loaded ${accounts.length} account(s)\n`);

  const browser = await puppeteer.launch({
    executablePath: process.env.HOME + '/.local/chrome/chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  for (const { email, password } of accounts) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[▶] ${email}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    try {
      // Step 1: Open Qoder
      console.log('\n[1] Opening Qoder...');
      await page.goto(QODER_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2000);

      // Step 2: Click Google
      console.log('[2] Clicking Google...');
      const googleLink = await page.$('a[href*="sso/login/google"]');
      if (googleLink) await googleLink.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await sleep(3000);

      // Step 3: Email
      console.log('[3] Entering email...');
      let emailInput;
      try { emailInput = await page.waitForSelector('input[type="email"]', { timeout: 5000 }); }
      catch { emailInput = await page.waitForSelector('input[type="text"]', { timeout: 10000 }); }
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(email, { delay: 60 });
      await sleep(1000);
      await page.keyboard.press('Enter');
      await sleep(5000);

      // Step 4: Password
      console.log('[4] Entering password...');
      const pwdInput = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
      await pwdInput.click({ clickCount: 3 });
      await pwdInput.type(password, { delay: 60 });
      await sleep(1000);
      await page.keyboard.press('Enter');
      await sleep(5000);

      // Step 5: Handle consent/speedbump
      console.log('[5] Handling post-login flow...');
      for (let i = 0; i < 10; i++) {
        await sleep(2000);
        const url = page.url();
        
        if (url.includes('qoder.com') && !url.includes('sign-in')) {
          console.log('[✅] On Qoder!');
          break;
        }
        
        if (url.includes('oauth/id') || url.includes('consent') || url.includes('signin/oauth')) {
          console.log('  → Consent page, clicking...');
          await clickVisibleButton(page, 'lanjutkan', 'continue', 'allow', 'accept', 'confirm');
          await sleep(3000);
          continue;
        }
        
        if (url.includes('speedbump') || url.includes('workspacetermsofservice')) {
          console.log('  → Speedbump, accepting...');
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await sleep(1000);
          await clickVisibleButton(page, 'i understand', 'understand', 'next', 'continue', 'review terms', 'review');
          await sleep(3000);
          continue;
        }
        
        if (url.includes('challenge/pwd')) {
          console.log('  → Password challenge, re-entering...');
          const pwd2 = await page.$('input[type="password"]');
          if (pwd2) {
            await pwd2.click({ clickCount: 3 });
            await pwd2.type(password, { delay: 60 });
            await sleep(500);
            await page.keyboard.press('Enter');
            await sleep(5000);
          }
          continue;
        }
        
        break;
      }

      // Step 6: Extract cookies
      console.log('\n[6] Extracting auth data...');
      
      // Get all cookies
      const cookies = await page.cookies();
      console.log(`[INFO] Found ${cookies.length} cookies`);
      
      // Filter qoder-related cookies
      const qoderCookies = cookies.filter(c => 
        c.domain.includes('qoder') || c.name.includes('token') || c.name.includes('auth') || 
        c.name.includes('session') || c.name.includes('access') || c.name.includes('refresh')
      );
      
      console.log(`[INFO] Qoder-related cookies: ${qoderCookies.length}`);
      qoderCookies.forEach(c => {
        console.log(`  ${c.name} = ${c.value.substring(0, 40)}... (domain: ${c.domain})`);
      });

      // Also try to get tokens from localStorage
      const localStorage = await page.evaluate(() => {
        const items = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          items[key] = window.localStorage.getItem(key);
        }
        return items;
      });
      
      console.log(`[INFO] localStorage keys: ${Object.keys(localStorage).join(', ')}`);
      
      // Check for auth tokens in localStorage
      for (const [key, value] of Object.entries(localStorage)) {
        if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth') || 
            key.toLowerCase().includes('session') || key.toLowerCase().includes('access')) {
          console.log(`  ${key} = ${value.substring(0, 60)}...`);
        }
      }

      // Save cookies to file
      const cookieFile = path.join(TMP, `cookies-${email}.json`);
      fs.writeFileSync(cookieFile, JSON.stringify(cookies, null, 2));
      console.log(`\n[✓] Cookies saved: ${cookieFile}`);

      // Save localStorage to file
      const lsFile = path.join(TMP, `localStorage-${email}.json`);
      fs.writeFileSync(lsFile, JSON.stringify(localStorage, null, 2));
      console.log(`[✓] localStorage saved: ${lsFile}`);

      // Try to extract auth header from a page request
      const authHeaders = await page.evaluate(() => {
        // Check for any stored auth data
        const meta = document.querySelector('meta[name="auth-token"]');
        const csrfToken = document.querySelector('meta[name="csrf-token"]');
        return {
          authToken: meta ? meta.content : null,
          csrfToken: csrfToken ? csrfToken.content : null
        };
      });
      
      if (authHeaders.authToken || authHeaders.csrfToken) {
        console.log(`[INFO] Auth token: ${authHeaders.authToken || 'N/A'}`);
        console.log(`[INFO] CSRF token: ${authHeaders.csrfToken || 'N/A'}`);
      }

      // Final status
      const finalUrl = page.url();
      console.log(`\n[INFO] Final URL: ${finalUrl}`);
      
      if (finalUrl.includes('qoder.com') && !finalUrl.includes('sign-in')) {
        console.log(`\n✅ [SUCCESS] ${email} logged in & cookies exported!`);
      }

    } catch (err) {
      console.error(`\n✗ Error: ${err.message}`);
    }

    await page.close();
  }

  await browser.close();
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[DONE]');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
})();
