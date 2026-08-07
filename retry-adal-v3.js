const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const http = require('http');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOME = process.env.HOME;

async function solveCaptcha(type, params) {
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
    console.log('[1] Loading adal.ai...');
    await page.goto('https://adal.ai', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(5000);
    console.log('  URL:', page.url());

    // Check for Turnstile
    console.log('[2] Checking for Turnstile captcha...');
    const turnstileInfo = await page.evaluate(() => {
      // Find Turnstile widget
      const widget = document.querySelector('[data-sitekey]') || 
                     document.querySelector('.cf-turnstile') ||
                     document.querySelector('iframe[src*="turnstile"]') ||
                     document.querySelector('iframe[src*="challenges.cloudflare"]');
      
      // Get sitekey from various sources
      let sitekey = null;
      const sitekeyEl = document.querySelector('[data-sitekey]');
      if (sitekeyEl) sitekey = sitekeyEl.getAttribute('data-sitekey');
      
      // Check iframe src for sitekey
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        const src = iframe.src || '';
        const match = src.match(/sitekey=([^&]+)/);
        if (match) sitekey = match[1];
      }
      
      // Check script tags
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        const text = s.textContent || '';
        const match = text.match(/sitekey['":\s]+['"]([0-9a-zA-Z_-]+)['"]/);
        if (match) sitekey = match[1];
      }
      
      // Get all iframes
      const iframeSrcs = Array.from(iframes).map(f => f.src);
      
      return {
        hasWidget: !!widget,
        sitekey,
        iframeSrcs,
        bodyText: document.body.innerText.substring(0, 300)
      };
    });
    
    console.log('  Turnstile widget:', turnstileInfo.hasWidget ? '✅ Found' : '❌ Not found');
    console.log('  Sitekey:', turnstileInfo.sitekey || 'not found');
    console.log('  Iframes:', turnstileInfo.iframeSrcs.length);
    turnstileInfo.iframeSrcs.forEach(s => console.log('    →', s.substring(0, 100)));
    console.log('  Body:', turnstileInfo.bodyText.substring(0, 200).replace(/\n/g, ' | '));

    // If Turnstile found, solve it
    if (turnstileInfo.sitekey || turnstileInfo.hasWidget) {
      const sitekey = turnstileInfo.sitekey || '0x4AAAAAAABnp1QeF6Mg'; // fallback
      console.log('\n[3] Solving Turnstile captcha...');
      console.log('  Sitekey:', sitekey);
      console.log('  URL: https://adal.ai');
      
      const result = await solveCaptcha('turnstile', {
        sitekey: sitekey,
        url: 'https://adal.ai',
        timeout_s: 60
      });
      
      console.log('  Result:', JSON.stringify(result).substring(0, 300));
      
      if (result.token) {
        console.log('\n[4] Injecting Turnstile token...');
        // Inject token into the form
        await page.evaluate((token) => {
          // Try various injection methods
          const inputs = document.querySelectorAll('input[name*="turnstile"], input[name*="cf-turnstile"], input[name*="token"]');
          for (const inp of inputs) {
            inp.value = token;
          }
          
          // Also try hidden input
          let hidden = document.querySelector('input[name="cf-turnstile-response"]');
          if (!hidden) {
            hidden = document.createElement('input');
            hidden.type = 'hidden';
            hidden.name = 'cf-turnstile-response';
            document.body.appendChild(hidden);
          }
          hidden.value = token;
          
          // Try to submit the form
          const forms = document.querySelectorAll('form');
          for (const form of forms) {
            const action = form.action || '';
            if (action.includes('challenge') || action.includes('verify') || action.includes('turnstile')) {
              form.submit();
              return;
            }
          }
          
          // Try clicking verify button
          const btns = document.querySelectorAll('button, input[type="submit"]');
          for (const b of btns) {
            const text = (b.textContent || b.value || '').toLowerCase();
            if (text.includes('verify') || text.includes('submit') || text.includes('continue')) {
              b.click();
              return;
            }
          }
        }, result.token);
        
        await sleep(5000);
        console.log('  URL after injection:', page.url());
      }
    }

    // Check if we passed the challenge
    console.log('\n[5] Checking page after challenge...');
    await sleep(3000);
    const afterBody = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
    console.log('  Body:', afterBody.substring(0, 200).replace(/\n/g, ' | '));
    await page.screenshot({ path: 'adal-after-turnstile.png' });

    // Look for login/signup links now
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.textContent.trim().substring(0, 50),
        href: a.href
      })).filter(l => l.text.length > 0);
    });
    console.log('\n[6] Links on page:');
    links.slice(0, 20).forEach(l => console.log(`  "${l.text}" → ${l.href}`));

    // Try clicking "Get Started Free"
    const cta = await page.evaluate(() => {
      const els = document.querySelectorAll('a, button');
      for (const el of els) {
        const text = (el.textContent || '').trim().toLowerCase();
        if (text.includes('get started') || text.includes('start building') || text.includes('sign up') || text.includes('login')) {
          el.click();
          return text;
        }
      }
      return null;
    });
    console.log('\n[7] Clicked CTA:', cta);
    await sleep(5000);
    console.log('  URL:', page.url());

    // Check for Clerk auth
    if (page.url().includes('clerk') || page.url().includes('accounts') || page.url().includes('sign')) {
      console.log('[8] Auth page detected!');
      await page.screenshot({ path: 'adal-auth.png' });
      
      // Look for Google login
      const googleClicked = await page.evaluate(() => {
        const btns = document.querySelectorAll('button, a');
        for (const b of btns) {
          if ((b.textContent || '').toLowerCase().includes('google')) {
            b.click();
            return b.textContent.trim();
          }
        }
        return null;
      });
      console.log('  Google:', googleClicked);
      
      if (googleClicked) {
        await sleep(5000);
        // Google OAuth
        if (page.url().includes('google') || page.url().includes('accounts')) {
          console.log('[9] Google OAuth...');
          let emailInput;
          try { emailInput = await page.waitForSelector('input[type="email"]', { timeout: 5000 }); }
          catch { emailInput = await page.$('input[type="text"]'); }
          if (emailInput) {
            await emailInput.click({ clickCount: 3 });
            await emailInput.type(email, { delay: 80 });
            await sleep(1000);
            await page.keyboard.press('Enter');
            await sleep(5000);
          }
          try {
            const pwd = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
            await pwd.click({ clickCount: 3 });
            await pwd.type(password, { delay: 80 });
            await sleep(1000);
            await page.keyboard.press('Enter');
            await sleep(8000);
          } catch (e) { console.log('  Pwd error:', e.message.substring(0, 80)); }
        }
      }
    }

    await page.screenshot({ path: 'adal-final.png' });
    console.log('\n[Final URL]:', page.url());
    
    const cookies = await page.cookies();
    const adalCookies = cookies.filter(c => c.domain.includes('adal') || c.domain.includes('clerk') || c.domain.includes('google'));
    console.log('[Cookies]:', adalCookies.length);
    adalCookies.forEach(c => console.log(`  ${c.name} = ${c.value.substring(0, 50)}`));
    fs.writeFileSync('adal-cookies-new.json', JSON.stringify(cookies, null, 2));

  } catch (e) {
    console.error('[Error]:', e.message);
    await page.screenshot({ path: 'adal-error.png' }).catch(() => {});
  }

  await browser.close();
  console.log('[DONE]');
})();
