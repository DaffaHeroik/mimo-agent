#!/usr/bin/env node
// ============================================================
//  All-In-One Setup — Qoder + Ollama
//  1 proses → 2 output terpisah
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

const c = {
  r: '\x1b[0m', b: '\x1b[1m', d: '\x1b[2m',
  red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m',
  blu: '\x1b[34m', cyn: '\x1b[36m', mag: '\x1b[35m',
};

function run(cmd, t = 15000) {
  try { return execSync(cmd, { env: { ...process.env, PATH: PATH_STR }, encoding: 'utf-8', timeout: t }).trim(); }
  catch { return null; }
}

function ok(m)   { console.log(`  ${c.grn}✔${c.r} ${m}`); }
function err(m)  { console.log(`  ${c.red}✘${c.r} ${m}`); }
function info(m) { console.log(`  ${c.blu}ℹ${c.r} ${m}`); }
function warn(m) { console.log(`  ${c.yel}⚠${c.r} ${m}`); }

function banner(title, color) {
  console.log(`\n${color}${c.b}┌──────────────────────────────────────────────┐`);
  console.log(`│  ${title.padEnd(44)}│`);
  console.log(`└──────────────────────────────────────────────┘${c.r}`);
}

async function clickBtn(page, ...texts) {
  return page.evaluate((texts) => {
    const btns = document.querySelectorAll('button, a, div[role="button"]');
    for (const b of btns) {
      const t = (b.textContent || '').trim().toLowerCase();
      if (texts.some(x => t.includes(x.toLowerCase()))) { b.click(); return t; }
    }
    return null;
  }, texts);
}

function loadAccounts() {
  const f = path.join(process.cwd(), 'accounts.txt');
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf-8').split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => { const [e, p] = l.split('|').map(s => s.trim()); return { email: e, password: p }; })
    .filter(a => a.email && a.password);
}

// ============================================================
//  QODER SETUP
// ============================================================
async function setupQoder(accounts) {
  banner('QODER SETUP', c.cyn);

  // Check CLI
  info('Checking Qoder CLI...');
  let cliVer = run('qodercli --version');
  if (!cliVer) {
    info('Installing...');
    run('curl -fsSL https://qoder.com/install | bash', 60000);
    cliVer = run('qodercli --version');
    if (!cliVer) { err('CLI install failed'); return null; }
  }
  ok(`Qoder CLI ${cliVer}`);

  // Check login
  let status = run('qodercli status');
  if (status && !status.includes('Not logged in')) {
    const email = status.match(/Email:\s*(.+)/)?.[1] || 'unknown';
    ok(`Already logged in: ${email}`);
    return { status: 'already_logged_in', email };
  }

  // Login
  if (accounts.length === 0) {
    warn('No accounts.txt — skipping Qoder login');
    return null;
  }

  const account = accounts[0];
  info(`Logging in as ${account.email}...`);

  // Start CLI login
  const cliProc = spawn('qodercli', ['login'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PATH: PATH_STR }
  });

  let loginUrl = '';
  cliProc.stdout.on('data', d => {
    const m = d.toString().match(/https:\/\/qoder\.com\/device\/selectAccounts\?[^\s]+/);
    if (m) loginUrl = m[0];
    if (d.toString().includes('Login successful')) ok('CLI: Login successful!');
  });

  for (let i = 0; i < 20; i++) { await sleep(500); if (loginUrl) break; }
  if (!loginUrl) { err('No login URL'); cliProc.kill(); return null; }

  // Browser OAuth
  const browser = await puppeteer.launch({
    executablePath: `${HOME}/.local/chrome/chrome`,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    // Google
    info('Google login...');
    const links = await page.$$('a');
    for (const link of links) {
      const text = await page.evaluate(el => el.textContent.trim(), link);
      if (text.includes('Google')) { await link.click(); break; }
    }
    await sleep(8000);

    // Email
    let inp;
    try { inp = await page.waitForSelector('input[type="email"]', { timeout: 5000 }); }
    catch { inp = await page.$('input[type="text"]'); }
    if (inp) {
      await inp.click({ clickCount: 3 });
      await inp.type(account.email, { delay: 60 });
      await sleep(1000);
      await clickBtn(page, 'next');
      await sleep(5000);
    }

    // Password
    try {
      const pwd = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
      await pwd.click({ clickCount: 3 });
      await pwd.type(account.password, { delay: 60 });
      await sleep(1000);
      await clickBtn(page, 'next');
      await sleep(10000);
    } catch (e) {}

    // Consent
    for (let i = 0; i < 8; i++) {
      await sleep(2000);
      const url = page.url();
      if (url.includes('qoder.com') && !url.includes('sign-in')) break;
      if (url.includes('oauth') || url.includes('consent')) {
        await clickBtn(page, 'lanjutkan', 'continue', 'allow', 'accept');
        await sleep(3000); continue;
      }
      if (url.includes('speedbump') || url.includes('workspacetermsofservice')) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await sleep(1000);
        await clickBtn(page, 'i understand', 'next', 'continue');
        await sleep(3000); continue;
      }
      break;
    }
  } catch (e) {
    err(`Qoder browser error: ${e.message}`);
  }

  await browser.close();
  await Promise.race([new Promise(r => cliProc.on('close', r)), sleep(15000)]);
  cliProc.kill();
  await sleep(2000);

  status = run('qodercli status');
  if (status && !status.includes('Not logged in')) {
    ok('Qoder LOGIN SUCCESS!');
    return { status: 'success', email: account.email };
  }

  err('Qoder login failed');
  return null;
}

