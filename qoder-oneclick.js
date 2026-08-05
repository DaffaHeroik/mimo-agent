#!/usr/bin/env node
// ============================================================
//  Qoder One-Click Setup (Multi-Account + Retry)
//  1 menu → login semua account → retry kalau gagal → siap pakai
// ============================================================

const inquirer = require('/home/work/.openclaw/tmp/node_modules/inquirer');
const { execSync, spawn } = require('child_process');
const puppeteer = require('/home/work/.openclaw/tmp/node_modules/puppeteer-extra');
const StealthPlugin = require('/home/work/.openclaw/tmp/node_modules/puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME;
const PATH_STR = `${HOME}/.local/bin:${process.env.PATH}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MAX_RETRY = 3;

// ── Colors ──────────────────────────────────────────────────
const c = {
  r: '\x1b[0m', b: '\x1b[1m', d: '\x1b[2m',
  red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m',
  blu: '\x1b[34m', cyn: '\x1b[36m', mag: '\x1b[35m',
};

// ── Helpers ─────────────────────────────────────────────────
function run(cmd, t = 15000) {
  try { return execSync(cmd, { env: { ...process.env, PATH: PATH_STR }, encoding: 'utf-8', timeout: t }).trim(); }
  catch { return null; }
}

function ok(m)   { console.log(`  ${c.grn}✔${c.r} ${m}`); }
function err(m)  { console.log(`  ${c.red}✘${c.r} ${m}`); }
function info(m) { console.log(`  ${c.blu}ℹ${c.r} ${m}`); }
function warn(m) { console.log(`  ${c.yel}⚠${c.r} ${m}`); }
function step(n, m, max) { console.log(`\n  ${c.cyn}${c.b}[${n}/${max}]${c.r} ${c.b}${m}${c.r}`); }

function banner() {
  console.log(`
${c.cyn}${c.b}┌──────────────────────────────────────────────┐
│       ⚡ QODER ONE-CLICK SETUP ⚡            │
│   Multi-Account • Auto-Retry • Siap Pakai    │
└──────────────────────────────────────────────┘${c.r}`);
}

async function clickBtn(page, ...texts) {
  for (const btn of await page.$$('button')) {
    const t = (await page.evaluate(el => el.textContent, btn)).trim().toLowerCase();
    const dis = await page.evaluate(el => el.disabled, btn);
    const vis = await page.evaluate(el => el.offsetParent !== null, btn);
    if (dis || !vis) continue;
    if (texts.some(x => t.includes(x.toLowerCase()))) {
      await btn.scrollIntoViewIfNeeded(); await sleep(400); await btn.click(); return true;
    }
  }
  return false;
}

function loadAccounts() {
  const f = path.join(process.cwd(), 'accounts.txt');
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf-8').split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => { const [e, p] = l.split('|').map(s => s.trim()); return { email: e, password: p }; })
    .filter(a => a.email && a.password);
}

// ── Login single account ───────────────────────────────────
// Returns: { success: bool, email: string, error?: string }

async function loginAccount(account, accountNum, totalAccounts) {
  const tag = `[${accountNum}/${totalAccounts}]`;
  console.log(`\n${c.mag}${c.b}  ════════════════════════════════════════════${c.r}`);
  console.log(`${c.mag}${c.b}  ${tag} ${account.email}${c.r}`);
  console.log(`${c.mag}${c.b}  ════════════════════════════════════════════${c.r}`);

  // Start CLI login
  info('Starting CLI login...');
  const cliProc = spawn('qodercli', ['login'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PATH: PATH_STR }
  });

  let loginUrl = '';
  let loginSuccess = false;

  cliProc.stdout.on('data', d => {
    const t = d.toString();
    const m = t.match(/https:\/\/qoder\.com\/device\/selectAccounts\?[^\s]+/);
    if (m) loginUrl = m[0];
    if (t.includes('Login successful')) {
      loginSuccess = true;
      console.log(`\n  ${c.grn}${c.b}🎉 ${t.trim()}${c.r}`);
    }
  });
  cliProc.stderr.on('data', d => process.stdout.write(`${c.d}${d}${c.r}`));

  // Wait for URL
  info('Waiting for login URL...');
  for (let i = 0; i < 30; i++) { await sleep(500); if (loginUrl) break; }
  if (!loginUrl) {
    err('Failed to get login URL');
    cliProc.kill();
    return { success: false, email: account.email, error: 'No login URL' };
  }
  ok('Got login URL');

  // Browser OAuth
  info('Opening browser...');
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: `${HOME}/.local/chrome/chrome`,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
  } catch (e) {
    err(`Browser launch failed: ${e.message}`);
    cliProc.kill();
    return { success: false, email: account.email, error: 'Browser launch failed' };
  }

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  let errorMsg = '';

  try {
    // Open device auth page
    await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    // Click Google
    info('Selecting Google login...');
    const gl = await page.$('a[href*="sso/login/google"]');
    if (gl) await gl.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await sleep(3000);

    // Check for "Couldn't find account"
    let bodyText = await page.$eval('body', el => el.innerText).catch(() => '');
    if (bodyText.includes("Couldn't find") || bodyText.includes("couldn't find your Google Account")) {
      errorMsg = 'Account not found on Google';
      throw new Error(errorMsg);
    }

    // Email
    info('Entering email...');
    let inp;
    try { inp = await page.waitForSelector('input[type="email"]', { timeout: 5000 }); }
    catch { inp = await page.waitForSelector('input[type="text"]', { timeout: 10000 }); }
    await inp.click({ clickCount: 3 });
    await inp.type(account.email, { delay: 60 });
    await sleep(1000);
    await page.keyboard.press('Enter');
    await sleep(5000);

    // Check error after email
    bodyText = await page.$eval('body', el => el.innerText).catch(() => '');
    if (bodyText.includes("Couldn't find") || bodyText.includes("couldn't find your Google Account")) {
      errorMsg = 'Account not found on Google';
      throw new Error(errorMsg);
    }

    // Password
    info('Entering password...');
    const pwd = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await pwd.click({ clickCount: 3 });
    await pwd.type(account.password, { delay: 60 });
    await sleep(1000);
    await page.keyboard.press('Enter');
    await sleep(5000);

    // Consent / Speedbump loop
    info('Handling consent & terms...');
    let lastUrl = '';
    let stuckCount = 0;

    for (let i = 0; i < 15; i++) {
      await sleep(2000);
      const url = page.url();

      // Detect stuck loop
      if (url === lastUrl) {
        stuckCount++;
        if (stuckCount >= 3) {
          errorMsg = 'Stuck on same page after 3 attempts';
          break;
        }
      } else {
        stuckCount = 0;
        lastUrl = url;
      }

      // Success
      if (url.includes('qoder.com') && !url.includes('sign-in') && !url.includes('selectAccounts')) {
        break;
      }

      // Device select
      if (url.includes('selectAccounts') || url.includes('device/select')) {
        await clickBtn(page, 'continue', 'select', 'lanjutkan', 'confirm');
        await sleep(3000); continue;
      }

      // OAuth consent
      if (url.includes('oauth/id') || url.includes('consent') || url.includes('signin/oauth')) {
        await clickBtn(page, 'lanjutkan', 'continue', 'allow', 'accept', 'confirm');
        await sleep(3000); continue;
      }

      // Workspace terms
      if (url.includes('speedbump') || url.includes('workspacetermsofservice')) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await sleep(1000);
        await clickBtn(page, 'i understand', 'understand', 'next', 'continue', 'review');
        await sleep(3000); continue;
      }

      // Password re-entry
      if (url.includes('challenge/pwd')) {
        const p2 = await page.$('input[type="password"]');
        if (p2) {
          await p2.click({ clickCount: 3 });
          await p2.type(account.password, { delay: 60 });
          await sleep(500);
          await page.keyboard.press('Enter');
          await sleep(5000);
        }
        continue;
      }

      // 2FA
      if (url.includes('challenge/') && !url.includes('challenge/pwd')) {
        warn('2FA detected! Approve on your phone within 60s...');
        let resolved = false;
        for (let j = 0; j < 12; j++) {
          await sleep(5000);
          const u = page.url();
          if (!u.includes('challenge/') || u.includes('qoder.com')) { resolved = true; break; }
          process.stdout.write('.');
        }
        console.log('');
        if (!resolved) { errorMsg = '2FA timeout - not approved'; break; }
        continue;
      }

      // Error page
      bodyText = await page.$eval('body', el => el.innerText).catch(() => '');
      if (bodyText.includes('500') || bodyText.includes('error')) {
        info('Error page, reloading...');
        await sleep(3000);
        await page.reload({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        continue;
      }

      // Unknown
      break;
    }
  } catch (e) {
    errorMsg = e.message;
  }

  await browser.close();

  // Wait for CLI
  info('Waiting for CLI...');
  await Promise.race([
    new Promise(r => cliProc.on('close', r)),
    sleep(15000)
  ]);
  cliProc.kill();
  await sleep(2000);

  // Verify
  const status = run('qodercli status');
  if (status && !status.includes('Not logged in') && loginSuccess) {
    ok(`LOGIN SUCCESS! ✅`);
    return { success: true, email: account.email };
  }

  if (!errorMsg) errorMsg = 'CLI did not confirm login';
  err(`FAILED: ${errorMsg}`);
  return { success: false, email: account.email, error: errorMsg };
}

// ── Main Flow ───────────────────────────────────────────────

async function oneClickSetup() {
  banner();

  // Step 1: Check CLI
  step(1, 'Checking Qoder CLI...', 7);
  let cliVer = run('qodercli --version');
  if (!cliVer) {
    info('Installing Qoder CLI...');
    run('curl -fsSL https://qoder.com/install | bash', 60000);
    cliVer = run('qodercli --version');
    if (!cliVer) { err('CLI install failed!'); return; }
  }
  ok(`Qoder CLI ${cliVer}`);

  // Step 2: Load accounts
  step(2, 'Loading accounts...', 7);
  let accounts = loadAccounts();

  if (accounts.length === 0) {
    warn('No accounts.txt found');
    info('Create accounts.txt: email|password (one per line)');
    const { email, password } = await inquirer.prompt([
      { type: 'input',  name: 'email',    message: 'Google Email:' },
      { type: 'password', name: 'password', message: 'Password:' }
    ]);
    fs.writeFileSync('accounts.txt', `# Qoder Accounts\n${email}|${password}\n`);
    accounts = [{ email, password }];
  }

  ok(`Found ${c.b}${accounts.length}${c.r} account(s):`);
  accounts.forEach((a, i) => console.log(`     ${i + 1}. ${a.email}`));

  // Confirm
  if (accounts.length > 1) {
    const { proceed } = await inquirer.prompt([{
      type: 'confirm', name: 'proceed',
      message: `Process all ${accounts.length} accounts?`,
      default: true
    }]);
    if (!proceed) {
      const { sel } = await inquirer.prompt([{
        type: 'list', name: 'sel', message: 'Select account:',
        choices: accounts.map(a => ({ name: a.email, value: a }))
      }]);
      accounts = [sel];
    }
  }

  // Step 3-6: Process each account
  const results = [];
  const totalSteps = accounts.length * 4 + 3; // 4 steps per account + 3 setup steps
  let currentStep = 2;

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    let success = false;

    // Retry loop
    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      if (attempt > 1) {
        warn(`Retry ${attempt}/${MAX_RETRY} for ${account.email}...`);
        await sleep(3000); // Wait before retry
      }

      const result = await loginAccount(account, i + 1, accounts.length);
      
      if (result.success) {
        success = true;
        results.push({ email: account.email, status: '✅ SUCCESS' });
        break;
      }

      if (attempt < MAX_RETRY) {
        warn(`Attempt ${attempt} failed: ${result.error}`);
        info(`Will retry in 5s...`);
        await sleep(5000);
      } else {
        results.push({ email: account.email, status: `❌ FAILED (${result.error})` });
      }
    }

    // If success and single account, show result
    if (success && accounts.length === 1) {
      await showResult();
      return;
    }
  }

  // Step 7: Summary
  step(7, 'SUMMARY', 7);
  console.log('');
  console.log(`  ${c.b}┌────────────────────────────────────────────┐${c.r}`);
  console.log(`  ${c.b}│           LOGIN RESULTS                    │${c.r}`);
  console.log(`  ${c.b}├────────────────────────────────────────────┤${c.r}`);
  
  const successCount = results.filter(r => r.status.includes('SUCCESS')).length;
  const failCount = results.filter(r => r.status.includes('FAILED')).length;
  
  results.forEach(r => {
    const color = r.status.includes('SUCCESS') ? c.grn : c.red;
    console.log(`  ${c.b}│${c.r}  ${color}${r.status.padEnd(10)}${c.r} ${r.email.padEnd(28)} ${c.b}│${c.r}`);
  });
  
  console.log(`  ${c.b}├────────────────────────────────────────────┤${c.r}`);
  console.log(`  ${c.b}│${c.r}  ${c.grn}✅ ${successCount} success${c.r}  ${c.red}❌ ${failCount} failed${c.r}              ${c.b}│${c.r}`);
  console.log(`  ${c.b}└────────────────────────────────────────────┘${c.r}`);

  if (successCount > 0) {
    await showResult();
  }
}

