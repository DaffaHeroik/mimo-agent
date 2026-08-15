const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const CHROME = '/home/work/.openclaw/workspace/.openclaw/tmp/chrome-dir/chrome';
const PW = 'Daffa112233!';
const GPW = 'Daffa112233';

const accounts = [
  'muni3@bekri.site', 'muni4@bekri.site', 'muni5@bekri.site',
  'muni6@bekri.site', 'muni7@bekri.site', 'muni8@bekri.site', 'muni9@bekri.site', 'muni10@bekri.site'
];

const results = [
  { email: 'muni1@bekri.site', key: 'thk_live_XXf1Dss3VEj3QjuB-9SSZ_Bc-waBhvSsKxbhdRPfVzXjvfVZPMlbEiaEsSTxWHxV' },
  { email: 'muni2@bekri.site', key: 'thk_live_8DFUzvnnQEN_N9E0Ott94LSiTZHOZaUDrrlU_WQp164SPPWIxjIhrosWiP6uXmBK' }
];

async function processAccount(email) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${email}`);
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();

  try {
    // Register
    console.log('[1/6] Register...');
    await page.goto(`https://tokenharbor.ai/login?invite=TH-653T-4B6A`, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(2000);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Essential only')); if(b) b.click(); });
    await sleep(500);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Sign up'); if(b) b.click(); });
    await sleep(1000);
    let ei = await page.$('input[type="email"]'); if(ei){ await ei.click(); await ei.type(email, {delay:30}); }
    await sleep(300);
    let pi = await page.$('input[type="password"]'); if(pi){ await pi.click(); await pi.type(PW, {delay:30}); }
    await sleep(300);
    await page.keyboard.press('Enter');
    await sleep(8000);

    const regText = await page.evaluate(() => document.body.innerText.substring(0, 300));
    if (regText.includes('free tier limit') || regText.includes('rate limit')) {
      console.log('❌ RATE LIMITED');
      await browser.close();
      return { email, status: 'rate_limited', key: null };
    }
    if (regText.includes("couldn't create")) {
      console.log('❌ Registration error');
      await browser.close();
      return { email, status: 'reg_error', key: null };
    }
    console.log('  ✅ Registered');

    // Gmail login
    console.log('[2/6] Gmail login...');
    await page.goto('https://accounts.google.com/signin/v2/identifier?continue=https://mail.google.com/mail/', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);
    const ge = await page.waitForSelector('input[type="email"], #identifierId', {timeout:10000});
    await ge.click({clickCount:3}); await ge.type(email, {delay:50});
    await sleep(1000);
    await page.evaluate(() => { const b = document.querySelector('#identifierNext button') || document.querySelector('button[jsname="LgbsSe"]'); if(b) b.click(); });
    await sleep(5000);
    const gp = await page.waitForSelector('input[type="password"]', {timeout:10000});
    await gp.click({clickCount:3}); await gp.type(GPW, {delay:50});
    await sleep(1000);
    await page.evaluate(() => { const b = document.querySelector('#passwordNext button') || document.querySelector('button[jsname="LgbsSe"]'); if(b) b.click(); });
    await sleep(8000);
    for(let i=0;i<3;i++){const c=await page.evaluate(()=>{const b=Array.from(document.querySelectorAll('button')).find(x=>{const t=x.textContent.toLowerCase();return t.includes('continue')||t.includes('accept')||t.includes('lanjutkan')});if(b){b.click();return true;}return false;});if(c)await sleep(2000);else break;}

    // Gmail
    console.log('[3/6] Checking Gmail...');
    await page.goto('https://mail.google.com/mail/u/0/', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(5000);

    let clicked = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr');
      for (const r of rows) { if (r.textContent.includes('Token Harbor') && r.textContent.includes('Verify')) { r.click(); return true; } }
      for (const r of rows) { if (r.textContent.includes('Token Harbor')) { r.click(); return true; } }
      return false;
    });
    if (!clicked) {
      await sleep(8000);
      await page.goto('https://mail.google.com/mail/u/0/', {waitUntil:'networkidle2',timeout:30000});
      await sleep(5000);
      clicked = await page.evaluate(() => { const rows = document.querySelectorAll('tr'); for (const r of rows) { if (r.textContent.includes('Token Harbor')) { r.click(); return true; } } return false; });
    }
    if (!clicked) {
      console.log('  ❌ Email not found');
      await browser.close();
      return { email, status: 'email_not_found', key: null };
    }
    await sleep(3000);

    const vl = await page.evaluate(() => {
      for (const a of document.querySelectorAll('a')) { if ((a.href||'').includes('verify-email')) return a.href; }
      const m = document.body.innerText.match(/https:\/\/tokenharbor\.ai\/verify-email\?token=[^\s]+/);
      return m ? m[0] : '';
    });
    if (!vl) {
      console.log('  ❌ No verify link');
      await browser.close();
      return { email, status: 'verify_link_not_found', key: null };
    }
    console.log('  ✅ Got verify link');

    // Verify
    console.log('[4/6] Verifying...');
    await page.goto(vl, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(5000);

    // Login
    console.log('[5/6] Logging in...');
    await page.goto('https://tokenharbor.ai/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Sign in'); if(b) b.click(); });
    await sleep(1000);
    ei = await page.$('input[type="email"]'); if(ei){ await ei.click(); await ei.type(email, {delay:30}); }
    await sleep(300);
    pi = await page.$('input[type="password"]'); if(pi){ await pi.click(); await pi.type(PW, {delay:30}); }
    await sleep(300);
    await page.keyboard.press('Enter');
    await sleep(8000);

    if (!page.url().includes('dashboard')) {
      console.log('  ❌ Login failed');
      await browser.close();
      return { email, status: 'login_failed', key: null };
    }
    console.log('  ✅ Logged in');

    // Create API key
    console.log('[6/6] Creating API key...');
    await page.goto('https://tokenharbor.ai/dashboard/api-keys', { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(2000);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('new key')); if(b) b.click(); });
    await sleep(2000);
    const li = await page.$('input[type="text"]'); if(li){ await li.click({clickCount:3}); await li.type(email.split('@')[0]+'-key', {delay:20}); await sleep(500); }
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('create key')); if(b) b.click(); });
    await sleep(3000);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('show')); if(b) b.click(); });
    await sleep(2000);

    const key = await page.evaluate(() => {
      const m = document.body.innerText.match(/thk_live_[a-zA-Z0-9_\-]{20,}/);
      if (m) return m[0];
      for (const i of document.querySelectorAll('input')) { if (i.value.length > 20 && i.value.includes('_')) return i.value; }
      return '';
    });

    if (key) {
      console.log(`\n✅ API KEY: ${key}`);
      await browser.close();
      return { email, status: 'success', key };
    }

    console.log('  ⚠️ No key found');
    await browser.close();
    return { email, status: 'key_failed', key: null };

  } catch (err) {
    console.log(`❌ ERROR: ${err.message}`);
    try { await browser.close(); } catch {}
    return { email, status: 'error', key: null };
  }
}

(async () => {
  console.log('TokenHarbor Batch - Remaining 8 accounts\n');

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
    console.log(`${r.email}: ${r.key ? '✅ ' + r.key : '❌ ' + r.status}`);
  }
  fs.writeFileSync('tokenharbor-bekri-results.txt', results.map(r => `${r.email}|${r.key || r.status}`).join('\n'));
})();
