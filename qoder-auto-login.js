const puppeteer = require('/home/work/.openclaw/tmp/node_modules/puppeteer-extra');
const StealthPlugin = require('/home/work/.openclaw/tmp/node_modules/puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const TMP = '/home/work/.openclaw/tmp';
const QODER_LOGIN_URL = 'https://qoder.com/users/sign-in';

function loadAccounts(file) {
  const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
  return lines.map(line => {
    const [email, password] = line.split('|').map(s => s.trim());
    return { email, password };
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(TMP, `${name}.png`), fullPage: true });
}

async function getPageText(page) {
  return page.$eval('body', el => el.innerText).catch(() => '');
}

async function dumpState(page) {
  const url = page.url();
  const text = (await getPageText(page)).substring(0, 300);
  const buttons = await page.$$eval('button', btns => btns.map(b => ({
    text: b.textContent.trim().substring(0, 60),
    disabled: b.disabled,
    visible: b.offsetParent !== null
  })));
  const inputs = await page.$$eval('input', inputs => inputs.map(i => ({
    type: i.type, name: i.name, visible: i.offsetParent !== null
  })));
  return { url, text, buttons, inputs };
}

async function clickVisibleButton(page, ...texts) {
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const btnText = (await page.evaluate(el => el.textContent, btn)).trim().toLowerCase();
    const disabled = await page.evaluate(el => el.disabled, btn);
    const visible = await page.evaluate(el => el.offsetParent !== null, btn);
    if (disabled || !visible) continue;
    for (const t of texts) {
      if (btnText.includes(t.toLowerCase())) {
        await btn.scrollIntoViewIfNeeded();
        await sleep(500);
        await btn.click();
        console.log(`    [✓] Clicked: "${btnText}"`);
        return true;
      }
    }
  }
  return false;
}