// ============================================================
//  OLLAMA SETUP
// ============================================================
async function setupOllama(accounts) {
  banner('OLLAMA SETUP', c.mag);

  const browser = await puppeteer.launch({
    executablePath: `${HOME}/.local/chrome/chrome`,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  let apiKey = null;

  try {
    // Login
    info('Opening Ollama...');
    await page.goto('https://ollama.com/signin', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    info('Google login...');
    await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const l of links) { if (l.href.includes('Google')) { l.click(); return; } }
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await sleep(5000);

    // Email
    info('Email...');
    await page.focus('#identifierId').catch(() => page.focus('input[type="text"]').catch(() => {}));
    await sleep(300);
    await page.keyboard.type('respati1@bozztirex.us', { delay: 80 });
    await sleep(1000);
    await page.keyboard.press('Enter');
    await sleep(6000);

    // Password
    info('Password...');
    await page.focus('input[type="password"]').catch(() => {});
    await sleep(300);
    await page.keyboard.type('Daffa112233', { delay: 80 });
    await sleep(1000);
    await page.keyboard.press('Enter');
    await sleep(10000);

    // Consent
    for (let i = 0; i < 8; i++) {
      await sleep(3000);
      const url = page.url();
      if (url.includes('ollama.com') && !url.includes('signin') && !url.includes('auth')) {
        ok('Ollama LOGIN SUCCESS!');
        break;
      }
      if (url.includes('accounts.google.com')) {
        await clickBtn(page, 'lanjutkan', 'continue', 'allow');
        continue;
      }
      if (url.includes('speedbump')) {
        await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
        await sleep(1000);
        await clickBtn(page, 'i understand', 'next', 'continue');
        continue;
      }
      break;
    }

    // Get API key
    info('Getting API key...');
    await page.goto('https://ollama.com/settings/keys', { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(3000);

    // Click Add API Key
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) { if (b.textContent.includes('Add API Key')) { b.click(); return; } }
    });
    await sleep(2000);

    // Click Generate
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) { if (b.textContent.includes('Generate')) { b.click(); return; } }
    });
    await sleep(5000);

    // Extract key from hidden input
    apiKey = await page.evaluate(() => {
      const inp = document.querySelector('input[name="api-key-string"]');
      return inp ? inp.value : null;
    });

    if (apiKey) {
      ok(`API Key: ${apiKey.substring(0, 20)}...`);
      fs.writeFileSync('ollama-key.txt', `Ollama API Key\nAccount: respati1@bozztirex.us\nKey: ${apiKey}\n\nUsage:\ncurl -X POST "https://ollama.com/api/chat" \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": "gpt-oss:20b", "messages": [{"role": "user", "content": "Hello"}], "stream": false}'\n`);
      ok('Saved to ollama-key.txt');

      // Test API
      info('Testing API...');
      const testResult = run(`curl -sL -X POST "https://ollama.com/api/chat" -H "Authorization: Bearer ${apiKey}" -H "Content-Type: application/json" -d '{"model": "gpt-oss:20b", "messages": [{"role": "user", "content": "Hello! Reply briefly."}], "stream": false}'`, 30000);
      if (testResult) {
        try {
          const parsed = JSON.parse(testResult);
          if (parsed.message?.content) {
            ok(`API Test: "${parsed.message.content.substring(0, 80)}..."`);
          } else if (parsed.error) {
            warn(`API Error: ${parsed.error}`);
          }
        } catch {}
      }
    } else {
      warn('Could not extract API key');
    }

  } catch (e) {
    err(`Ollama error: ${e.message}`);
  }

  await browser.close();
  return { apiKey, status: apiKey ? 'success' : 'failed' };
}

