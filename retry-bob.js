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
    console.log('[1] Opening IBM Bob...');
    await page.goto('https://bob.ibm.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);
    console.log('  URL:', page.url());

    // Click "Get free to get started"
    console.log('[2] Clicking Get Started...');
    const clicked = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, a');
      for (const b of btns) {
        const text = (b.textContent || '').toLowerCase();
        if (text.includes('get free') || text.includes('get started') || text.includes('sign up') || text.includes('try')) {
          b.click();
          return text.trim();
        }
      }
      return null;
    });
    console.log('  Clicked:', clicked);
    await sleep(5000);
    console.log('  URL:', page.url());

    // Check for login page
    const bodyText = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
    console.log('  Body:', bodyText.substring(0, 300).replace(/\n/g, ' | '));
    await page.screenshot({ path: 'bob-step1.png' });

    // Look for Google login
    console.log('[3] Looking for login options...');
    const loginBtns = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, a');
      return Array.from(btns).map(b => ({
        text: b.textContent.trim().substring(0, 50),
        href: b.href || '',
        tag: b.tagName
      })).filter(b => b.text.length > 0);
    });
    console.log('  Buttons:', JSON.stringify(loginBtns.slice(0, 15)));

    // Try Google login
    const googleClicked = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, a');
      for (const b of btns) {
        const text = (b.textContent || '').toLowerCase();
        const href = (b.href || '').toLowerCase();
        if (text.includes('google') || href.includes('google')) {
          b.click();
          return text.trim();
        }
      }
      return null;
    });
    console.log('  Google:', googleClicked);

    if (googleClicked) {
      await sleep(5000);
      console.log('  URL:', page.url());

      if (page.url().includes('google') || page.url().includes('accounts')) {
        console.log('[4] Google OAuth...');
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

        console.log('[5] Password...');
        try {
          const pwd = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
          await pwd.click({ clickCount: 3 });
          await pwd.type(password, { delay: 80 });
          await sleep(1000);
          await page.keyboard.press('Enter');
          await sleep(8000);
        } catch (e) { console.log('  Error:', e.message.substring(0, 100)); }

        // Check for BotGuard
        const hasBg = await page.evaluate(() => !!(window.__bgRequest || document.querySelector('[data-bgchallenge]')));
        if (hasBg) {
          console.log('  ⚠️ BotGuard detected! Solving...');
          try {
            const r = await solveCaptcha('botguard', { url: page.url(), timeout_s: 30 });
            console.log('  Result:', JSON.stringify(r).substring(0, 200));
          } catch (e) { console.log('  Error:', e.message); }
        }

        // Post-login
        console.log('[6] Post-login...');
        for (let i = 0; i < 10; i++) {
          await sleep(2000);
          const url = page.url();
          const text = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
          console.log(`  [${i}] ${url.substring(0, 80)}`);

          if (url.includes('bob.ibm.com') && !url.includes('login') && !url.includes('sign')) {
            console.log('\n✅ LOGGED IN TO IBM BOB!');
            break;
          }

          if (text.includes('restricted') || text.includes('blocked') || text.includes('unavailable')) {
            console.log('  ⚠️ RESTRICTED');
            break;
          }

          if (text.includes('captcha') || text.includes('verify')) {
            console.log('  ⚠️ CAPTCHA detected');
            break;
          }

          // Consent
          const consent = await page.evaluate(() => {
            const btns = document.querySelectorAll('button');
            for (const b of btns) {
              const t = b.textContent.trim().toLowerCase();
              if (t.includes('continue') || t.includes('allow') || t.includes('accept') || t.includes('submit') || t.includes('link') || t.includes('confirm') || t.includes('register')) {
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
    }

    await page.screenshot({ path: 'bob-final.png' });
    console.log('\n[Final URL]:', page.url());

    const cookies = await page.cookies();
    const ibmCookies = cookies.filter(c => c.domain.includes('ibm') || c.domain.includes('bob'));
    console.log('[Cookies]:', ibmCookies.length);
    ibmCookies.forEach(c => console.log(`  ${c.domain} | ${c.name} = ${c.value.substring(0, 50)}`));
    fs.writeFileSync('bob-cookies-new.json', JSON.stringify(cookies, null, 2));

  } catch (e) {
    console.error('[Error]:', e.message);
    await page.screenshot({ path: 'bob-error.png' }).catch(() => {});
  }

  await browser.close();
  console.log('[DONE]');
})();
