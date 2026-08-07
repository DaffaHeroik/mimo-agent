const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const http = require('http');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOME = process.env.HOME;

function solveCaptcha(type, params) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ type, ...params });
    const req = http.request({
      hostname: '127.0.0.1', port: 8877, path: '/solve',
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(body); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  const email = 'respati1@bozztirex.us';
  const password = 'Daffa112233';

  const browser = await puppeteer.launch({
    executablePath: `${HOME}/.cache/puppeteer/chrome/linux-151.0.7922.71/chrome-linux64/chrome`,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    console.log('[1] Opening sign-up page...');
    await page.goto('https://adal.sylph.ai/sign-up', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(5000);

    // Solve Turnstile with real sitekey
    console.log('[2] Solving Turnstile (sitekey: 0x4AAAAAACgFhRGg50sdw9ZD)...');
    const result = await solveCaptcha('turnstile', {
      sitekey: '0x4AAAAAACgFhRGg50sdw9ZD',
      url: 'https://adal.sylph.ai/sign-up',
      timeout_s: 90
    });
    
    if (!result.token) {
      console.log('  ❌ No token:', JSON.stringify(result));
      await browser.close();
      return;
    }
    console.log('  ✅ Token obtained! (', result.token.substring(0, 50), '...)');

    // Inject token
    console.log('[3] Injecting token...');
    await page.evaluate((token) => {
      const input = document.querySelector('input[name="cf-turnstile-response"]');
      if (input) {
        input.value = token;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, result.token);
    await sleep(2000);

    // Enter email
    console.log('[4] Entering email...');
    const emailInput = await page.$('#identifier-field') || await page.$('input[name="identifier"]') || await page.$('input[type="text"]');
    if (emailInput) {
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(email, { delay: 80 });
      await sleep(1000);
      console.log('  ✅ Email entered');
    }

    // Click Continue
    console.log('[5] Clicking Continue...');
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        const t = b.textContent.trim().toLowerCase();
        if (t === 'continue') { b.click(); return; }
      }
    });
    await sleep(5000);
    console.log('  URL:', page.url());
    
    let bodyText = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
    console.log('  Body:', bodyText.substring(0, 300).replace(/\n/g, ' | '));
    await page.screenshot({ path: 'adal-after-continue.png' });

    // Check for password field
    const pwd = await page.$('input[type="password"]');
    if (pwd) {
      console.log('[6] Password field found! Setting password...');
      await pwd.click({ clickCount: 3 });
      await pwd.type(password, { delay: 80 });
      await sleep(500);
      
      // Check for confirm password
      const pwdFields = await page.$$('input[type="password"]');
      if (pwdFields.length > 1) {
        console.log('  Confirm password...');
        await pwdFields[1].click({ clickCount: 3 });
        await pwdFields[1].type(password, { delay: 80 });
        await sleep(500);
      }
      
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const b of btns) {
          const t = b.textContent.trim().toLowerCase();
          if (t.includes('continue') || t.includes('sign up') || t.includes('create')) { b.click(); break; }
        }
      });
      await sleep(8000);
      console.log('  URL:', page.url());
    }

    // Check for verification code
    const codeInput = await page.$('input[type="tel"]') || await page.$('input[inputmode="numeric"]') || await page.$('input[autocomplete="one-time-code"]');
    if (codeInput) {
      console.log('[6] ⚠️ Email verification code required!');
      console.log('  Need to check email for code...');
      await page.screenshot({ path: 'adal-verify-code.png' });
    }

    // Check for "Use password instead"
    const usePwd = await page.evaluate(() => {
      const els = document.querySelectorAll('a, button, span');
      for (const el of els) {
        const t = (el.textContent || '').toLowerCase();
        if (t.includes('password') && t.includes('instead')) { el.click(); return t; }
      }
      return null;
    });
    if (usePwd) {
      console.log('  Clicked:', usePwd);
      await sleep(3000);
      const newPwd = await page.$('input[type="password"]');
      if (newPwd) {
        await newPwd.click({ clickCount: 3 });
        await newPwd.type(password, { delay: 80 });
        await sleep(1000);
        await page.evaluate(() => {
          const btns = document.querySelectorAll('button');
          for (const b of btns) {
            const t = b.textContent.trim().toLowerCase();
            if (t.includes('continue') || t.includes('sign')) { b.click(); break; }
          }
        });
        await sleep(8000);
      }
    }

    // Post-signup loop
    console.log('\n[7] Post-signup...');
    for (let i = 0; i < 10; i++) {
      await sleep(2000);
      const url = page.url();
      bodyText = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
      console.log(`  [${i}] ${url.substring(0, 80)}`);

      if (url.includes('adalagent') || (url.includes('adal') && !url.includes('sign-in') && !url.includes('sign-up') && !url.includes('clerk'))) {
        console.log('\n✅ SIGNED UP & LOGGED IN!');
        break;
      }

      if (bodyText.includes('restricted') || bodyText.includes('blocked')) {
        console.log('  ⚠️ BLOCKED');
        break;
      }

      const uat = await page.evaluate(() => {
        const m = document.cookie.match(/__client_uat=(\d+)/);
        return m ? m[1] : null;
      });
      if (uat && uat !== '0') {
        console.log(`  ✅ __client_uat=${uat} (authenticated!)`);
      }

      // Consent
      const consent = await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const b of btns) {
          const t = b.textContent.trim().toLowerCase();
          if (t.includes('continue') || t.includes('allow') || t.includes('accept')) { b.click(); return t; }
        }
        return null;
      });
      if (consent) { console.log(`  Consent: "${consent}"`); await sleep(3000); continue; }

      break;
    }

    await page.screenshot({ path: 'adal-final.png' });
    console.log('\n[Final URL]:', page.url());

    const cookies = await page.cookies();
    const authCookies = cookies.filter(c => c.domain.includes('adal') || c.domain.includes('clerk') || c.domain.includes('sylph'));
    console.log('[Cookies]:', authCookies.length);
    authCookies.forEach(c => console.log(`  ${c.domain} | ${c.name} = ${c.value.substring(0, 50)}`));
    fs.writeFileSync('adal-cookies-new.json', JSON.stringify(cookies, null, 2));

    // Test CLI
    console.log('\n[8] Testing AdaL CLI...');
    const { execSync } = require('child_process');
    try {
      const result = execSync('timeout 20 ~/.local/bin/adal -p "Hello, what model are you?"', {
        encoding: 'utf-8', timeout: 25000
      });
      console.log('[✅] CLI:', result.trim().substring(0, 200));
    } catch (e) {
      console.log('[CLI]:', e.message.substring(0, 200));
    }

  } catch (e) {
    console.error('[Error]:', e.message);
    await page.screenshot({ path: 'adal-error.png' }).catch(() => {});
  }

  await browser.close();
  console.log('[DONE]');
})();
