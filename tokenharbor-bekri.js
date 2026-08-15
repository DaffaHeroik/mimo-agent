const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const HARBOR_BASE = 'https://tokenharbor.ai';
const HARBOR_INVITE = 'TH-653T-4B6A';
const CHROME_PATH = '/opt/ms-playwright/chromium-1228/chrome-linux64/chrome';

const accounts = [
  'muni1@bekri.site', 'muni2@bekri.site', 'muni3@bekri.site', 'muni4@bekri.site', 'muni5@bekri.site',
  'muni6@bekri.site', 'muni7@bekri.site', 'muni8@bekri.site', 'muni9@bekri.site', 'muni10@bekri.site'
];
const PASSWORD = 'Daffa112233';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function googleOAuthLogin(page, email, password) {
  // Wait for Google login page
  await page.waitForSelector('input[type="email"], #identifierId', { timeout: 15000 });
  await sleep(1000);

  // Type email
  const emailInput = await page.$('input[type="email"], #identifierId');
  await emailInput.click({ clickCount: 3 });
  await emailInput.type(email, { delay: 30 });
  await sleep(500);

  // Click Next
  await page.evaluate(() => {
    const btn = document.querySelector('#identifierNext button, button[jsname="LgbsSe"]');
    if (btn) btn.click();
  });
  await sleep(3000);

  // Wait for password field
  try {
    await page.waitForSelector('input[type="password"], input[name="Passwd"]', { timeout: 10000 });
  } catch {
    // Check for error or other state
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText.includes('Couldn\'t find') || bodyText.includes('not found')) {
      throw new Error(`Google account not found: ${email}`);
    }
    throw new Error('Password field not found');
  }
  await sleep(1000);

  // Type password
  const pwdInput = await page.$('input[type="password"], input[name="Passwd"]');
  await pwdInput.click({ clickCount: 3 });
  await pwdInput.type(password, { delay: 30 });
  await sleep(500);

  // Click Next
  await page.evaluate(() => {
    const btn = document.querySelector('#passwordNext button, button[jsname="LgbsSe"]');
    if (btn) btn.click();
  });
  await sleep(5000);

  // Handle consent/speedbump pages
  for (let i = 0; i < 5; i++) {
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => {
        const t = (b.textContent || '').toLowerCase();
        return t.includes('continue') || t.includes('allow') || t.includes('accept') || t.includes('agree') || t.includes('lanjutkan');
      });
      if (btn) { btn.click(); return btn.textContent.trim(); }
      return null;
    });
    if (clicked) {
      console.log(`    Consent clicked: ${clicked}`);
      await sleep(2000);
    } else break;
  }
}

