/**
 * TokenHarbor Auto-Register
 * =========================
 * Tinggal isi accounts.txt, jalankan, selesai.
 * 
 * Format accounts.txt:
 *   email1@domain.com|password1|google_password1
 *   email2@domain.com|password2|google_password2
 * 
 * Cara pakai:
 *   npm install
 *   node start.js
 * 
 * Hasil: results.txt
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(msg) { console.log(`[${new Date().toLocaleTimeString()}] ${msg}`); }

// ============== CONFIG ==============
const INVITE = 'TH-653T-4B6A';
const RESULTS_FILE = path.join(__dirname, 'results.txt');
const ACCOUNTS_FILE = path.join(__dirname, 'accounts.txt');
// ====================================

function loadAccounts() {
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    console.error('❌ accounts.txt tidak ditemukan!');
    console.error('   Buat file accounts.txt dengan format:');
    console.error('   email@domain.com|password|google_password');
    process.exit(1);
  }

  const lines = fs.readFileSync(ACCOUNTS_FILE, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  return lines.map(line => {
    const parts = line.split('|');
    if (parts.length < 2) {
      console.error(`❌ Format salah: ${line}`);
      console.error('   Format: email|password|google_password');
      process.exit(1);
    }
    return {
      email: parts[0].trim(),
      password: parts[1].trim(),
      googlePassword: (parts[2] || parts[1]).trim(), // fallback ke password utama
    };
  });
}

function loadDone() {
  if (!fs.existsSync(RESULTS_FILE)) return new Set();
  return new Set(
    fs.readFileSync(RESULTS_FILE, 'utf8')
      .split('\n')
      .filter(l => l.includes('thk_live_'))
      .map(l => l.split('|')[0])
  );
}

function saveResult(email, keyOrStatus) {
  fs.appendFileSync(RESULTS_FILE, `${email}|${keyOrStatus}\n`);
}

async function launch() {
  return puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });
}

// ===== STEP 1: Register =====
async function register(account) {
  const { email, password } = account;
  log('  [1/5] Register...');
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.goto(`https://tokenharbor.ai/login?invite=${INVITE}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(2000);

    // Cookies
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Essential only')); if (b) b.click(); });
    await sleep(500);

    // Sign up tab
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Sign up'); if (b) b.click(); });
    await sleep(1000);

    // Fill
    await page.click('input[type="email"]');
    await page.type('input[type="email"]', email, { delay: 40 });
    await sleep(300);
    await page.click('input[type="password"]');
    await page.type('input[type="password"]', password, { delay: 40 });
    await sleep(300);

    // Submit
    await page.keyboard.press('Enter');
    await sleep(8000);

    const text = await page.evaluate(() => document.body.innerText.substring(0, 500));
    const url = page.url();

    await browser.close();

    if (text.includes('Too many sign-ups')) return 'rate_limited';
    if (text.includes("couldn't create")) return 'server_error';
    if (url.includes('dashboard') || text.includes('already on board')) return 'ok';
    return 'ok'; // assume success, will verify in login step
  } catch (e) {
    await browser.close();
    return 'error:' + e.message.substring(0, 50);
  }
}

// ===== STEP 2: Get Verify Link from Gmail =====
async function getVerifyLink(account) {
  const { email, googlePassword } = account;
  log('  [2/5] Gmail...');
  const browser = await launch();
  try {
    const page = await browser.newPage();

    // Login Google
    await page.goto('https://accounts.google.com/signin/v2/identifier?continue=https://mail.google.com/mail/', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    let el = await page.waitForSelector('input[type="email"], #identifierId', { timeout: 10000 });
    await el.click({ clickCount: 3 });
    await el.type(email, { delay: 40 });
    await sleep(1000);
    await page.evaluate(() => { const b = document.querySelector('#identifierNext button') || document.querySelector('button[jsname="LgbsSe"]'); if (b) b.click(); });
    await sleep(5000);

    el = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await el.click({ clickCount: 3 });
    await el.type(googlePassword, { delay: 40 });
    await sleep(1000);
    await page.evaluate(() => { const b = document.querySelector('#passwordNext button') || document.querySelector('button[jsname="LgbsSe"]'); if (b) b.click(); });
    await sleep(8000);

    // Consent
    for (let i = 0; i < 3; i++) {
      const c = await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('button')).find(x => {
          const t = x.textContent.toLowerCase();
          return t.includes('continue') || t.includes('accept') || t.includes('allow') || t.includes('lanjutkan');
        });
        if (b) { b.click(); return true; } return false;
      });
      if (c) await sleep(2000); else break;
    }

    // Gmail
    await page.goto('https://mail.google.com/mail/u/0/', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(5000);

    // Cari email
    let found = await findAndClickEmail(page);
    if (!found) {
      log('    Waiting 15s for email...');
      await sleep(15000);
      await page.goto('https://mail.google.com/mail/u/0/', { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(5000);
      found = await findAndClickEmail(page);
    }
    if (!found) {
      // Cek spam
      await page.goto('https://mail.google.com/mail/u/0/#spam', { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(3000);
      found = await findAndClickEmail(page);
    }
    if (!found) {
      await browser.close();
      return null;
    }

    await sleep(3000);

    // Extract link
    const link = await page.evaluate(() => {
      for (const a of document.querySelectorAll('a')) {
        if ((a.href || '').includes('verify-email')) return a.href;
      }
      const m = document.body.innerText.match(/https:\/\/tokenharbor\.ai\/verify-email\?token=[a-zA-…+/);
      return m ? m[0] : '';
    });

    await browser.close();
    return link || null;
  } catch (e) {
    await browser.close();
    return null;
  }
}

async function findAndClickEmail(page) {
  return page.evaluate(() => {
    const rows = document.querySelectorAll('tr');
    for (const r of rows) {
      if (r.textContent.includes('Token Harbor') && r.textContent.includes('Verify')) { r.click(); return true; }
    }
    for (const r of rows) {
      if (r.textContent.includes('Token Harbor')) { r.click(); return true; }
    }
    return false;
  });
}

// ===== STEP 3: Verify =====
async function verify(link) {
  log('  [3/5] Verify...');
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.goto(link, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(5000);
    await browser.close();
    return true;
  } catch {
    await browser.close();
    return false;
  }
}

// ===== STEP 4: Login =====
async function login(account) {
  log('  [4/5] Login...');
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.goto('https://tokenharbor.ai/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Sign in'); if (b) b.click(); });
    await sleep(1000);

    await page.click('input[type="email"]');
    await page.type('input[type="email"]', account.email, { delay: 30 });
    await sleep(300);
    await page.click('input[type="password"]');
    await page.type('input[type="password"]', account.password, { delay: 30 });
    await sleep(300);
    await page.keyboard.press('Enter');
    await sleep(8000);

    const ok = page.url().includes('dashboard');
    await browser.close();
    return ok;
  } catch {
    await browser.close();
    return false;
  }
}

// ===== STEP 5: Create API Key =====
async function createKey(account) {
  log('  [5/5] API Key...');
  const browser = await launch();
  try {
    const page = await browser.newPage();

    // Login dulu
    await page.goto('https://tokenharbor.ai/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Sign in'); if (b) b.click(); });
    await sleep(1000);
    await page.click('input[type="email"]');
    await page.type('input[type="email"]', account.email, { delay: 30 });
    await sleep(300);
    await page.click('input[type="password"]');
    await page.type('input[type="password"]', account.password, { delay: 30 });
    await sleep(300);
    await page.keyboard.press('Enter');
    await sleep(8000);

    if (!page.url().includes('dashboard')) {
      await browser.close();
      return null;
    }

    // Enable free models
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

    // Create key
    await page.goto('https://tokenharbor.ai/dashboard/api-keys', { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('new key')); if (b) b.click(); });
    await sleep(2000);

    const li = await page.$('input[type="text"]');
    if (li) {
      await li.click({ clickCount: 3 });
      await li.type(account.email.split('@')[0] + '-key', { delay: 20 });
      await sleep(500);
    }

    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('create key')); if (b) b.click(); });
    await sleep(3000);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('show')); if (b) b.click(); });
    await sleep(2000);

    const key = await page.evaluate(() => {
      const m = document.body.innerText.match(/thk_live_[a-zA-Z0-9_\-]{20,}/);
      if (m) return m[0];
      for (const i of document.querySelectorAll('input')) {
        if (i.value.length > 20 && i.value.includes('_')) return i.value;
      }
      return '';
    });

    await browser.close();
    return key || null;
  } catch {
    await browser.close();
    return null;
  }
}

// ===== MAIN =====
(async () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  TokenHarbor Auto-Register                      ║');
  console.log('║  Invite: TH-653T-4B6A ($5 free per akun)        ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  const accounts = loadAccounts();
  const done = loadDone();

  log(`Accounts: ${accounts.length} | Already done: ${done.size} | Sisa: ${accounts.length - done.size}`);
  console.log('');

  let success = 0;
  let failed = 0;

  for (const account of accounts) {
    if (done.has(account.email)) {
      log(`${account.email} — SKIP (sudah ada)`);
      continue;
    }

    console.log('─'.repeat(50));
    log(`▶ ${account.email}`);

    // Step 1: Register
    const regResult = await register(account);
    if (regResult === 'rate_limited') {
      log('  ❌ RATE LIMITED — tunggu 1 jam atau ganti jaringan');
      saveResult(account.email, 'rate_limited');
      failed++;
      break;
    }
    if (regResult === 'server_error') {
      log('  ❌ Server error — coba lagi nanti');
      saveResult(account.email, 'server_error');
      failed++;
      continue;
    }
    log('  ✅ Registered');

    // Step 2: Get verify link
    const verifyLink = await getVerifyLink(account);
    if (!verifyLink) {
      log('  ⚠️ Verify link tidak ditemukan — coba login langsung...');
      // Mungkin sudah verified, coba langsung buat key
      const key = await createKey(account);
      if (key) {
        log(`  ✅ KEY: ${key}`);
        saveResult(account.email, key);
        success++;
      } else {
        log('  ❌ Gagal');
        saveResult(account.email, 'failed');
        failed++;
      }
      await sleep(3000);
      continue;
    }
    log('  ✅ Verify link ditemukan');

    // Step 3: Verify
    await verify(verifyLink);
    log('  ✅ Verified');

    // Step 4: Login
    const loggedIn = await login(account);
    if (!loggedIn) {
      log('  ❌ Login gagal');
      saveResult(account.email, 'login_failed');
      failed++;
      await sleep(3000);
      continue;
    }
    log('  ✅ Logged in');

    // Step 5: Create API key
    const key = await createKey(account);
    if (key) {
      log(`  ✅ KEY: ${key}`);
      saveResult(account.email, key);
      success++;
    } else {
      log('  ❌ Gagal buat key');
      saveResult(account.email, 'key_failed');
      failed++;
    }

    await sleep(3000);
  }

  // Summary
  console.log('');
  console.log('═'.repeat(50));
  console.log('  SELESAI');
  console.log('═'.repeat(50));
  console.log(`  ✅ Berhasil: ${success}`);
  console.log(`  ❌ Gagal: ${failed}`);
  console.log(`  📄 Hasil: ${RESULTS_FILE}`);
  console.log('');

  // Tampilkan semua key
  if (fs.existsSync(RESULTS_FILE)) {
    const lines = fs.readFileSync(RESULTS_FILE, 'utf8').split('\n').filter(l => l);
    console.log('  Semua hasil:');
    for (const line of lines) {
      const [email, key] = line.split('|');
      const status = key.startsWith('thk_live_') ? '✅' : '❌';
      console.log(`    ${status} ${email}: ${key.substring(0, 30)}${key.length > 30 ? '...' : ''}`);
    }
  }
  console.log('');
})();
