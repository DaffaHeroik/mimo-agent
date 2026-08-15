/**
 * Webshare Proxy Harvester
 * ========================
 * Register Webshare accounts, get 10 free proxies per account.
 * 
 * Format accounts.txt:
 *   email|google_password
 * 
 * Cara pakai:
 *   npm install
 *   node start.js
 * 
 * Hasil: proxies.txt
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(msg) { console.log(`[${new Date().toLocaleTimeString()}] ${msg}`); }

// ============== CONFIG ==============
const PASSWORD = '***';
const REFERRAL = 'https://www.webshare.io/?referral_code=trfidrzcsolc';
const RESULTS_FILE = path.join(__dirname, 'proxies.txt');
const ACCOUNTS_FILE = path.join(__dirname, 'accounts.txt');
// ====================================

function loadAccounts() {
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    console.error('❌ accounts.txt tidak ditemukan!');
    process.exit(1);
  }
  return fs.readFileSync(ACCOUNTS_FILE, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => {
      const [email, gpw] = l.split('|');
      return { email: email.trim(), googlePassword: (gpw || PASSWORD).trim() };
    });
}

function loadDone() {
  if (!fs.existsSync(RESULTS_FILE)) return new Set();
  const content = fs.readFileSync(RESULTS_FILE, 'utf8');
  const emails = content.match(/# (\S+@\S+)/g) || [];
  return new Set(emails.map(e => e.replace('# ', '')));
}

async function launch() {
  return puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });
}

// ===== STEP 1: Register via Google OAuth =====
async function registerGoogle(account) {
  const { email, googlePassword } = account;
  log('  [1/3] Register via Google...');
  const browser = await launch();
  try {
    const page = await browser.newPage();

    // Go to Webshare with referral
    await page.goto(REFERRAL, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(2000);

    // Click "Start with Google" or "Sign up with Google"
    const googleClicked = await page.evaluate(() => {
      const links = document.querySelectorAll('a, button');
      for (const el of links) {
        const text = (el.textContent || '').toLowerCase();
        if (text.includes('google') && (text.includes('start') || text.includes('sign up'))) {
          el.click();
          return true;
        }
      }
      return false;
    });

    if (!googleClicked) {
      log('  Google button not found, trying email signup...');
      await browser.close();
      return await registerEmail(account);
    }

    await sleep(5000);

    // Handle Google OAuth
    if (page.url().includes('accounts.google.com')) {
      log('  Google OAuth page...');
      const el = await page.waitForSelector('input[type="email"], #identifierId', { timeout: 10000 });
      await el.click({ clickCount: 3 });
      await el.type(email, { delay: 40 });
      await sleep(1000);
      await page.evaluate(() => { const b = document.querySelector('#identifierNext button') || document.querySelector('button[jsname="LgbsSe"]'); if (b) b.click(); });
      await sleep(5000);

      const pwd = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
      await pwd.click({ clickCount: 3 });
      await pwd.type(googlePassword, { delay: 40 });
      await sleep(1000);
      await page.evaluate(() => { const b = document.querySelector('#passwordNext button') || document.querySelector('button[jsname="LgbsSe"]'); if (b) b.click(); });
      await sleep(8000);

      // Consent
      for (let i = 0; i < 3; i++) {
        const c = await page.evaluate(() => {
          const b = Array.from(document.querySelectorAll('button')).find(x => {
            const t = x.textContent.toLowerCase();
            return t.includes('continue') || t.includes('allow') || t.includes('accept') || t.includes('lanjutkan');
          });
          if (b) { b.click(); return true; } return false;
        });
        if (c) await sleep(2000); else break;
      }
    }

    await sleep(5000);
    const url = page.url();
    log('  After OAuth URL: ' + url.substring(0, 60));

    if (url.includes('dashboard') || url.includes('proxy')) {
      log('  ✅ Registered via Google!');
      const proxies = await extractProxies(page, browser);
      await browser.close();
      return { email, status: 'success', proxies };
    }

    // Might need to complete registration
    const text = await page.evaluate(() => document.body.innerText.substring(0, 500));
    log('  Page: ' + text.substring(0, 100));

    await browser.close();
    return { email, status: 'unknown', proxies: [] };

  } catch (e) {
    log('  ❌ Error: ' + e.message.substring(0, 80));
    try { await browser.close(); } catch {}
    return { email, status: 'error', proxies: [] };
  }
}

// ===== STEP 1b: Register via Email =====
async function registerEmail(account) {
  const { email } = account;
  log('  [1/3] Register via Email...');
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.goto(REFERRAL, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(2000);

    // Click Sign Up
    await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const a of links) { if (a.textContent.trim() === 'Sign Up') { a.click(); return; } }
    });
    await sleep(3000);

    // Fill form
    await page.click('input[type="email"]');
    await page.type('input[type="email"]', email, { delay: 40 });
    await sleep(300);
    await page.click('input[type="password"]');
    await page.type('input[type="password"]', PASSWORD, { delay: 40 });
    await sleep(300);

    // Check terms
    await page.evaluate(() => {
      const cb = document.querySelector('input[type="checkbox"]');
      if (cb && !cb.checked) cb.click();
    });
    await sleep(500);

    // Try to submit (might hit captcha)
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) { if (b.textContent.includes('Sign Up')) b.click(); }
    });
    await sleep(8000);

    const url = page.url();
    const text = await page.evaluate(() => document.body.innerText.substring(0, 500));

    if (url.includes('dashboard') || url.includes('proxy') || url.includes('verify')) {
      log('  ✅ Registered via Email!');
      const proxies = await extractProxies(page, browser);
      await browser.close();
      return { email, status: 'success', proxies };
    }

    if (text.includes('captcha') || text.includes('robot')) {
      log('  ⚠️ Captcha detected — need manual solve or captcha solver');
      await browser.close();
      return { email, status: 'captcha', proxies: [] };
    }

    log('  ❌ Registration failed: ' + text.substring(0, 100));
    await browser.close();
    return { email, status: 'failed', proxies: [] };
  } catch (e) {
    try { await browser.close(); } catch {}
    return { email, status: 'error', proxies: [] };
  }
}

// ===== STEP 2: Login (if already registered) =====
async function login(account) {
  const { email, googlePassword } = account;
  log('  [2/3] Login...');
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.goto('https://www.webshare.io/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    // Try Google login first
    const googleClicked = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, a');
      for (const b of btns) { if ((b.textContent || '').toLowerCase().includes('google')) { b.click(); return true; } }
      return false;
    });

    if (googleClicked && page.url().includes('accounts.google.com')) {
      const el = await page.waitForSelector('input[type="email"], #identifierId', { timeout: 10000 });
      await el.click({ clickCount: 3 });
      await el.type(email, { delay: 40 });
      await sleep(1000);
      await page.evaluate(() => { const b = document.querySelector('#identifierNext button') || document.querySelector('button[jsname="LgbsSe"]'); if (b) b.click(); });
      await sleep(5000);
      const pwd = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
      await pwd.click({ clickCount: 3 });
      await pwd.type(googlePassword, { delay: 40 });
      await sleep(1000);
      await page.evaluate(() => { const b = document.querySelector('#passwordNext button') || document.querySelector('button[jsname="LgbsSe"]'); if (b) b.click(); });
      await sleep(8000);
      for (let i = 0; i < 3; i++) {
        const c = await page.evaluate(() => {
          const b = Array.from(document.querySelectorAll('button')).find(x => {
            const t = x.textContent.toLowerCase();
            return t.includes('continue') || t.includes('allow') || t.includes('accept') || t.includes('lanjutkan');
          });
          if (b) { b.click(); return true; } return false;
        });
        if (c) await sleep(2000); else break;
      }
    } else {
      // Email login
      await page.click('input[type="email"]');
      await page.type('input[type="email"]', email, { delay: 40 });
      await sleep(300);
      await page.click('input[type="password"]');
      await page.type('input[type="password"]', PASSWORD, { delay: 40 });
      await sleep(300);
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const b of btns) { if (b.textContent.includes('Sign In') || b.textContent.includes('Log In')) b.click(); }
      });
      await sleep(5000);
    }

    const url = page.url();
    if (url.includes('dashboard') || url.includes('proxy')) {
      log('  ✅ Logged in');
      const proxies = await extractProxies(page, browser);
      await browser.close();
      return { email, status: 'success', proxies };
    }

    log('  ❌ Login failed');
    await browser.close();
    return { email, status: 'login_failed', proxies: [] };
  } catch (e) {
    try { await browser.close(); } catch {}
    return { email, status: 'error', proxies: [] };
  }
}

// ===== STEP 3: Extract Proxies =====
async function extractProxies(page, browser) {
  log('  [3/3] Extract proxies...');

  // Navigate to proxy list
  await page.goto('https://www.webshare.io/dashboard/proxy-list', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(3000);

  // Try to find and click download/copy button
  const downloadClicked = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, a');
    for (const b of btns) {
      const text = (b.textContent || '').toLowerCase();
      if (text.includes('download') || text.includes('copy') || text.includes('export')) {
        b.click();
        return true;
      }
    }
    return false;
  });

  if (downloadClicked) await sleep(3000);

  // Extract proxy text from page
  const proxyText = await page.evaluate(() => {
    const text = document.body.innerText;
    // Match IP:port:username:password patterns
    const lines = text.split('\n');
    const proxies = [];
    for (const line of lines) {
      const m = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+):([^:]+):(.+)/);
      if (m) proxies.push(`${m[1]}:${m[2]}:${m[3]}:${m[4]}`);
      // Also match tab-separated
      const m2 = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+(\d+)\s+([^\s]+)\s+(.+)/);
      if (m2) proxies.push(`${m2[1]}:${m2[2]}:${m2[3]}:${m2[4]}`);
    }
    return proxies;
  });

  if (proxyText.length > 0) {
    log(`  ✅ Found ${proxyText.length} proxies`);
    return proxyText;
  }

  // Try API endpoint
  log('  Trying API endpoint...');
  const apiProxies = await page.evaluate(async () => {
    try {
      const resp = await fetch('/api/v2/proxy/list/?mode=direct&page=1&page_size=10');
      const data = await resp.json();
      if (data.results) {
        return data.results.map(r => `${r.proxy_address}:${r.port}:${r.username}:${r.password}`);
      }
    } catch {}
    return [];
  });

  if (apiProxies.length > 0) {
    log(`  ✅ Got ${apiProxies.length} proxies from API`);
    return apiProxies;
  }

  // Take screenshot for debugging
  await page.screenshot({ path: path.join(__dirname, 'debug-proxies.png') });
  log('  ⚠️ No proxies found — screenshot saved');

  return [];
}

// ===== MAIN =====
(async () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Webshare Proxy Harvester                       ║');
  console.log('║  Referral: trfidrzcsolc (10 proxies/account)    ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  const accounts = loadAccounts();
  const done = loadDone();

  log(`Accounts: ${accounts.length} | Already done: ${done.size}`);
  console.log('');

  const allProxies = [];

  for (const account of accounts) {
    if (done.has(account.email)) {
      log(`${account.email} — SKIP`);
      continue;
    }

    console.log('─'.repeat(50));
    log(`▶ ${account.email}`);

    // Try register via Google
    let result = await registerGoogle(account);

    // If failed, try login (maybe already registered)
    if (result.status === 'unknown' || result.status === 'error') {
      result = await login(account);
    }

    if (result.proxies.length > 0) {
      allProxies.push(...result.proxies);
      fs.appendFileSync(RESULTS_FILE, `\n# ${result.email}\n${result.proxies.join('\n')}\n`);
    }

    log(`  Status: ${result.status} | Proxies: ${result.proxies.length}`);
    await sleep(3000);
  }

  // Summary
  console.log('');
  console.log('═'.repeat(50));
  console.log('  SELESAI');
  console.log('═'.repeat(50));
  console.log(`  📦 Total proxies: ${allProxies.length}`);
  console.log(`  📄 Hasil: ${RESULTS_FILE}`);
  console.log('');

  if (allProxies.length > 0) {
    console.log('  Proxies:');
    for (const p of allProxies) console.log(`    ${p}`);
  }
})();