async function processAccount(browser, email) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${email}`);
  console.log('='.repeat(60));

  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  try {
    // Step 1: Navigate to TokenHarbor
    console.log('  [1/5] Navigating to TokenHarbor...');
    await page.goto(`${HARBOR_BASE}/login?invite=${HARBOR_INVITE}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(2000);

    // Check if we're rate-limited
    const pageText = await page.evaluate(() => document.body.innerText);
    if (pageText.includes('free tier limit') || pageText.includes('doing that a bit fast')) {
      console.log('  ❌ RATE LIMITED - IP blocked by TokenHarbor');
      return { email, status: 'rate_limited', key: null };
    }

    // Step 2: Find and click Google OAuth button
    console.log('  [2/5] Looking for Google OAuth button...');
    const googleBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      return btns.find(b => {
        const html = b.innerHTML || '';
        const text = (b.textContent || '').toLowerCase();
        return html.includes('EA4335') || text.includes('google') || text.includes('sign in with google') || text.includes('continue with google');
      }) || null;
    });

    if (googleBtn && googleBtn.asElement()) {
      console.log('  Found Google button, clicking...');
      await googleBtn.click();
      await sleep(3000);
    } else {
      // Try finding any OAuth button
      console.log('  Google button not found, checking page state...');
      const url = page.url();
      console.log(`  Current URL: ${url}`);

      // Maybe already on Google login
      if (!page.url().includes('accounts.google.com')) {
        // Try clicking any sign-in button
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button, a'));
          const btn = btns.find(b => {
            const t = (b.textContent || '').toLowerCase();
            return t.includes('sign in') || t.includes('log in') || t.includes('login');
          });
          if (btn) btn.click();
        });
        await sleep(3000);
      }
    }

    // Step 3: Google OAuth
    const currentUrl = page.url();
    if (currentUrl.includes('accounts.google.com')) {
      console.log('  [3/5] On Google OAuth page, logging in...');
      await googleOAuthLogin(page, email, PASSWORD);
    } else {
      console.log(`  [3/5] Not on Google OAuth. URL: ${currentUrl.substring(0, 80)}`);
    }

    await sleep(3000);
    const afterLoginUrl = page.url();
    console.log(`  After login URL: ${afterLoginUrl.substring(0, 80)}`);

    // Check for errors
    const errorText = await page.evaluate(() => document.body.innerText);
    if (errorText.includes('Access Restricted') || errorText.includes('security policy')) {
      console.log('  ❌ ACCESS RESTRICTED - IP blocked');
      return { email, status: 'ip_blocked', key: null };
    }
    if (errorText.includes('free tier limit')) {
      console.log('  ❌ RATE LIMITED');
      return { email, status: 'rate_limited', key: null };
    }

    // Step 4: Dashboard - Claim gift
    console.log('  [4/5] Navigating to dashboard...');
    await page.goto(`${HARBOR_BASE}/dashboard`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(3000);

    const dashText = await page.evaluate(() => document.body.innerText);
    if (!afterLoginUrl.includes('tokenharbor.ai') && !dashText.includes('Dashboard')) {
      console.log('  ❌ NOT LOGGED IN - OAuth may have failed');
      return { email, status: 'oauth_failed', key: null };
    }

    // Claim gift
    console.log('  Claiming $5 gift...');
    const giftClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => {
        const t = (b.textContent || '').toLowerCase();
        return t.includes('gift') || t.includes('claim');
      });
      if (btn) { btn.click(); return btn.textContent.trim(); }
      return null;
    });

    if (giftClicked) {
      console.log(`  Gift button: ${giftClicked}`);
      await sleep(2000);
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => (b.textContent || '').trim() === 'Claim');
        if (btn) btn.click();
      });
      await sleep(3000);
    }

    // Step 5: Create API key
    console.log('  [5/5] Creating API key...');
    await page.goto(`${HARBOR_BASE}/dashboard/api-keys`, { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);

    // Click "+ New key"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => (b.textContent || '').toLowerCase().includes('new key'));
      if (btn) btn.click();
    });
    await sleep(2000);

    // Fill label
    const labelInput = await page.$('input[placeholder*="Cursor"], input[placeholder*="Production"], input[placeholder*="project"], input[type="text"]');
    if (labelInput) {
      await labelInput.click({ clickCount: 3 });
      await labelInput.type(`muni-${Date.now()}`, { delay: 20 });
      await sleep(500);
    }

    // Click "Create key"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => (b.textContent || '').toLowerCase().includes('create key'));
      if (btn) btn.click();
    });
    await sleep(3000);

    // Extract API key
    const apiKey = await page.evaluate(() => {
      // Check for thk_live prefix
      const allText = document.body.innerText;
      const thMatches = allText.match(/thk_live_[a-zA-Z0-9_\-]{20,}/g);
      if (thMatches && thMatches.length > 0) return thMatches[0];

      // Check code/pre elements
      const els = document.querySelectorAll('code, pre, .key, input[readonly], [data-key], span[class*="key"]');
      for (const el of els) {
        const text = (el.textContent || el.value || '').trim();
        if (text.length > 20 && text.match(/^[a-zA-Z0-9_\-]{20,}$/)) return text;
      }

      // Check for any sk- or th- prefix
      const skMatches = allText.match(/sk-[a-zA-Z0-9]{20,}/g) || [];
      if (skMatches.length > 0) return skMatches[0];

      // Check inputs
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        const val = (inp.value || '').trim();
        if (val.length > 20 && val.includes('_')) return val;
      }

      return '';
    });

    if (apiKey) {
      console.log(`  ✅ API KEY: ${apiKey}`);
      return { email, status: 'success', key: apiKey };
    }

    // Try "Show plaintext key"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => (b.textContent || '').toLowerCase().includes('show'));
      if (btn) btn.click();
    });
    await sleep(2000);

    const apiKey2 = await page.evaluate(() => {
      const allText = document.body.innerText;
      const thMatches = allText.match(/thk_live_[a-zA-Z0-9_\-]{20,}/g);
      if (thMatches && thMatches.length > 0) return thMatches[0];
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        const val = (inp.value || '').trim();
        if (val.length > 20) return val;
      }
      return '';
    });

    if (apiKey2) {
      console.log(`  ✅ API KEY: ${apiKey2}`);
      return { email, status: 'success', key: apiKey2 };
    }

    console.log('  ⚠️ Could not extract API key');
    return { email, status: 'key_extraction_failed', key: null };

  } catch (err) {
    console.log(`  ❌ ERROR: ${err.message}`);
    return { email, status: 'error', key: null, error: err.message };
  } finally {
    await context.close();
  }
}

(async () => {
  console.log('TokenHarbor Auto-Registration (bekri.site accounts)');
  console.log(`Accounts: ${accounts.length}`);
  console.log(`Invite: ${HARBOR_INVITE}`);
  console.log('');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080'
    ]
  });

  const results = [];

  for (const account of accounts) {
    const result = await processAccount(browser, account);
    results.push(result);

    // If rate limited, stop
    if (result.status === 'rate_limited') {
      console.log('\n⚠️ Rate limited — stopping. Try again later or use proxy.');
      break;
    }

    // Brief pause between accounts
    await sleep(3000);
  }

  await browser.close();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(60));
  for (const r of results) {
    const status = r.status === 'success' ? `✅ ${r.key.substring(0, 20)}...` : `❌ ${r.status}`;
    console.log(`${r.email}: ${status}`);
  }

  // Save results
  const fs = require('fs');
  const output = results.map(r => `${r.email}|${r.key || r.status}`).join('\n');
  fs.writeFileSync('tokenharbor-bekri-results.txt', output);
  console.log('\nResults saved to tokenharbor-bekri-results.txt');
})();
