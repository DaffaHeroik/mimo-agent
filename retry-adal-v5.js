const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOME = process.env.HOME;

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
    // Go directly to Clerk sign-in
    console.log('[1] Opening Clerk sign-in...');
    await page.goto('https://adal.sylph.ai/sign-in', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    console.log('  URL:', page.url());

    // Enter email
    console.log('[2] Entering email...');
    const emailInput = await page.waitForSelector('#identifier-field', { timeout: 5000 }) || 
                       await page.$('input[name="identifier"]') || 
                       await page.$('input[type="text"]');
    if (emailInput) {
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(email, { delay: 80 });
      await sleep(1000);
      console.log('  ✅ Email entered');
    } else {
      console.log('  ❌ No email input found');
    }

    // Click Continue (not Google)
    console.log('[3] Clicking Continue...');
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        const text = b.textContent.trim().toLowerCase();
        if (text === 'continue') { b.click(); return; }
      }
    });
    await sleep(5000);
    console.log('  URL:', page.url());

    // Check what happened
    const bodyText = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
    console.log('  Body:', bodyText.substring(0, 300).replace(/\n/g, ' | '));
    await page.screenshot({ path: 'adal-after-email.png' });

    // Check for password field
    const hasPassword = await page.$('input[type="password"]');
    if (hasPassword) {
      console.log('[4] Password field found! Entering password...');
      await hasPassword.click({ clickCount: 3 });
      await hasPassword.type(password, { delay: 80 });
      await sleep(1000);
      
      // Click sign in / continue
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const b of btns) {
          const text = b.textContent.trim().toLowerCase();
          if (text.includes('continue') || text.includes('sign in') || text.includes('log in')) {
            b.click(); return;
          }
        }
      });
      await sleep(8000);
      console.log('  URL:', page.url());
    } else {
      console.log('[4] No password field — checking for other options...');
      
      // Check if it's asking for verification code
      const hasCodeInput = await page.$('input[type="tel"]') || await page.$('input[inputmode="numeric"]') || await page.$('input[autocomplete="one-time-code"]');
      if (hasCodeInput) {
        console.log('  ⚠️ Verification code required (email OTP)');
      }

      // Check for "Use password instead" link
      const usePassword = await page.evaluate(() => {
        const links = document.querySelectorAll('a, button');
        for (const el of links) {
          const text = (el.textContent || '').toLowerCase();
          if (text.includes('password') || text.includes('use a')) {
            el.click();
            return text;
          }
        }
        return null;
      });
      if (usePassword) {
        console.log(`  Clicked: "${usePassword}"`);
        await sleep(3000);
        
        const pwd = await page.$('input[type="password"]');
        if (pwd) {
          console.log('  Password field appeared!');
          await pwd.click({ clickCount: 3 });
          await pwd.type(password, { delay: 80 });
          await sleep(1000);
          await page.evaluate(() => {
            const btns = document.querySelectorAll('button');
            for (const b of btns) {
              const t = b.textContent.trim().toLowerCase();
              if (t.includes('continue') || t.includes('sign in')) { b.click(); break; }
            }
          });
          await sleep(8000);
        }
      }
    }

    // Post-login check
    console.log('\n[5] Post-login...');
    for (let i = 0; i < 8; i++) {
      await sleep(2000);
      const url = page.url();
      const text = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
      console.log(`  [${i}] ${url.substring(0, 80)}`);

      if (url.includes('adalagent') || (url.includes('adal') && !url.includes('sign-in') && !url.includes('clerk'))) {
        console.log('\n✅ LOGGED IN!');
        break;
      }

      if (text.includes('restricted') || text.includes('blocked') || text.includes('unavailable')) {
        console.log('  ⚠️ BLOCKED');
        break;
      }

      // __client_uat check
      const uat = await page.evaluate(() => {
        const m = document.cookie.match(/__client_uat=(\d+)/);
        return m ? m[1] : null;
      });
      if (uat === '0') {
        console.log('  ⚠️ __client_uat=0 (Clerk bot detection)');
        break;
      }
      if (uat && uat !== '0') {
        console.log(`  ✅ __client_uat=${uat} (authenticated!)`);
      }

      // Consent/speedbump
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
    console.log('\n[6] Testing AdaL CLI...');
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