(async () => {
  const accountsFile = process.argv[2] || 'accounts.txt';
  if (!fs.existsSync(accountsFile)) {
    console.error(`[✗] File not found: ${accountsFile}`);
    process.exit(1);
  }

  const accounts = loadAccounts(accountsFile);
  console.log(`[INFO] Loaded ${accounts.length} account(s)\n`);

  const browser = await puppeteer.launch({
    executablePath: process.env.HOME + '/.local/chrome/chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  for (const { email, password } of accounts) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[▶] ${email}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    try {
      // ===== STEP 1: Qoder login page =====
      console.log('\n[Step 1] Opening Qoder sign-in...');
      await page.goto(QODER_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2000);
      await screenshot(page, 's1-qoder-login');
      
      // Click Google
      const googleLink = await page.$('a[href*="sso/login/google"]');
      if (googleLink) await googleLink.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await sleep(3000);
      console.log('[✓] Redirected to Google');

      // ===== STEP 2: Google email =====
      console.log('\n[Step 2] Entering email...');
      let emailInput;
      try { emailInput = await page.waitForSelector('input[type="email"]', { timeout: 5000 }); }
      catch { emailInput = await page.waitForSelector('input[type="text"]', { timeout: 10000 }); }
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(email, { delay: 60 });
      await sleep(1000);
      await page.keyboard.press('Enter');
      await sleep(5000);
      await screenshot(page, 's2-after-email');
      console.log('[✓] Email submitted');

      // ===== STEP 3: Handle all Google pages until we reach password or Qoder =====
      console.log('\n[Step 3] Navigating Google flow...');
      
      for (let step = 0; step < 20; step++) {
        await sleep(2000);
        const state = await dumpState(page);
        const hostname = new URL(state.url).hostname;
        
        console.log(`\n  [Loop ${step}] ${hostname}${state.url.substring(state.url.indexOf(hostname) + hostname.length, state.url.indexOf(hostname) + hostname.length + 60)}...`);
        console.log(`  Text preview: ${state.text.substring(0, 120).replace(/\n/g, ' ')}`);
        console.log(`  Buttons: ${state.buttons.filter(b => b.visible).map(b => b.text).join(', ')}`);
        console.log(`  Inputs: ${state.inputs.filter(i => i.visible).map(i => `${i.type}(${i.name})`).join(', ')}`);

        // --- Check if we're on Qoder ---
        if (hostname.includes('qoder.com') && !state.url.includes('sign-in')) {
          console.log('\n🎉 [✅] REDIRECTED TO QODER! Login SUCCESS!');
          await screenshot(page, 's-final-qoder');
          break;
        }

        // --- Check if we left Google ---
        if (!hostname.includes('google.com')) {
          console.log(`\n[?] On unknown domain: ${hostname}`);
          await screenshot(page, `s-unknown-${step}`);
          break;
        }

        // --- Detect what page we're on ---
        const hasPasswordField = state.inputs.some(i => i.type === 'password' && i.visible);
        const hasEmailField = state.inputs.some(i => (i.type === 'email' || i.type === 'text') && i.visible && i.name !== 'Passwd');
        const btnTexts = state.buttons.filter(b => b.visible).map(b => b.text.toLowerCase()).join(' ');
        const pageText = state.text.toLowerCase();

        // PAGE TYPE: Welcome page
        if (pageText.includes('welcome to your new') || pageText.includes('welcome to')) {
          console.log('  → Welcome page detected');
          await clickVisibleButton(page, 'i understand', 'understand', 'continue', 'next');
          await sleep(4000);
          continue;
        }

        // PAGE TYPE: Review Terms of Service (X/3)
        if (pageText.includes('review') && pageText.includes('terms of service') && btnTexts.includes('review')) {
          console.log('  → Review Terms page detected');
          // Click "Review Terms of Service (X/3)" button
          const reviewClicked = await clickVisibleButton(page, 'review terms of service', 'review terms', 'review');
          if (!reviewClicked) {
            // Try clicking any button with "review" or "terms"
            await clickVisibleButton(page, 'terms', 'review');
          }
          await sleep(5000);
          continue;
        }

        // PAGE TYPE: Terms of Service content page (with checkbox)
        if (pageText.includes('terms of service') && (pageText.includes('scroll') || pageText.includes('read') || pageText.includes('service terms'))) {
          console.log('  → Terms content page, scrolling & accepting...');
          // Scroll to bottom
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await sleep(2000);
          
          // Check any checkboxes
          const checkboxes = await page.$$('input[type="checkbox"]');
          for (const cb of checkboxes) {
            const checked = await page.evaluate(el => el.checked, cb);
            const visible = await page.evaluate(el => el.offsetParent !== null, cb);
            if (visible && !checked) {
              await cb.scrollIntoViewIfNeeded();
              await sleep(500);
              await cb.click();
              console.log('    [✓] Checked checkbox');
              await sleep(1000);
            }
          }
          
          // Click Next/Continue/Done/Accept
          await clickVisibleButton(page, 'next', 'continue', 'done', 'accept', 'i agree', 'agree');
          await sleep(4000);
          continue;
        }

        // PAGE TYPE: Workspace Terms speedbump (Review 0/3 style)
        if (pageText.includes('workspace') && pageText.includes('terms')) {
          console.log('  → Workspace Terms speedbump');
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await sleep(1000);
          
          // Check checkboxes
          const checkboxes = await page.$$('input[type="checkbox"]');
          for (const cb of checkboxes) {
            const checked = await page.evaluate(el => el.checked, cb);
            const visible = await page.evaluate(el => el.offsetParent !== null, cb);
            if (visible && !checked) {
              await cb.click();
              console.log('    [✓] Checked checkbox');
              await sleep(1000);
            }
          }
          
          await clickVisibleButton(page, 'review terms', 'review', 'i understand', 'understand', 'next', 'continue', 'accept');
          await sleep(4000);
          continue;
        }

        // PAGE TYPE: Consent page
        if (pageText.includes('allow') || pageText.includes('permission') || pageText.includes('consent') || pageText.includes('access') || pageText.includes('mengizinkan') || pageText.includes('lanjutkan') || pageText.includes('memuat')) {
          console.log('  → Consent page detected');
          await clickVisibleButton(page, 'allow', 'accept', 'continue', 'confirm', 'lanjutkan', 'izinkan', 'setuju');
          await sleep(4000);
          continue;
        }

        // PAGE TYPE: Email/identifier page (after reload/error)
        if (hasEmailField && !hasPasswordField && hostname.includes('google.com') && (pageText.includes('email or phone') || pageText.includes('identifier'))) {
          console.log('  → Email page detected (re-entering email)...');
          const emailInp = await page.$('input[type="email"]') || await page.$('input[type="text"]');
          if (emailInp) {
            await emailInp.click({ clickCount: 3 });
            await emailInp.type(email, { delay: 60 });
            await sleep(1000);
            await page.keyboard.press('Enter');
            await sleep(5000);
          }
          continue;
        }

        // PAGE TYPE: Password page
        if (hasPasswordField && !pageText.includes('review')) {
          console.log('  → Password page detected');
          const pwdInput = await page.$('input[type="password"]');
          if (pwdInput) {
            await pwdInput.click({ clickCount: 3 });
            await pwdInput.type(password, { delay: 60 });
            await sleep(1000);
            await page.keyboard.press('Enter');
            await sleep(5000);
          }
          continue;
        }

        // PAGE TYPE: 2FA challenge
        if (state.url.includes('challenge/') && !state.url.includes('challenge/pwd')) {
          console.log('  → 2FA detected! Waiting 60s...');
          for (let i = 0; i < 12; i++) {
            await sleep(5000);
            if (!page.url().includes('challenge/') || page.url().includes('qoder.com')) break;
            process.stdout.write('.');
          }
          console.log('');
          continue;
        }

        // PAGE TYPE: Error page
        if (pageText.includes('500') || pageText.includes('error') || pageText.includes('something went wrong')) {
          console.log('  → Error page, reloading...');
          await sleep(5000);
          await page.reload({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
          await sleep(3000);
          continue;
        }

        // PAGE TYPE: Generic - try clicking Next/Continue
        console.log('  → Unknown page, trying buttons...');
        const clicked = await clickVisibleButton(page, 'next', 'continue', 'i understand', 'accept', 'allow', 'confirm', 'done', 'lanjutkan', 'setuju', 'izinkan');
        if (!clicked) {
          console.log('  → No clickable buttons found, pressing Enter');
          await page.keyboard.press('Enter');
        }
        await sleep(4000);
      }

      await screenshot(page, 's-final-state');
      const finalUrl = page.url();
      console.log(`\n[INFO] Final URL: ${finalUrl.substring(0, 120)}`);
      
      if (new URL(finalUrl).hostname.includes('qoder.com') && !finalUrl.includes('sign-in')) {
        console.log(`\n✅ [SUCCESS] ${email} logged into Qoder!`);
      } else {
        console.log(`\n⚠️ [PARTIAL] ${email} — check screenshots in ${TMP}`);
      }

    } catch (err) {
      console.error(`\n✗ Error: ${err.message}`);
      await screenshot(page, `error-${email}`);
    }

    await page.close();
  }

  await browser.close();
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[DONE]');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
})();