async function showResult() {
  console.log('');
  const status = run('qodercli status');
  if (status) console.log(status);

  const models = run('qodercli --list-models');
  if (models) console.log(`\n  Models: ${c.grn}${models}${c.r}`);

  const now = Date.now();
  const promoEnd = new Date('2026-09-03T23:59:59+08:00').getTime();
  const daysLeft = Math.ceil((promoEnd - now) / 86400000);

  console.log(`
${c.cyn}┌──────────────────────────────────────────────┐
│${c.r}  ${c.grn}${c.b}✅ QODER SIAP PAKAI!${c.r}                       ${c.cyn}│
├──────────────────────────────────────────────┤${c.r}
│                                              │
│  🎁 Claim 800 Free Calls:                    │
│     ${c.blu}https://qoder.com/account/usage${c.r}          │
│                                              │
│  ⏰ Promo: ${c.b}${daysLeft} hari lagi${c.r} (s/d 3 Sep 2026)   │
│                                              │
│  🧪 Test: qodercli -p -m "Qwen3.8-Max" "Hi" │
│                                              │
│  💡 Off-peak 10pm-8am: 50% OFF!              │
│                                              │
${c.cyn}└──────────────────────────────────────────────┘${c.r}`);
}

// ── Start ───────────────────────────────────────────────────

