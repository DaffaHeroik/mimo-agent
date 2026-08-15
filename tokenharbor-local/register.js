/**
 * TokenHarbor Batch Registration — Local Version
 * 
 * Jalankan dari komputer lokal (bukan server) untuk hindari rate limit.
 * 
 * Cara pakai:
 *   1. npm install
 *   2. node register.js
 * 
 * Hasil disimpan di: results.txt
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============== KONFIGURASI ==============
const ACCOUNTS = [
  'muni4@bekri.site',
  'muni5@bekri.site',
  'muni6@bekri.site',
  'muni7@bekri.site',
  'muni8@bekri.site',
  'muni9@bekri.site',
  'muni10@bekri.site',
];
const PASSWORD = 'Daffa112233!';  // Minimal 12 karakter
const GOOGLE_PASSWORD = 'Daffa112233';  // Password Google asli
const INVITE_CODE = 'TH-653T-4B6A';

// Sudah berhasil sebelumnya (dari server)
const DONE = [
  { email: 'muni1@bekri.site', key: 'thk_live_XXf1Dss3VEj3QjuB-9SSZ_Bc-waBhvSsKxbhdRPfVzXjvfVZPMlbEiaEsSTxWHxV' },
  { email: 'muni2@bekri.site', key: 'thk_live_8DFUzvnnQEN_N9E0Ott94LSiTZHOZaUDrrlU_WQp164SPPWIxjIhrosWiP6uXmBK' },
  { email: 'muni3@bekri.site', key: 'thk_live_3MKv4vTaCwk4IZnvylPeSF6YIgVp_9PAkw5uppuHG4W_LcOA8cWIc_ci9zqmGQCV' },
];
// =========================================

const results = [...DONE];

async function processAccount(email) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${email}`);
  console.log('='.repeat(50));

  let browser;
  try {
    // === STEP 1: Register ===
    console.log('[1/5] Register...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
    });
    const page = await browser.newPage();

    await page.goto(`https://tokenharbor.ai/login?invite=${INVITE_CODE}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(2000);

    // Accept cookies
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Essential only'));
      if (b) b.click();
    });
    await sleep(500);

    // Click Sign up
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Sign up');
      if (b) b.click();
    });
    await sleep(1000);

    // Fill form
    await page.click('input[type="email"]');
    await page.type('input[type="email"]', email, { delay: 50 });
    await sleep(300);
    await page.click('input[type="password"]');
    await page.type('input[type="password"]', PASSWORD, { delay: 50 });
    await sleep(300);

    // Submit
    await page.keyboard.press('Enter');
    await sleep(8000);

    const regText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    if (regText.includes('Too many sign-ups')) {
      console.log('  ❌ RATE LIMITED — tunggu 1 jam atau ganti jaringan');
      await browser.close();
      return { email, status: 'rate_limited', key: null };
    }
    if (regText.includes("couldn't create")) {
      console.log('  ❌ Server error — coba lagi nanti');
      await browser.close();
      return { email, status: 'server_error', key: null };
    }
    console.log('  ✅ Registered');
    await browser.close();

    // === STEP 2: Gmail — ambil verification link ===
    console.log('[2/5] Gmail...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
    });
    const gp = await browser.newPage();

    // Login Gmail
    await gp.goto('https://accounts.google.com/signin/v2/identifier?continue=https://mail.google.com/mail/', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);
    const ge = await gp.waitForSelector('input[type="email"], #identifierId', { timeout: 10000 });
    await ge.click({ clickCount: 3 });
    await ge.type(email, { delay: 50 });
    await sleep(1000);
    await gp.evaluate(() => { const b = document.querySelector('#identifierNext button') || document.querySelector('button[jsname="LgbsSe"]'); if (b) b.click(); });
    await sleep(5000);
    const gpd = await gp.waitForSelector('input[type="password"]', { timeout: 10000 });
    await gpd.click({ clickCount: 3 });
    await gpd.type(GOOGLE_PASSWORD, { delay: 50 });
    await sleep(1000);
    await gp.evaluate(() => { const b = document.querySelector('#passwordNext button') || document.querySelector('button[jsname="LgbsSe"]'); if (b) b.click(); });
    await sleep(8000);

    // Handle consent
    for (let i = 0; i < 3; i++) {
      const c = await gp.evaluate(() => {
        const b = Array.from(document.querySelectorAll('button')).find(x => {
          const t = x.textContent.toLowerCase();
          return t.includes('continue') || t.includes('accept') || t.includes('allow') || t.includes('lanjutkan');
        });
        if (b) { b.click(); return true; }
        return false;
      });
      if (c) await sleep(2000);
      else break;
    }

    // Buka Gmail
    await gp.goto('https://mail.google.com/mail/u/0/', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(5000);

    // Cari email TokenHarbor
    let clicked = await gp.evaluate(() => {
      const rows = document.querySelectorAll('tr');
      for (const r of rows) { if (r.textContent.includes('Token Harbor') && r.textContent.includes('Verify')) { r.click(); return true; } }
      for (const r of rows) { if (r.textContent.includes('Token Harbor')) { r.click(); return true; } }
      return false;
    });

    if (!clicked) {
      console.log('  Menunggu email...');
      await sleep(15000);
      await gp.goto('https://mail.google.com/mail/u/0/', { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(5000);
      clicked = await gp.evaluate(() => {
        const rows = document.querySelectorAll('tr');
        for (const r of rows) { if (r.textContent.includes('Token Harbor')) { r.click(); return true; } }
        return false;
      });
    }

    if (!clicked) {
      // Cek spam
      await gp.goto('https://mail.google.com/mail/u/0/#spam', { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(3000);
      clicked = await gp.evaluate(() => {
        const rows = document.querySelectorAll('tr');
        for (const r of rows) { if (r.textContent.includes('Token Harbor')) { r.click(); return true; } }
        return false;
      });
    }

    if (!clicked) {
      console.log('  ❌ Email verifikasi tidak ditemukan');
      await browser.close();
      return { email, status: 'email_not_found', key: null };
    }
    await sleep(3000);

    // Ambil verify link
    const verifyLink = await gp.evaluate(() => {
      for (const a of document.querySelectorAll('a')) { if ((a.href || '').includes('verify-email')) return a.href; }
      const m = document.body.innerText.match(/https:\/\/tokenharbor\.ai\/verify-email\?token=[a-zA-Z0-9+/=]+/);
      return m ? m[0] : '';
    });

    if (!verifyLink) {
      console.log('  ❌ Verify link tidak ditemukan');
      await browser.close();
      return { email, status: 'no_verify_link', key: null };
    }
    console.log('  ✅ Verify link ditemukan');

    // === STEP 3: Verify ===
    console.log('[3/5] Verifying...');
    await gp.goto(verifyLink, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(5000);
    console.log('  ✅ Verified');
    await browser.close();

    // === STEP 4: Login ===
    console.log('[4/5] Login...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
    });
    const lp = await browser.newPage();
    await lp.goto('https://tokenharbor.ai/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);
    await lp.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Sign in'); if (b) b.click(); });
    await sleep(1000);
    await lp.click('input[type="email"]');
    await lp.type('input[type="email"]', email, { delay: 30 });
    await sleep(300);
    await lp.click('input[type="password"]');
    await lp.type('input[type="password"]', PASSWORD, { delay: 30 });
    await sleep(300);
    await lp.keyboard.press('Enter');
    await sleep(8000);

    if (!lp.url().includes('dashboard')) {
      console.log('  ❌ Login gagal');
      await browser.close();
      return { email, status: 'login_failed', key: null };
    }
    console.log('  ✅ Logged in');

    // === STEP 5: Create API Key ===
    console.log('[5/5] Creating API key...');
    await lp.goto('https://tokenharbor.ai/dashboard/api-keys', { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);
    await lp.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('new key')); if (b) b.click(); });
    await sleep(2000);
    const li = await lp.$('input[type="text"]');
    if (li) { await li.click({ clickCount: 3 }); await li.type(email.split('@')[0] + '-key', { delay: 20 }); await sleep(500); }
    await lp.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('create key')); if (b) b.click(); });
    await sleep(3000);
    await lp.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('show')); if (b) b.click(); });
    await sleep(2000);

    const apiKey = await lp.evaluate(() => {
      const m = document.body.innerText.match(/thk_live_[a-zA-Z0-9_\-]{20,}/);
      if (m) return m[0];
      for (const i of document.querySelectorAll('input')) { if (i.value.length > 20 && i.value.includes('_')) return i.value; }
      return '';
    });

    await browser.close();

    if (apiKey) {
      console.log(`\n  ✅ API KEY: ${apiKey}`);
      return { email, status: 'success', key: apiKey };
    }
    console.log('  ⚠️ Gagal extract key');
    return { email, status: 'key_failed', key: null };

  } catch (err) {
    console.log(`  ❌ ERROR: ${err.message}`);
    try { if (browser) await browser.close(); } catch {}
    return { email, status: 'error', key: null };
  }
}

(async () => {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  TokenHarbor Batch Registration (Local)     ║');
  console.log('║  Invite: TH-653T-4B6A ($5 free per akun)    ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`\nAkun: ${ACCOUNTS.length} | Done: ${DONE.length} | Sisa: ${ACCOUNTS.length}`);

  for (const email of ACCOUNTS) {
    const result = await processAccount(email);
    results.push(result);

    // Simpan progress
    fs.writeFileSync('results.txt', results.map(r => `${r.email}|${r.key || r.status}`).join('\n'));

    if (result.status === 'rate_limited') {
      console.log('\n⚠️ Rate limited! Tunggu 1 jam lalu jalankan lagi.');
      break;
    }
    await sleep(3000);
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('  HASIL AKHIR');
  console.log('═'.repeat(50));
  const success = results.filter(r => r.key);
  const failed = results.filter(r => !r.key);
  console.log(`  ✅ Berhasil: ${success.length}/${results.length}`);
  console.log(`  ❌ Gagal: ${failed.length}/${results.length}`);
  console.log('');
  for (const r of results) {
    const status = r.key ? `✅ ${r.key}` : `❌ ${r.status}`;
    console.log(`  ${r.email}: ${status}`);
  }
  console.log('\n  Results saved to: results.txt');
})();
