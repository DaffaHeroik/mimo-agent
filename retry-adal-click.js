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

    // First, enter email BEFORE solving Turnstile
    console.log('[2] Entering email...');
    const emailInput = await page.$('#identifier-field') || await page.$('input[name="identifier"]') || await page.$('input[type="text"]');
    if (emailInput) {
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(email, { delay: 80 });
      await sleep(1000);
      console.log('  ✅ Email entered');
    }

    // Now solve Turnstile
    console.log('[3] Solving Turnstile...');
    const result = await solveCaptcha('turnstile', {
      sitekey: '0x4AAAAAACgFhRGg50sdw9ZD',
      url: 'https://adal.sylph.ai/sign-up',
      timeout_s: 90
    });
    
    if (!result.token) {
      console.log('  ❌ No token');
      await browser.close();
      return;
    }
    console.log('  ✅ Token:', result.token.substring(0, 50) + '...');

    // Inject token AND trigger Turnstile callback
    console.log('[4] Injecting token + triggering callback...');
    const injected = await page.evaluate((token) => {
      // Set the hidden input value
      const input = document.querySelector('input[name="cf-turnstile-response"]');
      if (input) {
        input.value = token;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      // Try to call turnstile callback if available
      if (window.turnstile) {
        try {
          // Get the widget ID
          const widgets = window.turnstile.getResponse();
          console.log('Turnstile response:', widgets);
        } catch (e) {}
      }
      
      // Try to find and call the callback function
      const callbackName = document.querySelector('[data-callback]')?.getAttribute('data-callback');
      if (callbackName && typeof window[callbackName] === 'function') {
        window[callbackName](token);
        return 'callback called';
      }
      
      // Check for Clerk's internal state
      const clerkState = window.__clerk_state || window.__clerk || window.Clerk;
      if (clerkState) {
        return 'clerk state found';
      }
      
      return 'injected';
    }, result.token);
    console.log('  Inject result:', injected);
    
    await sleep(2000);
    
    // Try clicking the Turnstile checkbox area
    console.log('[5] Clicking Turnstile checkbox...');
    const checkboxClicked = await page.evaluate(() => {
      // Find the turnstile iframe
      const iframe = document.querySelector('iframe[src*="turnstile"]') || document.querySelector('iframe[src*="challenges.cloudflare"]');
      if (iframe) {
        const rect = iframe.getBoundingClientRect();
        return { x: rect.x + 30, y: rect.y + 20, width: rect.width, height: rect.height };
      }
      
      // Find the turnstile container
      const container = document.querySelector('.turnstile-container') || document.querySelector('#turnstile-widget');
      if (container) {
        const rect = container.getBoundingClientRect();
        return { x: rect.x + 30, y: rect.y + 20, width: rect.width, height: rect.height };
      }
      
      return null;
    });
    console.log('  Checkbox position:', JSON.stringify(checkboxClicked));
    
    if (checkboxClicked) {
      await page.mouse.click(checkboxClicked.x, checkboxClicked.y);
      console.log('  Clicked!');
      await sleep(5000);
    }
    
    // Check if verification passed
    const verifyText = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
    console.log('  Body after click:', verifyText.substring(0, 200).replace(/\n/g, ' | '));
    await page.screenshot({ path: 'adal-after-click.png' });

    // Now click Continue
    console.log('[6] Clicking Continue...');
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        const t = b.textContent.trim().toLowerCase();
        if (t === 'continue') { b.click(); return; }
      }
    });
    await sleep(5000);
    console.log('  URL:', page.url());
    
    const afterBody = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
    console.log('  Body:', afterBody.substring(0, 300).replace(/\n/g, ' | '));
    await page.screenshot({ path: 'adal-after-continue.png' });

    // Check for password field
    const pwd = await page.$('input[type="password"]');
    if (pwd) {
      console.log('[7] Password field!');
      await pwd.click({ clickCount: 3 });
      await pwd.type(password, { delay: 80 });
      await sleep(1000);
      
      const pwdFields = await page.$$('input[type="password"]');
      if (pwdFields.length > 1) {
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
      console.log('[7] ⚠️ Email verification code required!');
      await page.screenshot({ path: 'adal-verify.png' });
    }

    // __client_uat check
    const uat = await page.evaluate(() => {
      const m = document.cookie.match(/__client_uat=(\d+)/);
      return m ? m[1] : null;
    });
    console.log(`  __client_uat: ${uat}`);

    await page.screenshot({ path: 'adal-final.png' });
    console.log('\n[Final URL]:', page.url());

    const cookies = await page.cookies();
    console.log('[Cookies]:', cookies.length);
    cookies.forEach(c => console.log(`  ${c.domain} | ${c.name} = ${c.value.substring(0, 50)}`));
    fs.writeFileSync('adal-cookies-new.json', JSON.stringify(cookies, null, 2));

  } catch (e) {
    console.error('[Error]:', e.message);
    await page.screenshot({ path: 'adal-error.png' }).catch(() => {});
  }

  await browser.close();
  console.log('[DONE]');
})();
