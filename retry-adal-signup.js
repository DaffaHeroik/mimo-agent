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
    // Go to sign-up page directly
    console.log('[1] Opening sign-up page...');
    await page.goto('https://adal.sylph.ai/sign-up', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    console.log('  URL:', page.url());

    const bodyText = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
    console.log('  Body:', bodyText.substring(0, 300).replace(/\n/g, ' | '));

    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.type, name: i.name, id: i.id, placeholder: i.placeholder
      }));
    });
    console.log('  Inputs:', JSON.stringify(inputs));

    await page.screenshot({ path: 'adal-signup.png' });

    // Enter email
    console.log('\n[2] Entering email...');
    const emailInput = await page.$('#identifier-field') || await page.$('input[name="identifier"]') || await page.$('input[type="text"]') || await page.$('input[type="email"]');
    if (emailInput) {
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(email, { delay: 80 });
      await sleep(1000);
      console.log('  ✅ Email entered');
    }

    // Click Continue
    console.log('[3] Clicking Continue...');
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        const t = b.textContent.trim().toLowerCase();
        if (t === 'continue') { b.click(); return; }
      }
    });
    await sleep(5000);
    console.log('  URL:', page.url());

    // Check what happened
    const afterText = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
    console.log('  Body:', afterText.substring(0, 300).replace(/\n/g, ' | '));
    await page.screenshot({ path: 'adal-signup-step2.png' });

    // Check for password field
    const pwd = await page.$('input[type="password"]');
    if (pwd) {
      console.log('[4] Password field found! Creating account...');
      await pwd.click({ clickCount: 3 });
      await pwd.type(password, { delay: 80 });
      await sleep(1000);

      // Check for confirm password
      const pwdFields = await page.$$('input[type="password"]');
      if (pwdFields.length > 1) {
        console.log('  Confirm password field found');
        await pwdFields[1].click({ clickCount: 3 });
        await pwdFields[1].type(password, { delay: 80 });
        await sleep(1000);
      }

      // Click continue/sign up
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const b of btns) {
          const t = b.textContent.trim().toLowerCase();
          if (t.includes('continue') || t.includes('sign up') || t.includes('create')) { b.click(); return; }
        }
      });
      await sleep(8000);
      console.log('  URL:', page.url());
    } else {
      // Check for verification code
      const codeInput = await page.$('input[type="tel"]') || await page.$('input[inputmode="numeric"]') || await page.$('input[autocomplete="one-time-code"]');
      if (codeInput) {
        console.log('[4] ⚠️ Email verification code required!');
        console.log('  Need to check email for verification code');
      }

      // Check for "Use password" link
      const usePwd = await page.evaluate(() => {
        const els = document.querySelectorAll('a, button');
        for (const el of els) {
          const t = (el.textContent || '').toLowerCase();
          if (t.includes('password') || t.includes('use a')) { el.click(); return t; }
        }
        return null;
      });
      if (usePwd) {
        console.log(`  Clicked: "${usePwd}"`);
        await sleep(3000);
        const newPwd = await page.$('input[type="password"]');
        if (newPwd) {
          console.log('  Password field appeared!');
          await newPwd.click({ clickCount: 3 });
          await newPwd.type(password, { delay: 80 });
          await sleep(1000);
          await page.evaluate(() => {
            const btns = document.querySelectorAll('button');
            for (const b of btns) {
              const t = b.textContent.trim().toLowerCase();
              if (t.includes('continue') || t.includes('sign up')) { b.click(); break; }
            }
          });
          await sleep(8000);
        }
      }
    }

    // Post-signup
    console.log('\n[5] Post-signup...');
    for (let i = 0; i < 10; i++) {
      await sleep(2000);
      const url = page.url();
      const text = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
      console.log(`  [${i}] ${url.substring(0, 80)}`);

      if (url.includes('adalagent') || (url.includes('adal') && !url.includes('sign-in') && !url.includes('sign-up') && !url.includes('clerk'))) {
        console.log('\n✅ SIGNED UP & LOGGED IN!');
        break;
      }

      if (text.includes('restricted') || text.includes('blocked')) {
        console.log('  ⚠️ BLOCKED');
        break;
      }

      const uat = await page.evaluate(() => {
        const m = document.cookie.match(/__client_uat=(\d+)/);
        return m ? m[1] : null;
      });
      if (uat === '0') {
        console.log('  ⚠️ __client_uat=0 (bot detection)');
        break;
      }
      if (uat && uat !== '0') {
        console.log(`  ✅ __client_uat=${uat}`);
      }

      // Handle verification
      const codeInput = await page.$('input[type="tel"]') || await page.$('input[inputmode="numeric"]');
      if (codeInput) {
        console.log('  ⚠️ Verification code required — checking email...');
        // We can't get the code automatically, but let's note it
        break;
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
