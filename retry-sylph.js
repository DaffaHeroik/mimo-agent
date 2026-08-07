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
    console.log('[1] Opening adalagent.ai/sign-in...');
    await page.goto('https://adalagent.ai/sign-in', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    console.log('  URL:', page.url());

    // Dump page structure
    const bodyText = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
    console.log('  Body:', bodyText.substring(0, 300).replace(/\n/g, ' | '));

    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.type, name: i.name, id: i.id, placeholder: i.placeholder
      }));
    });
    console.log('  Inputs:', JSON.stringify(inputs));

    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, a')).map(b => ({
        tag: b.tagName, text: b.textContent.trim().substring(0, 50), href: b.href || ''
      })).filter(b => b.text.length > 0);
    });
    console.log('  Buttons:', JSON.stringify(buttons.slice(0, 15)));

    await page.screenshot({ path: 'sylph-signin.png' });

    // Check for Turnstile
    const hasTurnstile = await page.evaluate(() => {
      return !!(document.querySelector('.cf-turnstile') || document.querySelector('[data-sitekey]') || document.querySelector('iframe[src*="turnstile"]'));
    });
    console.log('  Turnstile:', hasTurnstile ? '⚠️ Yes' : '❌ No');

    // Try Google login
    console.log('\n[2] Looking for Google login...');
    const googleClicked = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, a');
      for (const b of btns) {
        const text = (b.textContent || '').toLowerCase();
        const href = (b.href || '').toLowerCase();
        if (text.includes('google') || href.includes('google')) {
          b.click();
          return { text: b.textContent.trim(), href: b.href };
        }
      }
      return null;
    });
    console.log('  Google:', JSON.stringify(googleClicked));

    if (googleClicked) {
      await sleep(5000);
      console.log('  URL:', page.url());

      // Google OAuth
      if (page.url().includes('google') || page.url().includes('accounts')) {
        console.log('[3] Google OAuth...');
        
        // Email
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

        // Password
        console.log('[4] Password...');
        try {
          const pwd = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
          await pwd.click({ clickCount: 3 });
          await pwd.type(password, { delay: 80 });
          await sleep(1000);
          await page.keyboard.press('Enter');
          await sleep(8000);
        } catch (e) {
          console.log('  Error:', e.message.substring(0, 100));
        }

        // Handle BotGuard if present
        const hasBg = await page.evaluate(() => !!(window.__bgRequest || document.querySelector('[data-bgchallenge]')));
        if (hasBg) {
          console.log('[5] BotGuard detected! Solving...');
          try {
            const bgResult = await solveCaptcha('botguard', { url: page.url(), timeout_s: 30 });
            console.log('  Result:', JSON.stringify(bgResult).substring(0, 200));
          } catch (e) {
            console.log('  Error:', e.message);
          }
        }

        // Post-login loop
        console.log('[5] Post-login...');
        for (let i = 0; i < 10; i++) {
          await sleep(2000);
          const url = page.url();
          const text = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
          
          console.log(`  [${i}] ${url.substring(0, 80)}`);
          
          if (url.includes('adalagent.ai') && !url.includes('sign-in') && !url.includes('sign-up') && !url.includes('clerk') && !url.includes('accounts')) {
            console.log('\n✅ LOGGED IN TO SYLPH/ADAL!');
            break;
          }
          
          if (text.includes('restricted') || text.includes('blocked') || text.includes('unavailable')) {
            console.log('  ⚠️ BLOCKED');
            break;
          }

          if (text.includes('__client_uat=0') || (await page.evaluate(() => document.cookie.includes('__client_uat=0')))) {
            console.log('  ⚠️ Clerk bot detection: __client_uat=0');
            // Try to force through
            await page.evaluate(() => {
              document.cookie = '__client_uat=1; path=/; domain=.sylph.ai';
            });
            await page.reload({ waitUntil: 'networkidle2' });
            await sleep(3000);
            continue;
          }

          // Consent
          const consent = await page.evaluate(() => {
            const btns = document.querySelectorAll('button');
            for (const b of btns) {
              const t = b.textContent.trim().toLowerCase();
              if (t.includes('continue') || t.includes('allow') || t.includes('accept') || t.includes('lanjutkan')) {
                b.click(); return t;
              }
            }
            return null;
          });
          if (consent) { console.log(`  Consent: "${consent}"`); await sleep(3000); continue; }

          // Speedbump
          if (url.includes('speedbump') || url.includes('workspacetermsofservice')) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await sleep(1000);
            await page.evaluate(() => {
              const btns = document.querySelectorAll('button');
              for (const b of btns) {
                const t = b.textContent.trim().toLowerCase();
                if (t.includes('i understand') || t.includes('next') || t.includes('continue')) { b.click(); break; }
              }
            });
            await sleep(3000);
            continue;
          }

          break;
        }
      }
    } else {
      // No Google — try email/password directly
      console.log('[2b] Email/password login...');
      const emailInput = await page.$('input[name="identifier"]') || await page.$('input[type="email"]') || await page.$('input[type="text"]');
      if (emailInput) {
        await emailInput.click({ clickCount: 3 });
        await emailInput.type(email, { delay: 80 });
        await sleep(1000);
        await page.evaluate(() => {
          const btns = document.querySelectorAll('button');
          for (const b of btns) {
            if (b.textContent.trim().toLowerCase().includes('continue')) { b.click(); break; }
          }
        });
        await sleep(5000);
        try {
          const pwd = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
          await pwd.click({ clickCount: 3 });
          await pwd.type(password, { delay: 80 });
          await sleep(1000);
          await page.keyboard.press('Enter');
          await sleep(8000);
        } catch (e) { console.log('  Error:', e.message.substring(0, 80)); }
      }
    }

    await page.screenshot({ path: 'sylph-final.png' });
    console.log('\n[Final URL]:', page.url());

    const cookies = await page.cookies();
    const authCookies = cookies.filter(c => c.domain.includes('sylph') || c.domain.includes('clerk') || c.domain.includes('google'));
    console.log('[Cookies]:', authCookies.length);
    authCookies.forEach(c => console.log(`  ${c.name} = ${c.value.substring(0, 50)}`));
    fs.writeFileSync('sylph-cookies.json', JSON.stringify(cookies, null, 2));

  } catch (e) {
    console.error('[Error]:', e.message);
    await page.screenshot({ path: 'sylph-error.png' }).catch(() => {});
  }

  await browser.close();
  console.log('[DONE]');
})();
