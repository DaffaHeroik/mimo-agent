const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const CHROME_PATH = '/tmp/chrome-dir/chrome';
const INVITE = 'TH-653T-4B6A';

// ========== ACCOUNTS ==========
const ACCOUNTS = [
  { email: 'josef1@bekri.site', password: 'Daffa112233' },
  // { email: 'josef2@bekri.site', password: 'Daffa112233' },
  // { email: 'josef3@bekri.site', password: 'Daffa112233' },
  // { email: 'josef4@bekri.site', password: 'Daffa112233' },
  // { email: 'josef5@bekri.site', password: 'Daffa112233' },
  // { email: 'josef6@bekri.site', password: 'Daffa112233' },
  // { email: 'josef7@bekri.site', password: 'Daffa112233' },
  // { email: 'josef8@bekri.site', password: 'Daffa112233' },
  // { email: 'josef9@bekri.site', password: 'Daffa112233' },
  // { email: 'josef10@bekri.site', password: 'Daffa112233' },
];
// ===============================

const delay = ms => new Promise(r => setTimeout(r, ms));

async function clickByText(page, text, tag = '*') {
  return page.evaluate((text, tag) => {
    const els = Array.from(document.querySelectorAll(tag));
    const el = els.find(e => e.textContent.trim().toLowerCase().includes(text.toLowerCase()));
    if (el) { el.click(); return true; }
    return false;
  }, text, tag);
}

async function googleOAuth(page, email, password) {
  console.log(`  [GOOGLE] Starting OAuth flow...`);
  
  // Wait for Google login page
  await delay(3000);
  const url = page.url();
  
  if (!url.includes('accounts.google.com')) {
    console.log(`  [GOOGLE] Not on Google page: ${url.substring(0, 60)}`);
    return false;
  }

  // Enter email
  console.log(`  [GOOGLE] Entering email...`);
  await page.waitForSelector('#identifierId', { timeout: 10000 });
  await page.type('#identifierId', email, { delay: 30 });
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
    if (btn) btn.click();
  });
  await delay(5000);

  // Check for error
  const errText = await page.evaluate(() => document.body.innerText);
  if (errText.includes("Couldn't sign you in") || errText.includes("update to the latest")) {
    console.log(`  [GOOGLE] ❌ Blocked by Google`);
    return false;
  }

  // Enter password
  console.log(`  [GOOGLE] Entering password...`);
  const passField = await page.$('input[type="password"]');
  if (!passField) {
    console.log(`  [GOOGLE] ❌ No password field found`);
    return false;
  }
  await passField.click();
  await passField.type(password, { delay: 30 });
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
    if (btn) btn.click();
  });
  await delay(5000);

  // Handle consent/continue
  console.log(`  [GOOGLE] Handling consent...`);
  for (let i = 0; i < 5; i++) {
    const currentUrl = page.url();
    if (currentUrl.includes('manus.im') || currentUrl.includes('tokenharbor')) {
      console.log(`  [GOOGLE] ✅ Redirected back!`);
      return true;
    }

    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => {
        const t = b.textContent.trim();
        return t === 'Lanjutkan' || t === 'Continue' || t === 'Allow' || t === 'Confirm';
      });
      if (btn) { btn.click(); return btn.textContent.trim(); }
      return null;
    });

    if (clicked) {
      console.log(`  [GOOGLE] Clicked: ${clicked}`);
      await delay(3000);
    } else {
      await delay(2000);
    }
  }

  return page.url().includes('tokenharbor');
}

