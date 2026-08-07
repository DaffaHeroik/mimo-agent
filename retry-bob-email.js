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
    // Go directly to IBM Bob trial page
    console.log('[1] Opening IBM Bob trial...');
    await page.goto('https://bob.ibm.com/trial', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(5000);
    console.log('  URL:', page.url());

    // Find email input on the trial form
    console.log('[2] Looking for registration form...');
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.type, name: i.name, id: i.id, placeholder: i.placeholder
      }));
    });
    console.log('  Inputs:', JSON.stringify(inputs));

    // Enter email in the registration form
    const emailInput = await page.$('input[type="email"]') || await page.$('input[name="email"]') || await page.$('#email');
    if (emailInput) {
      console.log('[3] Entering email...');
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(email, { delay: 80 });
      await sleep(1000);
      console.log('  ✅ Email entered');
    }

    // Check for password field
    const pwdInput = await page.$('input[type="password"]');
    if (pwdInput) {
      console.log('[4] Password field found...');
      await pwdInput.click({ clickCount: 3 });
      await pwdInput.type(password, { delay: 80 });
      await sleep(500);
    }

    // Look for "Log in" link (to switch to login mode)
    console.log('[5] Looking for Login link...');
    const loginLink = await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const a of links) {
        const text = (a.textContent || '').toLowerCase();
        if (text.includes('log in') && !text.includes('sign up')) {
          return { text: a.textContent.trim(), href: a.href };
        }
      }
      return null;
    });
    console.log('  Login link:', JSON.stringify(loginLink));

    // Click "Log in" to switch to login mode
    if (loginLink) {
      await page.goto(loginLink.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await sleep(5000);
      console.log('  URL:', page.url());
      
      const body = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
      console.log('  Body:', body.substring(0, 300).replace(/\n/g, ' | '));
      await page.screenshot({ path: 'bob-login.png' });

      // Check for IBM login form
      const ibmInputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input')).map(i => ({
          type: i.type, name: i.name, id: i.id, placeholder: i.placeholder
        }));
      });
      console.log('  Inputs:', JSON.stringify(ibmInputs));

      // Enter email
      const ibmEmail = await page.$('input[type="email"]') || await page.$('input[name="email"]') || await page.$('#email') || await page.$('input[type="text"]');
      if (ibmEmail) {
        console.log('[6] Entering IBM email...');
        await ibmEmail.click({ clickCount: 3 });
        await ibmEmail.type(email, { delay: 80 });
        await sleep(1000);

        // Click continue/next
        await page.evaluate(() => {
          const btns = document.querySelectorAll('button, input[type="submit"]');
          for (const b of btns) {
            const t = (b.textContent || b.value || '').toLowerCase();
            if (t.includes('continue') || t.includes('next') || t.includes('sign in') || t.includes('log in')) {
              b.click(); return;
            }
          }
        });
        await sleep(5000);
        console.log('  URL:', page.url());

        // Check for password
        const pwd = await page.$('input[type="password"]');
        if (pwd) {
          console.log('[7] Password field!');
          await pwd.click({ clickCount: 3 });
          await pwd.type(password, { delay: 80 });
          await sleep(1000);
          await page.keyboard.press('Enter');
          await sleep(8000);
          console.log('  URL:', page.url());
        }

        // Post-login
        for (let i = 0; i < 8; i++) {
          await sleep(2000);
          const url = page.url();
          const text = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
          console.log(`  [${i}] ${url.substring(0, 80)}`);

          if (url.includes('bob.ibm.com') && !url.includes('login') && !url.includes('sign') && !url.includes('trial')) {
            console.log('\n✅ LOGGED IN TO IBM BOB!');
            break;
          }

          if (text.includes('restricted') || text.includes('blocked')) {
            console.log('  ⚠️ BLOCKED');
            break;
          }

          // Consent/speedbump
          const consent = await page.evaluate(() => {
            const btns = document.querySelectorAll('button');
            for (const b of btns) {
              const t = b.textContent.trim().toLowerCase();
              if (t.includes('continue') || t.includes('allow') || t.includes('accept') || t.includes('submit') || t.includes('confirm')) { b.click(); return t; }
            }
            return null;
          });
          if (consent) { console.log(`  Consent: "${consent}"`); await sleep(3000); continue; }

          break;
        }
      }
    }

    await page.screenshot({ path: 'bob-final.png' });
    console.log('\n[Final URL]:', page.url());

    const cookies = await page.cookies();
    console.log('[Cookies]:', cookies.length);
    cookies.forEach(c => console.log(`  ${c.domain} | ${c.name} = ${c.value.substring(0, 50)}`));
    fs.writeFileSync('bob-cookies-new.json', JSON.stringify(cookies, null, 2));

  } catch (e) {
    console.error('[Error]:', e.message);
    await page.screenshot({ path: 'bob-error.png' }).catch(() => {});
  }

  await browser.close();
  console.log('[DONE]');
})();
