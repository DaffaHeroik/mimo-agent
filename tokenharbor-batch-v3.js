const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const CHROME_PATH = '/home/work/.openclaw/workspace/.openclaw/tmp/chrome-dir/chrome';
const PASSWORD = 'Daffa112233!';
const GOOGLE_PW = 'Daffa112233';
const INVITE = 'TH-653T-4B6A';

const accounts = [
  'muni2@bekri.site', 'muni3@bekri.site', 'muni4@bekri.site', 'muni5@bekri.site',
  'muni6@bekri.site', 'muni7@bekri.site', 'muni8@bekri.site', 'muni9@bekri.site', 'muni10@bekri.site'
];

const results = [{ email: 'muni1@bekri.site', key: 'thk_live_XXf1Dss3VEj3QjuB-9SSZ_Bc-waBhvSsKxbhdRPfVzXjvfVZPMlbEiaEsSTxWHxV' }];

async function processAccount(email) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${email}`);
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1920,1080']
  });

  // Use a SINGLE page for the entire flow
  const page = await browser.newPage();

  try {
    // === STEP 1: Register on TokenHarbor ===
    console.log('[1/6] Registering on TokenHarbor...');
    await page.goto(`https://tokenharbor.ai/login?invite=${INVITE}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(2000);

    // Accept cookies
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Essential only'));
      if (btn) btn.click();
    });
    await sleep(500);

    // Click Sign up tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => (b.textContent || '').trim() === 'Sign up');
      if (btn) btn.click();
    });
    await sleep(1000);

    // Fill form
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) { await emailInput.click(); await emailInput.type(email, { delay: 30 }); }
    await sleep(300);
    const pwdInput = await page.$('input[type="password"]');
    if (pwdInput) { await pwdInput.click(); await pwdInput.type(PASSWORD, { delay: 30 }); }
    await sleep(300);

    // Submit
    await page.keyboard.press('Enter');
    await sleep(8000);

    const afterRegText = await page.evaluate(() => document.body.innerText.substring(0, 300));
    if (afterRegText.includes('free tier limit') || afterRegText.includes('rate limit')) {
      console.log('❌ RATE LIMITED');
      await browser.close();
      return { email, status: 'rate_limited', key: null };
    }
    if (afterRegText.includes("couldn't create")) {
      console.log('❌ Registration error');
      await browser.close();
      return { email, status: 'reg_error', key: null };
    }
    console.log('  ✅ Registered');

    // === STEP 2: Go to Google login for Gmail ===
    console.log('[2/6] Checking Gmail for verification email...');
    await page.goto('https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin&continue=https://mail.google.com/mail/', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    const gEmail = await page.waitForSelector('input[type="email"], #identifierId', { timeout: 10000 });
    await gEmail.click({ clickCount: 3 });
    await gEmail.type(email, { delay: 50 });
    await sleep(1000);
    await page.evaluate(() => {
      const btn = document.querySelector('#identifierNext button') || document.querySelector('button[jsname="LgbsSe"]');
      if (btn) btn.click();
    });
    await sleep(5000);

    const gPwd = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await gPwd.click({ clickCount: 3 });
    await gPwd.type(GOOGLE_PW, { delay: 50 });
    await sleep(1000);
    await page.evaluate(() => {
      const btn = document.querySelector('#passwordNext button') || document.querySelector('button[jsname="LgbsSe"]');
      if (btn) btn.click();
    });
    await sleep(8000);

    // Handle consent
    for (let i = 0; i < 3; i++) {
      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => { const t = (b.textContent || '').toLowerCase(); return t.includes('continue') || t.includes('allow') || t.includes('accept') || t.includes('lanjutkan'); });
        if (btn) { btn.click(); return true; }
        return false;
      });
      if (clicked) await sleep(2000);
      else break;
    }

    // Open Gmail
    await page.goto('https://mail.google.com/mail/u/0/', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(5000);

    // Click TokenHarbor email
    const emailClicked = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr');
      for (const row of rows) {
        if (row.textContent.includes('Token Harbor') && row.textContent.includes('Verify')) { row.click(); return true; }
      }
      for (const row of rows) {
        if (row.textContent.includes('Token Harbor')) { row.click(); return true; }
      }
      return false;
    });

    if (!emailClicked) {
      await sleep(8000);
      await page.goto('https://mail.google.com/mail/u/0/', { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(5000);
      const retry = await page.evaluate(() => {
        const rows = document.querySelectorAll('tr');
        for (const row of rows) { if (row.textContent.includes('Token Harbor')) { row.click(); return true; } }
        return false;
      });
      if (!retry) {
        console.log('  ❌ Verification email not found');
        await browser.close();
        return { email, status: 'email_not_found', key: null };
      }
    }
    await sleep(3000);

    // Extract verification link
    const verifyLink = await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const link of links) { if ((link.href || '').includes('verify-email')) return link.href; }
      const text = document.body.innerText;
      const match = text.match(/https:\/\/tokenharbor\.ai\/verify-email\?token=[^\s]+/);
      if (match) return match[0];
      return '';
    });

    if (!verifyLink) {
      console.log('  ❌ Verification link not found');
      await browser.close();
      return { email, status: 'verify_link_not_found', key: null };
    }
    console.log('  ✅ Got verification link');

    // === STEP 3: Verify email ===
    console.log('[3/6] Verifying email...');
    await page.goto(verifyLink, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(5000);
    console.log('  ✅ Email verified');

    // === STEP 4: Login to TokenHarbor ===
    console.log('[4/6] Logging into TokenHarbor...');
    await page.goto('https://tokenharbor.ai/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => (b.textContent || '').trim() === 'Sign in');
      if (btn) btn.click();
    });
    await sleep(1000);

    const loginEmail = await page.$('input[type="email"]');
    if (loginEmail) { await loginEmail.click(); await loginEmail.type(email, { delay: 30 }); }
    await sleep(300);
    const loginPwd = await page.$('input[type="password"]');
    if (loginPwd) { await loginPwd.click(); await loginPwd.type(PASSWORD, { delay: 30 }); }
    await sleep(300);

    await page.keyboard.press('Enter');
    await sleep(8000);

    const loginUrl = page.url();
    if (loginUrl.includes('dashboard')) {
      console.log('  ✅ Logged in');
    } else {
      console.log('  ❌ Login failed, URL:', loginUrl.substring(0, 80));
      await browser.close();
      return { email, status: 'login_failed', key: null };
    }

    // === STEP 5: Enable free models ===
    console.log('[5/6] Enabling free models...');
    await page.goto('https://tokenharbor.ai/dashboard', { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(3000);
    await page.evaluate(() => {
      const all = document.querySelectorAll('[role="switch"], input[type="checkbox"]');
      for (const el of all) {
        const parent = el.closest('div') || el.parentElement;
        const text = (parent ? parent.textContent : '').toLowerCase();
        if (text.includes('free model') && !el.checked) el.click();
      }
    });
    await sleep(2000);

    // === STEP 6: Create API key ===
    console.log('[6/6] Creating API key...');
    await page.goto('https://tokenharbor.ai/dashboard/api-keys', { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => (b.textContent || '').toLowerCase().includes('new key'));
      if (btn) btn.click();
    });
    await sleep(2000);

    const labelInput = await page.$('input[type="text"]');
    if (labelInput) { await labelInput.click({ clickCount: 3 }); await labelInput.type(email.split('@')[0] + '-key', { delay: 20 }); await sleep(500); }

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => (b.textContent || '').toLowerCase().includes('create key'));
      if (btn) btn.click();
    });
    await sleep(3000);

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => (b.textContent || '').toLowerCase().includes('show'));
      if (btn) btn.click();
    });
    await sleep(2000);

    const apiKey = await page.evaluate(() => {
      const allText = document.body.innerText;
      const thMatches = allText.match(/thk_live_[a-zA-Z0-9_\-]{20,}/g);
      if (thMatches && thMatches.length > 0) return thMatches[0];
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) { const val = (inp.value || '').trim(); if (val.length > 20 && val.includes('_')) return val; }
      return '';
    });

    if (apiKey) {
      console.log(`\n✅ API KEY: ${apiKey}`);
      await browser.close();
      return { email, status: 'success', key: apiKey };
    }

    console.log('  ⚠️ Could not extract API key');
    await browser.close();
    return { email, status: 'key_failed', key: null };

  } catch (err) {
    console.log(`❌ ERROR: ${err.message}`);
    try { await browser.close(); } catch {}
    return { email, status: 'error', key: null, error: err.message };
  }
}

(async () => {
  console.log('TokenHarbor Batch v3 (single page per account)');
  console.log(`Accounts to process: ${accounts.length}\n`);

  for (const account of accounts) {
    const result = await processAccount(account);
    results.push(result);
    fs.writeFileSync('tokenharbor-bekri-results.txt', results.map(r => `${r.email}|${r.key || r.status}`).join('\n'));
    if (result.status === 'rate_limited') { console.log('\n⚠️ Rate limited — stopping.'); break; }
    await sleep(3000);
  }

  console.log('\n' + '='.repeat(60));
  console.log('FINAL RESULTS');
  console.log('='.repeat(60));
  for (const r of results) {
    const status = r.key ? `✅ ${r.key}` : `❌ ${r.status}`;
    console.log(`${r.email}: ${status}`);
  }
  fs.writeFileSync('tokenharbor-bekri-results.txt', results.map(r => `${r.email}|${r.key || r.status}`).join('\n'));
})();