// ============================================================
//  RESULTS
// ============================================================
function showResults(qoderResult, ollamaResult) {
  banner('RESULTS', c.grn);

  console.log(`  ${c.b}┌────────────────────────────────────────────┐${c.r}`);
  console.log(`  ${c.b}│           SETUP RESULTS                    │${c.r}`);
  console.log(`  ${c.b}├────────────────────────────────────────────┤${c.r}`);

  // Qoder
  const qStatus = qoderResult?.status === 'success' ? `${c.grn}✅ SUCCESS${c.r}` :
                  qoderResult?.status === 'already_logged_in' ? `${c.grn}✅ ALREADY LOGGED IN${c.r}` :
                  `${c.red}❌ FAILED${c.r}`;
  const qEmail = qoderResult?.email || 'N/A';
  console.log(`  ${c.b}│${c.r}  QODER   ${qStatus}`);
  console.log(`  ${c.b}│${c.r}  Account: ${qEmail}`);

  // Ollama
  const oStatus = ollamaResult?.status === 'success' ? `${c.grn}✅ SUCCESS${c.r}` :
                  `${c.red}❌ FAILED${c.r}`;
  const oKey = ollamaResult?.apiKey ? `${ollamaResult.apiKey.substring(0, 20)}...` : 'N/A';
  console.log(`  ${c.b}│${c.r}`);
  console.log(`  ${c.b}│${c.r}  OLLAMA  ${oStatus}`);
  console.log(`  ${c.b}│${c.r}  API Key: ${oKey}`);

  console.log(`  ${c.b}├────────────────────────────────────────────┤${c.r}`);
  console.log(`  ${c.b}│${c.r}  Files:`);
  console.log(`  ${c.b}│${c.r}    accounts.txt   — Qoder accounts`);
  console.log(`  ${c.b}│${c.r}    ollama-key.txt — Ollama API key`);
  console.log(`  ${c.b}└────────────────────────────────────────────┘${c.r}`);

  // Promo info
  const now = Date.now();
  const promoEnd = new Date('2026-09-03T23:59:59+08:00').getTime();
  const daysLeft = Math.ceil((promoEnd - now) / 86400000);

  console.log(`
${c.cyn}┌──────────────────────────────────────────────┐
│${c.r}  ${c.grn}${c.b}✅ SETUP COMPLETE!${c.r}                          ${c.cyn}│
├──────────────────────────────────────────────┤${c.r}
│                                              │
│  QODER:                                      │
│  🎁 Claim 800 Free Calls:                    │
│     ${c.blu}https://qoder.com/account/usage${c.r}          │
│  ⏰ Promo: ${c.b}${daysLeft} hari lagi${c.r} (s/d 3 Sep 2026)   │
│  🧪 Test: qodercli -p "Hello"               │
│                                              │
│  OLLAMA:                                     │
│  📋 Models: 18 available                     │
│  🆓 Free: gpt-oss:20b, gpt-oss:120b,        │
│           gemma4:31b, nemotron-3-super, dll  │
│  💡 Off-peak Qoder: 10pm-8am 50% OFF!       │
│                                              │
${c.cyn}└──────────────────────────────────────────────┘${c.r}`);
}

// ============================================================
//  MAIN
// ============================================================
(async () => {
  console.clear();
  console.log(`
${c.cyn}${c.b}┌──────────────────────────────────────────────┐
│     ⚡ ALL-IN-ONE SETUP ⚡                   │
│     Qoder + Ollama — 1 proses, 2 output      │
└──────────────────────────────────────────────┘${c.r}`);

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'Pilih:',
    choices: [
      { name: '🚀 Setup All (Qoder + Ollama)', value: 'all' },
      { name: '⚡ Qoder Only', value: 'qoder' },
      { name: '🦙 Ollama Only', value: 'ollama' },
      { name: '📊 Check Status', value: 'status' },
      { name: '❌ Keluar', value: 'exit' }
    ]
  }]);

  if (action === 'exit') {
    console.log(`\n${c.cyn}Bye! 👋${c.r}\n`);
    return;
  }

  if (action === 'status') {
    banner('STATUS', c.yel);
    const qStatus = run('qodercli status');
    console.log('QODER:', qStatus || 'Not installed/logged in');
    console.log('');
    const oKey = fs.existsSync('ollama-key.txt') ? fs.readFileSync('ollama-key.txt', 'utf-8').match(/Key: (.+)/)?.[1] : null;
    console.log('OLLAMA:', oKey ? `API Key: ${oKey.substring(0, 20)}...` : 'No API key found');
    return;
  }

  const accounts = loadAccounts();

  let qoderResult = null;
  let ollamaResult = null;

  if (action === 'all' || action === 'qoder') {
    qoderResult = await setupQoder(accounts);
  }

  if (action === 'all' || action === 'ollama') {
    ollamaResult = await setupOllama(accounts);
  }

  showResults(qoderResult, ollamaResult);
})();