(async () => {
  console.clear();

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'Pilih:',
    choices: [
      { name: '🚀 Login & Siap Pakai (One-Click, All Accounts)', value: 'setup' },
      { name: '📊 Cek Status', value: 'status' },
      { name: '🧪 Test Qwen3.8-Max', value: 'test' },
      { name: '❌ Keluar', value: 'exit' }
    ]
  }]);

  switch (action) {
    case 'setup':
      await oneClickSetup();
      break;
    case 'status':
      console.log('\n' + (run('qodercli status') || 'Not logged in'));
      const models = run('qodercli --list-models');
      if (models) console.log('\nModels: ' + models);
      break;
    case 'test': {
      const s = run('qodercli status');
      if (!s || s.includes('Not logged in')) { err('Not logged in!'); break; }
      const { prompt } = await inquirer.prompt([{ type: 'input', name: 'prompt', message: 'Prompt:', default: 'Hello! What model are you?' }]);
      console.log(`\n${c.cyn}────────────────────────────${c.r}`);
      const r = run(`qodercli -p -m "Qwen3.8-Max" "${prompt.replace(/"/g, '\\"')}"`, 60000);
      console.log(r || 'No response');
      console.log(`${c.cyn}────────────────────────────${c.r}`);
      break;
    }
    case 'exit':
      console.log(`\n${c.cyn}Bye! 👋${c.r}\n`);
  }
})();
