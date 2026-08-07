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
    console.log('  URL:', page.url());

    // Extract Turnstile sitekey
    console.log('[2] Extracting Turnstile sitekey...');
    const turnstileInfo = await page.evaluate(() => {
      // Method 1: data-sitekey attribute
      let el = document.querySelector('[data-sitekey]');
      if (el) return { sitekey: el.getAttribute('data-sitekey'), method: 'data-attr' };
      
      // Method 2: cf-turnstile div
      el = document.querySelector('.cf-turnstile');
      if (el) return { sitekey: el.getAttribute('data-sitekey'), method: 'cf-turnstile' };
      
      // Method 3: iframe src
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        const src = iframe.src || '';
        const match = src.match(/sitekey=([^&]+)/);
        if (match) return { sitekey: match[1], method: 'iframe' };
      }
      
      // Method 4: script tags
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        const text = s.textContent || '';
        const match = text.match(/sitekey['":\s]+['"]([0-9a-zA-Z_-]+)['"]/);
        if (match) return { sitekey: match[1], method: 'script' };
      }
      
      // Method 5: hidden input
      el = document.querySelector('input[name="cf-turnstile-response"]');
      if (el) {
        // Get parent widget
        const widget = el.closest('[data-sitekey]') || el.parentElement;
        if (widget) return { sitekey: widget.getAttribute('data-sitekey'), method: 'parent' };
      }
      
      // Method 6: check all elements with sitekey
      const allEls = document.querySelectorAll('*');
      for (const e of allEls) {
        const sk = e.getAttribute('data-sitekey');
        if (sk) return { sitekey: sk, method: 'scan' };
      }
      
      return { sitekey: null, method: 'none', html: document.body.innerHTML.substring(0, 2000) };
    });
    console.log('  Sitekey:', turnstileInfo.sitekey || 'NOT FOUND');
    console.log('  Method:', turnstileInfo.method);

    // If no sitekey found, try to get from network requests
    if (!turnstileInfo.sitekey) {
      console.log('  Trying network interception...');
      const sitekey = await page.evaluate(() => {
        // Check turnstile script URL
        const scripts = document.querySelectorAll('script[src*="turnstile"]');
        for (const s of scripts) {
          const match = s.src.match(/sitekey=([^&]+)/);
          if (match) return match[1];
        }
        return null;
      });
      if (sitekey) {
        console.log('  Found from script:', sitekey);
        turnstileInfo.sitekey = sitekey;
      }
    }

    // If still no sitekey, use a known Clerk Turnstile sitekey
    if (!turnstileInfo.sitekey) {
      console.log('  ⚠️ No sitekey found, trying common Clerk Turnstile keys...');
      // Clerk typically uses these Turnstile sitekeys
      const commonKeys = [
        '0x4AAAAAAABnp1QeF6Mg',  // Cloudflare default
        '0x4AAAAAAABnp4yK1tSv2wSV',  // Common Clerk key
      ];
      turnstileInfo.sitekey = commonKeys[0];
    }

    // Solve Turnstile
    console.log('\n[3] Solving Turnstile captcha...');
    console.log('  Sitekey:', turnstileInfo.sitekey);
    console.log('  URL: https://adal.sylph.ai/sign-up');
    
    const result = await solveCaptcha('turnstile', {
      sitekey: turnstileInfo.sitekey,
      url: 'https://adal.sylph.ai/sign-up',
      timeout_s: 90
    });
    
    console.log('  Result:', JSON.stringify(result).substring(0, 300));
    
    if (result.token || result.solution) {
      const token = result.token || result.solution;
      console.log('\n[4] Injecting Turnstile token...');
      
      // Inject token
      await page.evaluate((token) => {
        const input = document.querySelector('input[name="cf-turnstile-response"]');
        if (input) {
          input.value = token;
          // Trigger change events
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // Also try setting via Turnstile API
        if (window.turnstile) {
          try { window.turnstile.getResponse(); } catch {}
        }
      }, token);
      
      await sleep(2000);
      
      // Now enter email
      console.log('[5] Entering email...');
      const emailInput = await page.$('#identifier-field') || await page.$('input[name="identifier"]') || await page.$('input[type="text"]') || await page.$('input[type="email"]');
      if (emailInput) {
        await emailInput.click({ clickCount: 3 });
        await emailInput.type(email, { delay: 80 });
        await sleep(1000);
        console.log('  ✅ Email entered');
      }
      
      // Click Continue
      console.log('[6] Clicking Continue...');
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const b of btns) {
          const t = b.textContent.trim().toLowerCase();
          if (t === 'continue' || t.includes('sign up')) { b.click(); return; }
        }
      });
      await sleep(5000);
      console.log('  URL:', page.url());
      
      // Check result
      const bodyText = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
      console.log('  Body:', bodyText.substring(0, 300).replace(/\n/g, ' | '));
      await page.screenshot({ path: 'adal-after-turnstile.png' });
      
      // Check for password field
      const pwd = await page.$('input[type="password"]');
      if (pwd) {
        console.log('[7] Password field found!');
        await pwd.click({ clickCount: 3 });
        await pwd.type(password, { delay: 80 });
        await sleep(1000);
        
        const pwdFields = await page.$$('input[type="password"]');
        if (pwdFields.length > 1) {
          await pwdFields[1].click({ clickCount: 3 });
          await pwdFields[1].type(password, { delay: 80 });
          await sleep(1000);
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
      }
      
      // __client_uat check
      const uat = await page.evaluate(() => {
        const m = document.cookie.match(/__client_uat=(\d+)/);
        return m ? m[1] : null;
      });
      console.log(`  __client_uat: ${uat}`);
    } else {
      console.log('  ❌ No token received from solver');
      console.log('  Full response:', JSON.stringify(result));
    }

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
