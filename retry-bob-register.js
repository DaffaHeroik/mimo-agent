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
    // Go to IBM Bob trial page
    console.log('[1] Opening IBM Bob trial...');
    await page.goto('https://bob.ibm.com/trial', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(5000);
    console.log('  URL:', page.url());

    // Fill registration form directly
    console.log('[2] Filling registration form...');
    
    // Email
    const emailInput = await page.$('#email') || await page.$('input[name="email"]');
    if (emailInput) {
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(email, { delay: 80 });
      console.log('  ✅ Email');
    }

    // Password
    const pwdInput = await page.$('#password') || await page.$('input[name="password"]');
    if (pwdInput) {
      await pwdInput.click({ clickCount: 3 });
      await pwdInput.type(password, { delay: 80 });
      console.log('  ✅ Password');
    }

    // First Name
    const firstName = await page.$('#firstName') || await page.$('input[name="firstName"]');
    if (firstName) {
      await firstName.click({ clickCount: 3 });
      await firstName.type('Respati', { delay: 80 });
      console.log('  ✅ First Name');
    }

    // Last Name
    const lastName = await page.$('#lastName') || await page.$('input[name="lastName"]');
    if (lastName) {
      await lastName.click({ clickCount: 3 });
      await lastName.type('Iswahyudi', { delay: 80 });
      console.log('  ✅ Last Name');
    }

    await page.screenshot({ path: 'bob-reg-filled.png' });

    // Check for checkboxes (terms, etc.)
    const checkboxes = await page.evaluate(() => {
      const cbs = document.querySelectorAll('input[type="checkbox"]');
      return Array.from(cbs).map(cb => ({
        id: cb.id, name: cb.name, checked: cb.checked
      }));
    });
    console.log('  Checkboxes:', JSON.stringify(checkboxes));

    // Check all checkboxes
    for (const cb of checkboxes) {
      if (!cb.checked) {
        const selector = cb.id ? `#${cb.id}` : `input[name="${cb.name}"]`;
        await page.click(selector);
        console.log(`  ✅ Checked: ${cb.id || cb.name}`);
      }
    }

    // Submit
    console.log('\n[3] Submitting registration...');
    const submitBtn = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, input[type="submit"]');
      for (const b of btns) {
        const text = (b.textContent || b.value || '').toLowerCase();
        if (text.includes('register') || text.includes('create') || text.includes('sign up') || text.includes('start') || text.includes('submit') || text.includes('trial')) {
          b.click();
          return text.trim();
        }
      }
      return null;
    });
    console.log('  Clicked:', submitBtn);
    await sleep(8000);
    console.log('  URL:', page.url());

    // Check for errors
    const bodyText = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
    console.log('  Body:', bodyText.substring(0, 300).replace(/\n/g, ' | '));
    await page.screenshot({ path: 'bob-reg-result.png' });

    // Check for verification
    const codeInput = await page.$('input[type="tel"]') || await page.$('input[inputmode="numeric"]') || await page.$('input[autocomplete="one-time-code"]');
    if (codeInput) {
      console.log('  ⚠️ Verification code required!');
    }

    // Check for success
    if (page.url().includes('bob.ibm.com') && !page.url().includes('trial') && !page.url().includes('login')) {
      console.log('\n✅ REGISTERED & LOGGED IN!');
    }

    // Check for "already have account"
    if (bodyText.includes('already') || bodyText.includes('existing')) {
      console.log('  ⚠️ Account already exists — need to login instead');
    }

    console.log('\n[Final URL]:', page.url());
    const cookies = await page.cookies();
    console.log('[Cookies]:', cookies.length);
    fs.writeFileSync('bob-cookies-new.json', JSON.stringify(cookies, null, 2));

  } catch (e) {
    console.error('[Error]:', e.message);
    await page.screenshot({ path: 'bob-error.png' }).catch(() => {});
  }

  await browser.close();
  console.log('[DONE]');
})();
