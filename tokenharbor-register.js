const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const CHROME_PATH = '/tmp/chrome-dir/chrome';
const PASSWORD = 'Daffa112233!';
const INVITE = 'TH-653T-4B6A';

// ========== CONFIGURATION ==========
const ACCOUNTS = [
  'josef1@bekri.site',
  // 'josef2@bekri.site',
  // 'josef3@bekri.site',
  // 'josef4@bekri.site',
  // 'josef5@bekri.site',
  // 'josef6@bekri.site',
  // 'josef7@bekri.site',
  // 'josef8@bekri.site',
  // 'josef9@bekri.site',
  // 'josef10@bekri.site',
];
// ====================================

const delay = ms => new Promise(r => setTimeout(r, ms));

async function launchBrowser() {
  return puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,900']
  });
}

// Step 1: Register on TokenHarbor
async function registerTokenHarbor(page, email) {
  console.log(`  [REGISTER] Opening TokenHarbor signup...`);
  await page.goto(`https://tokenharbor.ai/login?invite=${INVITE}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(3000);

  // Click "Sign up" tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, [role="tab"], a'));
    const signup = btns.find(b => b.textContent.trim().toLowerCase() === 'sign up');
    if (signup) signup.click();
  });
  await delay(2000);

  // Fill form using click + type
  console.log(`  [REGISTER] Filling form...`);
  
  // Email
  await page.evaluate(() => {
    const input = document.querySelector('input[type="email"], input[name="email"]');
    if (input) { input.value = ''; input.focus(); }
  });
  const emailInput = await page.$('input[type="email"], input[name="email"]');
  if (emailInput) {
    await emailInput.click({ clickCount: 3 });
    await emailInput.type(email, { delay: 30 });
  }
  await delay(500);

  // Password
  await page.evaluate(() => {
    const input = document.querySelector('input[type="password"]');
    if (input) { input.value = ''; input.focus(); }
  });
  const passInput = await page.$('input[type="password"]');
  if (passInput) {
    await passInput.click({ clickCount: 3 });
    await passInput.type(PASSWORD, { delay: 30 });
  }
  await delay(500);

  // Invite code (might be pre-filled)
  const inviteInput = await page.$('input[name="invite"], input[placeholder*="invite"], input[placeholder*="Invite"]');
  if (inviteInput) {
    const val = await page.evaluate(el => el.value, inviteInput);
    if (!val) {
      await inviteInput.click();
      await inviteInput.type(INVITE, { delay: 30 });
    }
  }
  await delay(500);

  // Click "Create account" button
  console.log(`  [REGISTER] Submitting...`);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[type="submit"], button'));
    const createBtn = btns.find(b => b.textContent.trim().toLowerCase().includes('create account'));
    if (createBtn) createBtn.click();
  });
  await delay(5000);

  // Check result
  const pageText = await page.evaluate(() => document.body.innerText);
  const url = page.url();
  
  if (pageText.includes('Too many sign-ups') || pageText.includes('rate limit')) {
    return { success: false, error: 'RATE_LIMITED' };
  }
  if (pageText.includes('already') || pageText.includes('exists')) {
    return { success: true, status: 'ALREADY_EXISTS' };
  }
  if (url.includes('login') && !url.includes('signup')) {
    // Might have registered but stayed on login page
    return { success: true, status: 'REGISTERED_OR_LOGIN' };
  }
  
  return { success: true, status: 'REGISTERED' };
}

// Step 2: Verify email via Gmail
async function verifyEmail(page, email) {
  console.log(`  [VERIFY] Opening Gmail...`);
  await page.goto('https://mail.google.com', { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(5000);

  let url = page.url();

  // Login to Gmail if needed
  if (url.includes('accounts.google.com')) {
    console.log(`  [VERIFY] Logging into Gmail...`);
    await page.waitForSelector('#identifierId', { timeout: 10000 });
    await page.type('#identifierId', email, { delay: 30 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
      if (btn) btn.click();
    });
    await delay(5000);

    // Password
    const passField = await page.$('input[type="password"]');
    if (passField) {
      await passField.click();
      await passField.type(PASSWORD.replace('!', ''), { delay: 30 }); // Gmail pw doesn't have !
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
        if (btn) btn.click();
      });
      await delay(5000);
    }

    // Consent
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        b.textContent.trim() === 'Lanjutkan' || b.textContent.trim() === 'Continue'
      );
      if (btn) btn.click();
    });
    await delay(5000);
  }

  url = page.url();
  if (!url.includes('mail.google.com')) {
    console.log(`  [VERIFY] Not in Gmail: ${url.substring(0, 60)}`);
    return false;
  }

  console.log(`  [VERIFY] In Gmail, searching for TokenHarbor...`);
  await delay(3000);

  // Search for TokenHarbor
  const searchBox = await page.$('input[aria-label="Search"], input[name="q"]');
  if (searchBox) {
    await searchBox.click();
    await delay(500);
    await searchBox.type('tokenharbor', { delay: 30 });
    await delay(500);
    await page.keyboard.press('Enter');
    await delay(5000);
  }

  // Look for verification email and click it
  const clicked = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tr, div[role="row"], div[data-legacy-message-id], z'));
    const thRow = rows.find(r => r.textContent.includes('TokenHarbor') || r.textContent.includes('tokenharbor') || r.textContent.includes('Verify'));
    if (thRow) { thRow.click(); return 'clicked'; }
    
    const link = Array.from(document.querySelectorAll('a')).find(l => 
      l.textContent.includes('TokenHarbor') || l.href.includes('tokenharbor')
    );
    if (link) { link.click(); return 'clicked link'; }
    return 'not found';
  });
  console.log(`  [VERIFY] Email: ${clicked}`);
  await delay(3000);

  // Find and click verify link
  const verifyLink = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    for (const l of links) {
      if (l.href.includes('verify') || l.href.includes('confirm') ||
          l.textContent.toLowerCase().includes('verify') || l.textContent.toLowerCase().includes('confirm')) {
        return l.href;
      }
    }
    // Also check for button-like links
    const btns = Array.from(document.querySelectorAll('a, button'));
    const verifyBtn = btns.find(b => 
      b.textContent.toLowerCase().includes('verify') || b.textContent.toLowerCase().includes('confirm email')
    );
    if (verifyBtn && verifyBtn.href) return verifyBtn.href;
    return null;
  });

  if (verifyLink) {
    console.log(`  [VERIFY] Found verify link, clicking...`);
    await page.goto(verifyLink, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await delay(3000);
    console.log(`  [VERIFY] Verified! URL: ${page.url()}`);
    return true;
  }

  console.log(`  [VERIFY] No verify link found in email`);
  return false;
}

// Step 3: Create API Key
async function createApiKey(page, email) {
  console.log(`  [APIKEY] Going to TokenHarbor dashboard...`);
  await page.goto('https://tokenharbor.ai/dashboard/api-keys', { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(3000);

  let url = page.url();
  
  // Login if needed
  if (url.includes('login')) {
    console.log(`  [APIKEY] Need to login...`);
    // Try email/password login
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) {
      await emailInput.click();
      await emailInput.type(email, { delay: 30 });
    }
    const passInput = await page.$('input[type="password"]');
    if (passInput) {
      await passInput.click();
      await passInput.type(PASSWORD, { delay: 30 });
    }
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        b.textContent.trim().toLowerCase().includes('sign in') || b.textContent.trim().toLowerCase().includes('log in')
      );
      if (btn) btn.click();
    });
    await delay(5000);
    url = page.url();
  }

  if (url.includes('login')) {
    console.log(`  [APIKEY] Still on login page, might need Google OAuth`);
    // Try Google OAuth
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Google'));
      if (btn) btn.click();
    });
    await delay(5000);
    
    // Handle Google consent
    const googleUrl = page.url();
    if (googleUrl.includes('accounts.google.com')) {
      // Already logged in from Gmail, just consent
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent.trim() === 'Lanjutkan' || b.textContent.trim() === 'Continue'
        );
        if (btn) btn.click();
      });
      await delay(5000);
    }
  }

  console.log(`  [APIKEY] URL: ${page.url()}`);
  await delay(3000);

  // Check if we're on dashboard
  const pageText = await page.evaluate(() => document.body.innerText);
  if (pageText.includes('suspended') || pageText.includes('Suspended')) {
    return { success: false, error: 'ACCOUNT_SUSPENDED' };
  }

  // Claim gift if available
  if (pageText.includes('gift') || pageText.includes('claim') || pageText.includes('Claim')) {
    console.log(`  [APIKEY] Claiming gift...`);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const claim = btns.find(b => b.textContent.toLowerCase().includes('claim'));
      if (claim) claim.click();
    });
    await delay(3000);
  }

  // Create new API key
  console.log(`  [APIKEY] Creating new API key...`);
  const newKeyBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    const btn = btns.find(b => 
      b.textContent.includes('New key') || b.textContent.includes('Create') || b.textContent.includes('Generate')
    );
    if (btn) { btn.click(); return 'clicked'; }
    return 'not found';
  });
  console.log(`  [APIKEY] New key button: ${newKeyBtn}`);
  await delay(2000);

  // Fill key label
  const labelInput = await page.$('input[name="name"], input[placeholder*="label"], input[placeholder*="name"]');
  if (labelInput) {
    await labelInput.click();
    await labelInput.type(`key-${Date.now()}`, { delay: 30 });
  }
  await delay(500);

  // Submit
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const submit = btns.find(b => 
      b.textContent.trim().toLowerCase().includes('create') && b.type === 'submit'
    );
    if (submit) submit.click();
    else {
      const any = btns.find(b => b.textContent.trim().toLowerCase().includes('create'));
      if (any) any.click();
    }
  });
  await delay(3000);

  // Extract API key
  const apiKey = await page.evaluate(() => {
    // Look for the key in the page
    const inputs = Array.from(document.querySelectorAll('input'));
    for (const input of inputs) {
      if (input.value && input.value.startsWith('thk_live_')) return input.value;
    }
    // Look in code/pre elements
    const codes = Array.from(document.querySelectorAll('code, pre, span'));
    for (const el of codes) {
      if (el.textContent.includes('thk_live_')) {
        const match = el.textContent.match(/thk_live_[\w-]+/);
        if (match) return match[0];
      }
    }
    // Look in all text
    const bodyText = document.body.innerText;
    const match = bodyText.match(/thk_live_[\w-]+/);
    if (match) return match[0];
    return null;
  });

  if (apiKey) {
    console.log(`  [APIKEY] ✅ Got API key!`);
    return { success: true, key: apiKey };
  }

  // Try clicking "Show" button
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const show = btns.find(b => b.textContent.toLowerCase().includes('show') || b.textContent.toLowerCase().includes('reveal'));
    if (show) show.click();
  });
  await delay(2000);

  const apiKey2 = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    const match = bodyText.match(/thk_live_[\w-]+/);
    return match ? match[0] : null;
  });

  if (apiKey2) {
    console.log(`  [APIKEY] ✅ Got API key after reveal!`);
    return { success: true, key: apiKey2 };
  }

  return { success: false, error: 'KEY_NOT_FOUND' };
}

// Main flow
async function processAccount(email) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Processing: ${email}`);
  console.log(`${'='.repeat(50)}`);

  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    // Step 1: Register
    const regResult = await registerTokenHarbor(page, email);
    console.log(`  [REGISTER] Result: ${JSON.stringify(regResult)}`);

    // Step 2: Verify email
    const verified = await verifyEmail(page, email);
    console.log(`  [VERIFY] Result: ${verified}`);

    // Step 3: Create API key
    const keyResult = await createApiKey(page, email);
    console.log(`  [APIKEY] Result: ${JSON.stringify(keyResult)}`);

    return { email, ...keyResult };
  } catch (err) {
    console.error(`  [ERROR] ${err.message}`);
    return { email, success: false, error: err.message };
  } finally {
    await browser.close();
  }
}

// Run
(async () => {
  console.log(`TokenHarbor Multi-Account Registration`);
  console.log(`Accounts: ${ACCOUNTS.length}`);
  console.log(`Password: ${PASSWORD}`);
  console.log(`Invite: ${INVITE}\n`);

  const results = [];
  
  for (const email of ACCOUNTS) {
    const result = await processAccount(email);
    results.push(result);
    
    if (result.success) {
      console.log(`\n✅ ${email} → ${result.key}`);
    } else {
      console.log(`\n❌ ${email} → ${result.error}`);
    }
    
    // Delay between accounts
    if (ACCOUNTS.indexOf(email) < ACCOUNTS.length - 1) {
      console.log(`\nWaiting 5s before next account...`);
      await delay(5000);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(50)}`);
  for (const r of results) {
    if (r.success) {
      console.log(`✅ ${r.email}|${r.key}`);
    } else {
      console.log(`❌ ${r.email}|${r.error}`);
    }
  }
})();