async function processAccount(account) {
  const { email, password } = account;
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Processing: ${email}`);
  console.log(`${'='.repeat(50)}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    // Step 1: Go to TokenHarbor with invite
    console.log(`  [1] Opening TokenHarbor...`);
    await page.goto(`https://tokenharbor.ai/login?invite=${INVITE}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);

    // Step 2: Click "Continue with Google"
    console.log(`  [2] Clicking Continue with Google...`);
    const googleClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Google'));
      if (btn) { btn.click(); return true; }
      return false;
    });

    if (!googleClicked) {
      console.log(`  [2] ❌ No Google button found`);
      await browser.close();
      return { email, success: false, error: 'NO_GOOGLE_BUTTON' };
    }

    // Step 3: Google OAuth
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    const oauthResult = await googleOAuth(page, email, password);
    
    if (!oauthResult) {
      console.log(`  [3] ❌ Google OAuth failed`);
      await page.screenshot({ path: `th-oauth-fail-${email.split('@')[0]}.png` });
      await browser.close();
      return { email, success: false, error: 'OAUTH_FAILED' };
    }

    // Step 4: Wait for redirect back to TokenHarbor
    console.log(`  [4] Waiting for TokenHarbor redirect...`);
    await delay(5000);
    let url = page.url();
    console.log(`  [4] URL: ${url.substring(0, 80)}`);

    // If still on Google, wait more
    if (url.includes('accounts.google.com')) {
      await delay(10000);
      url = page.url();
      console.log(`  [4] After wait URL: ${url.substring(0, 80)}`);
    }

    // Step 5: Check if on TokenHarbor dashboard
    if (!url.includes('tokenharbor')) {
      console.log(`  [5] ❌ Not on TokenHarbor`);
      await browser.close();
      return { email, success: false, error: 'NO_REDIRECT' };
    }

    const pageText = await page.evaluate(() => document.body.innerText);
    
    if (pageText.includes('suspended') || pageText.includes('Suspended')) {
      console.log(`  [5] ❌ Account suspended`);
      await browser.close();
      return { email, success: false, error: 'SUSPENDED' };
    }

    console.log(`  [5] ✅ On TokenHarbor!`);

    // Step 6: Claim gift if available
    if (pageText.includes('gift') || pageText.includes('claim') || pageText.includes('Claim')) {
      console.log(`  [6] Claiming gift...`);
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const claim = btns.find(b => b.textContent.toLowerCase().includes('claim'));
        if (claim) claim.click();
      });
      await delay(3000);
    }

    // Step 7: Create API key
    console.log(`  [7] Creating API key...`);
    await page.goto('https://tokenharbor.ai/dashboard/api-keys', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await delay(3000);
    url = page.url();
    
    if (url.includes('login')) {
      console.log(`  [7] ❌ Redirected to login, need to login again`);
      await browser.close();
      return { email, success: false, error: 'NOT_LOGGED_IN' };
    }

    // Click "New key" or "Create"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const btn = btns.find(b => 
        b.textContent.includes('New key') || b.textContent.includes('Create') || b.textContent.includes('Generate') || b.textContent.includes('+')
      );
      if (btn) btn.click();
    });
    await delay(2000);

    // Fill label
    const labelInput = await page.$('input[name="name"], input[placeholder*="label"], input[placeholder*="name"], input[type="text"]');
    if (labelInput) {
      await labelInput.click();
      await labelInput.type(`key-${Date.now()}`, { delay: 30 });
    }
    await delay(500);

    // Submit
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button[type="submit"], button'));
      const submit = btns.find(b => b.textContent.trim().toLowerCase().includes('create'));
      if (submit) submit.click();
    });
    await delay(3000);

    // Extract API key
    let apiKey = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const match = bodyText.match(/thk_live_[\w-]+/);
      return match ? match[0] : null;
    });

    if (!apiKey) {
      // Try clicking "Show" button
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const show = btns.find(b => b.textContent.toLowerCase().includes('show') || b.textContent.toLowerCase().includes('reveal'));
        if (show) show.click();
      });
      await delay(2000);
      apiKey = await page.evaluate(() => {
        const match = document.body.innerText.match(/thk_live_[\w-]+/);
        return match ? match[0] : null;
      });
    }

    if (apiKey) {
      console.log(`  [8] ✅ API Key created!`);
      await browser.close();
      return { email, success: true, key: apiKey };
    }

    console.log(`  [8] ❌ Could not extract API key`);
    await page.screenshot({ path: `th-nokey-${email.split('@')[0]}.png` });
    await browser.close();
    return { email, success: false, error: 'KEY_NOT_FOUND' };

  } catch (err) {
    console.error(`  [ERROR] ${err.message}`);
    await browser.close();
    return { email, success: false, error: err.message };
  }
}

// Main
(async () => {
  console.log(`TokenHarbor Multi-Account Registration (Google OAuth)`);
  console.log(`Accounts: ${ACCOUNTS.length}\n`);

  const results = [];

  for (const account of ACCOUNTS) {
    const result = await processAccount(account);
    results.push(result);

    if (result.success) {
      console.log(`\n✅ ${result.email}|${result.key}`);
    } else {
      console.log(`\n❌ ${result.email}|${result.error}`);
    }

    // Delay between accounts
    if (ACCOUNTS.indexOf(account) < ACCOUNTS.length - 1) {
      console.log(`\nWaiting 5s before next account...`);
      await delay(5000);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(50)}`);
  const success = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  console.log(`✅ Success: ${success.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log('\nResults:');
  for (const r of results) {
    console.log(`${r.success ? '✅' : '❌'} ${r.email}|${r.key || r.error}`);
  }
})();
