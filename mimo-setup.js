#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  MIMO AGENT — All-In-One Setup & Manager
//  Qoder CLI • Ollama Cloud • Cline CLI • Desktop • Claim
//  Version: 2.0.0
// ═══════════════════════════════════════════════════════════════

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ── Module Loader (handles both local & global installs) ─────
function loadModule(name) {
  const paths = [
    path.join(__dirname, 'node_modules', name),
    path.join(process.env.HOME, '.openclaw', 'tmp', 'node_modules', name),
    name,
  ];
  for (const p of paths) {
    try {
      const mod = require(p);
      // Handle ESM-style default exports (inquirer v14+)
      if (mod && mod.__esModule && mod.default) return mod.default;
      return mod;
    } catch {}
  }
  throw new Error(`Module "${name}" not found. Run: npm install`);
}

// ── Constants ────────────────────────────────────────────────
const HOME = process.env.HOME;
const WORKDIR = __dirname;
const PATH_STR = `${HOME}/.local/bin:${process.env.PATH}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Auto-detect Chrome
function findChrome() {
  const candidates = [
    `${HOME}/.cache/puppeteer/chrome/linux-151.0.7922.71/chrome-linux64/chrome`,
    `${HOME}/.local/chrome/chrome`,
    '/opt/ms-playwright/chromium-1228/chrome-linux64/chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ];
  for (const c of candidates) { if (fs.existsSync(c)) return c; }
  // Try find
  try { return execSync('which chromium || which google-chrome || which chrome', { encoding: 'utf-8', timeout: 5000 }).trim(); } catch {}
  return null;
}

const CHROME_PATH = findChrome();

// ── Colors & UI ──────────────────────────────────────────────
const c = {
  r: '\x1b[0m', b: '\x1b[1m', d: '\x1b[2m', ital: '\x1b[3m',
  red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m',
  blu: '\x1b[34m', cyn: '\x1b[36m', mag: '\x1b[35m', wht: '\x1b[37m',
  bgB: '\x1b[44m', bgG: '\x1b[42m', bgR: '\x1b[41m', bgY: '\x1b[43m',
  bgC: '\x1b[46m', bgM: '\x1b[45m',
};

function ok(m)   { console.log(`  ${c.grn}✔${c.r} ${m}`); }
function err(m)  { console.log(`  ${c.red}✘${c.r} ${m}`); }
function info(m) { console.log(`  ${c.blu}ℹ${c.r} ${m}`); }
function warn(m) { console.log(`  ${c.yel}⚠${c.r} ${m}`); }
function step(n, m, max) { console.log(`\n  ${c.cyn}${c.b}[${n}/${max}]${c.r} ${c.b}${m}${c.r}`); }

function banner(title, color = c.cyn) {
  const w = 52;
  const pad = w - title.length - 2;
  console.log(`\n${color}${c.b}┌${'─'.repeat(w)}┐`);
  console.log(`│ ${title}${' '.repeat(Math.max(0, pad))}│`);
  console.log(`└${'─'.repeat(w)}┘${c.r}`);
}

function divider() { console.log(`  ${c.d}${'─'.repeat(50)}${c.r}`); }

const LOGO = `
${c.cyn}${c.b}  ╔══════════════════════════════════════════════════╗
  ║                                                  ║
  ║   ███╗   ███╗ ██╗ ███╗   ███╗  ██████╗          ║
  ║   ████╗ ████║ ██║ ████╗ ████║ ██╔═══██╗         ║
  ║   ██╔████╔██║ ██║ ██╔████╔██║ ██║   ██║         ║
  ║   ██║╚██╔╝██║ ██║ ██║╚██╔╝██║ ██║   ██║         ║
  ║   ██║ ╚═╝ ██║ ██║ ██║ ╚═╝ ██║ ╚██████╔╝         ║
  ║   ╚═╝     ╚═╝ ╚═╝ ╚═╝     ╚═╝  ╚═════╝          ║
  ║                                                  ║
  ║     ⚡  ALL-IN-ONE SETUP & MANAGER  ⚡           ║
  ║     v2.0 — Qoder • Ollama • Cline • Desktop     ║
  ║                                                  ║
  ╚══════════════════════════════════════════════════╝${c.r}
`;

// ── Helpers ──────────────────────────────────────────────────
function run(cmd, timeout = 15000) {
  try {
    return execSync(cmd, {
      env: { ...process.env, PATH: PATH_STR },
      encoding: 'utf-8', timeout, stdio: 'pipe'
    }).trim();
  } catch { return null; }
}

function runAsync(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: PATH_STR },
      ...opts
    });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
    setTimeout(() => {
      try { proc.kill(); } catch {}
      resolve({ code: -1, stdout: stdout.trim(), stderr: stderr.trim() });
    }, opts.timeout || 30000);
  });
}

function loadAccounts() {
  const f = path.join(WORKDIR, 'accounts.txt');
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf-8').split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => { const [e, p] = l.split('|').map(s => s.trim()); return { email: e, password: p }; })
    .filter(a => a.email && a.password);
}

function saveAccount(email, password) {
  const f = path.join(WORKDIR, 'accounts.txt');
  const existing = fs.existsSync(f) ? fs.readFileSync(f, 'utf-8').trim() : '# Qoder Accounts';
  const entry = `${email}|${password}`;
  if (existing.includes(entry)) return;
  fs.writeFileSync(f, `${existing}\n${entry}\n`);
}

async function clickBtn(page, ...texts) {
  for (const btn of await page.$$('button')) {
    const t = (await page.evaluate(el => el.textContent, btn)).trim().toLowerCase();
    const dis = await page.evaluate(el => el.disabled, btn);
    const vis = await page.evaluate(el => el.offsetParent !== null, btn);
    if (dis || !vis) continue;
    if (texts.some(x => t.includes(x.toLowerCase()))) {
      await btn.scrollIntoViewIfNeeded();
      await sleep(400);
      await btn.click();
      return true;
    }
  }
  return false;
}

async function launchBrowser() {
  const puppeteer = loadModule('puppeteer-extra');
  const StealthPlugin = loadModule('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());

  if (!CHROME_PATH) throw new Error('Chrome not found! Install chromium or google-chrome');

  return puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
           '--disable-extensions', '--disable-background-networking', '--window-size=1280,900']
  });
}

// ── Google OAuth Helper ──────────────────────────────────────
async function googleOAuth(page, email, password) {
  // Email
  let inp;
  try { inp = await page.waitForSelector('#identifierId', { timeout: 8000 }); }
  catch { try { inp = await page.waitForSelector('input[type="email"]', { timeout: 5000 }); }
  catch { inp = await page.waitForSelector('input[type="text"]', { timeout: 5000 }); } }
  if (inp) {
    await inp.click({ clickCount: 3 });
    await inp.type(email, { delay: 50 });
    await sleep(800);
    await page.keyboard.press('Enter');
    await sleep(5000);
  }

  // Check for "Couldn't find account"
  const bodyText = await page.$eval('body', el => el.innerText).catch(() => '');
  if (bodyText.includes("Couldn't find") || bodyText.includes("couldn't find")) {
    throw new Error('Google account not found');
  }

  // Password
  let pwd;
  try { pwd = await page.waitForSelector('input[type="password"]', { timeout: 10000 }); } catch {}
  if (pwd) {
    await pwd.click({ clickCount: 3 });
    await pwd.type(password, { delay: 50 });
    await sleep(800);
    await page.keyboard.press('Enter');
    await sleep(6000);
  }

  // Consent / Speedbump / 2FA loop
  for (let i = 0; i < 15; i++) {
    await sleep(2000);
    const url = page.url();

    if (url.includes('speedbump') || url.includes('workspacetermsofservice')) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(1000);
      await clickBtn(page, 'i understand', 'understand', 'next', 'continue', 'review');
      await sleep(3000);
      continue;
    }
    if (url.includes('consent') || url.includes('oauth') || url.includes('accounts.google.com')) {
      await clickBtn(page, 'lanjutkan', 'continue', 'allow', 'accept', 'confirm');
      await sleep(3000);
      continue;
    }
    if (url.includes('challenge/pwd')) {
      const p2 = await page.$('input[type="password"]');
      if (p2) {
        await p2.click({ clickCount: 3 });
        await p2.type(password, { delay: 50 });
        await sleep(500);
        await page.keyboard.press('Enter');
        await sleep(5000);
      }
      continue;
    }
    if (url.includes('challenge/') && !url.includes('challenge/pwd')) {
      warn('2FA detected! Approve on your phone within 60s...');
      for (let j = 0; j < 12; j++) {
        await sleep(5000);
        const u = page.url();
        if (!u.includes('challenge/')) break;
        process.stdout.write('.');
      }
      console.log('');
      continue;
    }
    break;
  }
}

// ═══════════════════════════════════════════════════════════════
//  STATUS DASHBOARD
// ═══════════════════════════════════════════════════════════════

async function showDashboard() {
  banner('📊 STATUS DASHBOARD', c.blu);

  // Qoder CLI
  const cliVer = run('qodercli --version');
  const cliStatus = run('qodercli status');
  const cliLoggedIn = cliStatus && !cliStatus.includes('Not logged in');
  const cliEmail = cliStatus?.match(/Email:\s*(.+)/)?.[1] || '';

  // Ollama (multi-account keys)
  const allKeys = loadKeys();
  const keyCount = Object.keys(allKeys).length;
  let ollamaOk = false;
  let ollamaDetail = 'No keys';
  if (keyCount > 0) {
    // Test first key
    const firstKey = Object.values(allKeys)[0];
    const test = run(`curl -sL -m 10 -X POST "https://ollama.com/api/chat" -H "Authorization: Bearer ${firstKey}" -H "Content-Type: application/json" -d '{"model":"gpt-oss:20b","messages":[{"role":"user","content":"ok"}],"stream":false}'`, 15000);
    ollamaOk = test && test.includes('message');
    ollamaDetail = ollamaOk ? `${keyCount} key(s) aktif` : `${keyCount} key(s) (test gagal)`;
  }

  // Cline
  const clineBin = path.join(WORKDIR, 'node_modules', '.bin', 'cline');
  const clineVer = fs.existsSync(clineBin) ? run(`node "${clineBin}" --version`, 10000) : null;

  // Desktop
  const qoderBin = '/tmp/qoder-desktop/usr/share/qoder/qoder';
  const desktopOk = fs.existsSync(qoderBin);
  const xvfbOk = !!run('pgrep Xvfb');

  // Promo
  const now = Date.now();
  const promoEnd = new Date('2026-09-03T23:59:59+08:00').getTime();
  const daysLeft = Math.ceil((promoEnd - now) / 86400000);

  // Display
  const items = [
    { name: 'Qoder CLI', status: !!cliVer, detail: cliVer ? `v${cliVer}` : 'Not installed' },
    { name: 'Qoder Login', status: cliLoggedIn, detail: cliEmail || 'Not logged in' },
    { name: 'Ollama Cloud API', status: ollamaOk, detail: ollamaDetail },
    { name: 'Cline CLI', status: !!clineVer, detail: clineVer || 'Not installed' },
    { name: 'Qoder Desktop', status: desktopOk, detail: desktopOk ? 'Installed' : 'Not installed' },
    { name: 'Xvfb', status: xvfbOk, detail: xvfbOk ? 'Running :99' : 'Not running' },
    { name: 'Chrome', status: !!CHROME_PATH, detail: CHROME_PATH ? path.basename(CHROME_PATH) : 'NOT FOUND' },
  ];

  console.log(`  ${c.b}┌────────────────────────────────────────────────┐${c.r}`);
  for (const item of items) {
    const icon = item.status ? `${c.grn}✅${c.r}` : `${c.red}❌${c.r}`;
    console.log(`  ${c.b}│${c.r} ${icon} ${item.name.padEnd(20)} ${c.d}${item.detail}${c.r}`);
  }
  console.log(`  ${c.b}└────────────────────────────────────────────────┘${c.r}`);

  if (daysLeft > 0) {
    console.log(`\n  ${c.yel}⏰ Qwen3.8-Max Promo: ${c.b}${daysLeft} hari lagi${c.r} (s/d 3 Sep 2026)`);
  }

  return { cliVer, cliLoggedIn, ollamaOk, clineVer, desktopOk, xvfbOk };
}

// ═══════════════════════════════════════════════════════════════
//  1. QODER CLI — Install & Login
// ═══════════════════════════════════════════════════════════════

async function installQoderCli() {
  banner('1. QODER CLI — Install', c.cyn);

  let ver = run('qodercli --version');
  if (ver) {
    ok(`Already installed: v${ver}`);
    return true;
  }

  info('Installing Qoder CLI...');
  const result = run('curl -fsSL https://qoder.com/install | bash', 120000);
  ver = run('qodercli --version');
  if (ver) {
    ok(`Installed: v${ver}`);
    return true;
  }
  err('Installation failed');
  return false;
}

async function loginQoder(account) {
  banner('QODER CLI — Login', c.cyn);

  // Cek apakah sudah login dengan akun yang sama
  const status = run('qodercli status');
  if (status && !status.includes('Not logged in')) {
    const currentEmail = status.match(/Email:\s*(.+)/)?.[1]?.trim() || '';
    if (currentEmail === account.email) {
      ok(`Already logged in as: ${account.email}`);
      saveQoderState(account.email, { loggedIn: true, email: currentEmail });
      return true;
    }
    warn(`Currently logged in as ${currentEmail}, switching to ${account.email}...`);
  }

  info(`Login dengan: ${c.cyn}${account.email}${c.r}`);

  // Retry loop
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt > 1) {
      warn(`Retry ${attempt}/3...`);
      await sleep(3000);
    }

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
      if (t.includes('Login successful')) loginSuccess = true;
    });
    cliProc.stderr.on('data', d => {
      const t = d.toString();
      const m = t.match(/https:\/\/qoder\.com\/device\/selectAccounts\?[^\s]+/);
      if (m) loginUrl = m[0];
    });

    info('Waiting for login URL...');
    for (let i = 0; i < 30; i++) { await sleep(500); if (loginUrl) break; }

    if (!loginUrl) {
      err('No login URL received');
      cliProc.kill();
      continue;
    }
    ok('Got login URL');

    // Browser OAuth
    let browser;
    try {
      browser = await launchBrowser();
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });

      await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2000);

      // Click Google
      info('Selecting Google login...');
      await page.evaluate(() => {
        const links = document.querySelectorAll('a, button');
        for (const l of links) {
          const t = (l.textContent || '').toLowerCase();
          if (t.includes('google')) { l.click(); return; }
        }
      });
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await sleep(3000);

      await googleOAuth(page, account.email, account.password);

      // Wait for redirect back
      for (let i = 0; i < 10; i++) {
        await sleep(2000);
        const url = page.url();
        if (url.includes('qoder.com') && !url.includes('sign-in') && !url.includes('selectAccounts')) {
          break;
        }
      }
    } catch (e) {
      err(`Browser error: ${e.message}`);
    }

    if (browser) await browser.close().catch(() => {});

    // Wait for CLI
    await Promise.race([new Promise(r => cliProc.on('close', r)), sleep(15000)]);
    cliProc.kill();
    await sleep(2000);

    const finalStatus = run('qodercli status');
    if (finalStatus && !finalStatus.includes('Not logged in')) {
      const loggedInEmail = finalStatus.match(/Email:\s*(.+)/)?.[1]?.trim() || '';
      saveQoderState(account.email, { loggedIn: true, email: loggedInEmail });
      ok('LOGIN SUCCESS! ✅');
      console.log(finalStatus);
      return true;
    }
  }

  err('Login failed after 3 attempts');
  return false;
}

// ═══════════════════════════════════════════════════════════════
//  2. OLLAMA CLOUD API
// ═══════════════════════════════════════════════════════════════

// ── Multi-account key storage ───────────────────────────────
const KEYS_FILE = path.join(WORKDIR, 'ollama-keys.json');

function loadKeys() {
  if (!fs.existsSync(KEYS_FILE)) {
    // Migrate from old ollama-key.txt if exists
    const oldFile = path.join(WORKDIR, 'ollama-key.txt');
    if (fs.existsSync(oldFile)) {
      const content = fs.readFileSync(oldFile, 'utf-8');
      const keyMatch = content.match(/Key:\s*(\S+)/);
      const emailMatch = content.match(/Account:\s*(\S+)/);
      if (keyMatch) {
        const keys = {};
        if (emailMatch) keys[emailMatch[1]] = keyMatch[1];
        fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
        return keys;
      }
    }
    return {};
  }
  try { return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf-8')); } catch { return {}; }
}

function saveKey(email, key) {
  const keys = loadKeys();
  keys[email] = key;
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
  // Also update legacy ollama-key.txt for backward compat
  fs.writeFileSync(path.join(WORKDIR, 'ollama-key.txt'),
    `Ollama API Key\nAccount: ${email}\nKey: ${key}\n\nUsage:\ncurl -X POST "https://ollama.com/api/chat" \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": "gpt-oss:20b", "messages": [{"role": "user", "content": "Hello"}], "stream": false}'\n`
  );
}

function getKey(email) {
  const keys = loadKeys();
  return keys[email] || null;
}

// ── Qoder multi-account state ────────────────────────────────
const QODER_STATE_FILE = path.join(WORKDIR, '.qoder-state.json');

function loadQoderState() {
  if (!fs.existsSync(QODER_STATE_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(QODER_STATE_FILE, 'utf-8')); } catch { return {}; }
}

function saveQoderState(email, data) {
  const state = loadQoderState();
  state[email] = { ...state[email], ...data, lastUsed: Date.now() };
  fs.writeFileSync(QODER_STATE_FILE, JSON.stringify(state, null, 2));
}

function getActiveQoderEmail() {
  const status = run('qodercli status');
  if (!status || status.includes('Not logged in')) return null;
  return status.match(/Email:\s*(.+)/)?.[1]?.trim() || null;
}

async function setupOllama(account) {
  banner('OLLAMA CLOUD API', c.mag);

  // Check existing key for THIS account
  const existingKey = getKey(account.email);
  if (existingKey) {
    info(`Testing existing key for ${account.email}...`);
    const test = run(`curl -sL -m 15 -X POST "https://ollama.com/api/chat" -H "Authorization: Bearer ${existingKey}" -H "Content-Type: application/json" -d '{"model":"gpt-oss:20b","messages":[{"role":"user","content":"Say OK"}],"stream":false}'`, 20000);
    if (test && test.includes('message')) {
      ok(`Key aktif: ${existingKey.substring(0, 15)}...`);
      return true;
    }
    warn('Key lama invalid, bikin baru...');
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt > 1) { warn(`Retry ${attempt}/3...`); await sleep(3000); }

    let browser;
    try {
      browser = await launchBrowser();
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });

      // Login to Ollama
      info('Opening Ollama login...');
      await page.goto('https://ollama.com/signin', { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(3000);

      info('Clicking Google login...');
      await page.evaluate(() => {
        for (const l of document.querySelectorAll('a')) {
          if (l.href && l.href.includes('Google')) { l.click(); return; }
        }
      });
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await sleep(5000);

      await googleOAuth(page, account.email, account.password);

      // Wait for Ollama redirect
      info('Waiting for Ollama redirect...');
      let loggedIn = false;
      for (let i = 0; i < 15; i++) {
        await sleep(2000);
        const url = page.url();
        if (url.includes('ollama.com') && !url.includes('signin') && !url.includes('auth')) {
          loggedIn = true;
          break;
        }
      }

      if (!loggedIn) { err('Ollama login redirect failed'); await browser.close(); continue; }
      ok('Ollama login success!');

      // Navigate to API keys
      info('Opening API keys page...');
      await page.goto('https://ollama.com/settings/keys', { waitUntil: 'networkidle2', timeout: 15000 });
      await sleep(3000);

      // Click Create/Add
      info('Creating API key...');
      await page.evaluate(() => {
        for (const b of document.querySelectorAll('button, a')) {
          const t = (b.textContent || '').toLowerCase();
          if (t.includes('create') || t.includes('add') || t.includes('generate') || t.includes('new')) {
            b.click(); return;
          }
        }
      });
      await sleep(3000);

      // Fill name if exists
      try {
        const nameInput = await page.$('input[type="text"], input[name="name"]');
        if (nameInput) {
          await nameInput.type('mimo-agent', { delay: 40 });
          await sleep(500);
        }
      } catch {}

      // Click Generate/Submit
      await page.evaluate(() => {
        for (const b of document.querySelectorAll('button')) {
          const t = (b.textContent || '').toLowerCase();
          if (t.includes('generate') || t.includes('create') || t.includes('submit') || t.includes('save')) {
            b.click(); return;
          }
        }
      });
      await sleep(5000);

      // Extract key
      const apiKey = await page.evaluate(() => {
        const inp = document.querySelector('input[name="api-key-string"]');
        if (inp && inp.value) return inp.value;
        for (const el of document.querySelectorAll('code, pre, [class*="key"], [class*="token"]')) {
          const t = el.textContent.trim();
          if (t.length > 20 && !t.includes(' ')) return t;
        }
        return null;
      });

      if (!apiKey) { err('Could not extract API key'); await browser.close(); continue; }

      // Save per-account
      saveKey(account.email, apiKey);
      ok(`API Key untuk ${c.cyn}${account.email}${c.r}: ${apiKey.substring(0, 15)}...`);

      // Test
      info('Testing API...');
      const test = run(`curl -sL -m 15 -X POST "https://ollama.com/api/chat" -H "Authorization: Bearer ${apiKey}" -H "Content-Type: application/json" -d '{"model":"gpt-oss:20b","messages":[{"role":"user","content":"Say OK"}],"stream":false}'`, 20000);
      if (test && test.includes('message')) {
        ok('API Test PASSED! ✅');
        await browser.close();
        return true;
      }
      warn('API test inconclusive, but key saved');
      await browser.close();
      return true;

    } catch (e) {
      err(`Ollama error: ${e.message}`);
      if (browser) await browser.close().catch(() => {});
    }
  }

  err('Ollama setup failed after 3 attempts');
  return false;
}

// ═══════════════════════════════════════════════════════════════
//  3. CLINE CLI
// ═══════════════════════════════════════════════════════════════

async function setupCline() {
  banner('4. CLINE CLI', c.blu);

  const binPath = path.join(WORKDIR, 'node_modules', '.bin', 'cline');

  // Check if installed
  if (fs.existsSync(binPath)) {
    const ver = run(`"${binPath}" --version`, 10000);
    if (ver) {
      ok(`Already installed: ${ver}`);
      return true;
    }
  }

  info('Installing Cline CLI...');
  try {
    // Install the main npm package
    run('npm install --save cline@latest', 120000);

    // Try running
    if (fs.existsSync(binPath)) {
      const ver = run(`"${binPath}" --version`, 10000);
      if (ver) {
        ok(`Installed: ${ver}`);
        return true;
      }
    }

    // Alternative: install @cline/cli directly
    info('Trying alternative install...');
    run('npm install --save @cline/cli@latest', 60000);

    const ver = run(`"${binPath}" --version`, 10000);
    if (ver) {
      ok(`Installed: ${ver}`);
      return true;
    }

    warn('Cline CLI install inconclusive — may need manual setup');
    return false;
  } catch (e) {
    err(`Cline install error: ${e.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
//  4. QODER DESKTOP
// ═══════════════════════════════════════════════════════════════

async function setupDesktop() {
  banner('5. QODER DESKTOP', c.yel);

  const desktopDir = '/tmp/qoder-desktop';
  const debPath = path.join(WORKDIR, 'qoder_amd64.deb');
  const qoderBin = path.join(desktopDir, 'usr', 'share', 'qoder', 'qoder');

  // Check/install
  if (!fs.existsSync(qoderBin)) {
    if (!fs.existsSync(debPath)) {
      info('Downloading Qoder Desktop...');
      const dl = run(`curl -L -o "${debPath}" "https://download.qoder.com/release/latest/qoder_amd64.deb"`, 180000);
      if (!fs.existsSync(debPath)) {
        err('Download failed');
        return false;
      }
    }
    ok('Downloaded');
    info('Extracting...');
    run(`dpkg -x "${debPath}" "${desktopDir}/"`);
  }

  if (!fs.existsSync(qoderBin)) {
    err('Qoder Desktop binary not found after extraction');
    return false;
  }
  ok('Qoder Desktop extracted');

  // Dependencies
  const deps = [
    { name: 'libgtk-3-0', url: 'http://archive.ubuntu.com/ubuntu/pool/main/g/gtk+3.0/libgtk-3-0_3.24.33-1ubuntu2.2_amd64.deb', check: '/tmp/gtk3/usr/lib/x86_64-linux-gnu/libgtk-3.so.0', extractTo: '/tmp/gtk3' },
    { name: 'libepoxy0', url: 'http://archive.ubuntu.com/ubuntu/pool/main/libe/libepoxy/libepoxy0_1.5.10-2build1_amd64.deb', check: '/tmp/deps/usr/lib/x86_64-linux-gnu/libepoxy.so.0', extractTo: '/tmp/deps' },
    { name: 'libXinerama1', url: 'http://archive.ubuntu.com/ubuntu/pool/main/libx/libxinerama/libxinerama1_1.1.4-3build1_amd64.deb', check: '/tmp/deps/usr/lib/x86_64-linux-gnu/libXinerama.so.1', extractTo: '/tmp/deps' },
  ];

  for (const dep of deps) {
    if (!fs.existsSync(dep.check)) {
      info(`Downloading ${dep.name}...`);
      const debFile = `/tmp/${dep.name}.deb`;
      run(`curl -L -o "${debFile}" "${dep.url}"`, 30000);
      run(`dpkg -x "${debFile}" "${dep.extractTo}/"`);
      if (fs.existsSync(dep.check)) ok(`${dep.name} installed`);
      else warn(`${dep.name} may have failed`);
    } else {
      ok(`${dep.name} ready`);
    }
  }

  // Start Xvfb
  if (!run('pgrep Xvfb')) {
    info('Starting Xvfb on :99...');
    spawn('Xvfb', [':99', '-screen', '0', '1920x1080x24'], { detached: true, stdio: 'ignore' }).unref();
    await sleep(2000);
  }
  ok('Xvfb running on :99');

  // Verify
  const ldPath = '/tmp/gtk3/usr/lib/x86_64-linux-gnu:/tmp/deps/usr/lib/x86_64-linux-gnu:/tmp/qoder-desktop/usr/share/qoder';
  const missing = run(`LD_LIBRARY_PATH="${ldPath}" ldd "${qoderBin}" 2>&1 | grep "not found"`, 10000);
  if (missing) {
    warn(`Some libs missing:\n${missing}`);
  } else {
    ok('All dependencies satisfied');
  }

  console.log(`\n  ${c.b}Launch command:${c.r}`);
  console.log(`  ${c.cyn}DISPLAY=:99 LD_LIBRARY_PATH="${ldPath}" ${qoderBin} --no-sandbox --disable-gpu${c.r}`);

  return true;
}

// ═══════════════════════════════════════════════════════════════
//  5. CLAIM 800 FREE CALLS
// ═══════════════════════════════════════════════════════════════

function showClaimGuide() {
  banner('6. CLAIM 800 FREE CALLS', c.grn);

  const now = Date.now();
  const promoEnd = new Date('2026-09-03T23:59:59+08:00').getTime();
  const daysLeft = Math.ceil((promoEnd - now) / 86400000);

  console.log(`  ${c.yel}⏰ ${daysLeft} hari lagi${c.r} (s/d 3 Sep 2026)\n`);

  console.log(`  ${c.b}Option A — Qoder Web (Paling Mudah):${c.r}`);
  console.log(`    1. Buka: ${c.cyn}https://qoder.com/account/usage${c.r}`);
  console.log(`    2. Login dengan Google`);
  console.log(`    3. Cari "Event Claims" atau "Anniversary Promotion"`);
  console.log(`    4. Klik "Claim" pada 800 calls offer\n`);

  console.log(`  ${c.b}Option B — Qoder Desktop:${c.r}`);
  console.log(`    1. Buka Qoder Desktop → Settings → Usage`);
  console.log(`    2. Temukan tombol "Claim Now"\n`);

  console.log(`  ${c.b}Option C — CLI (jika tersedia):${c.r}`);
  console.log(`    1. Jalankan: ${c.cyn}qodercli${c.r} (interactive mode)`);
  console.log(`    2. Cek Usage/Status panel\n`);

  console.log(`  ${c.d}📱 Claim di satu platform, bisa dipakai di mana saja${c.r}`);
  console.log(`  ${c.d}🎁 800 calls ≈ 80 tasks on Qwen3.8-Max${c.r}`);
}

// ═══════════════════════════════════════════════════════════════
//  6. TEST MODEL
// ═══════════════════════════════════════════════════════════════

async function testModel() {
  banner('TEST QWEN3.8-MAX', c.mag);

  const status = run('qodercli status');
  if (!status || status.includes('Not logged in')) {
    err('Not logged in! Login first.');
    return;
  }

  const inquirer = loadModule('inquirer');
  const { prompt } = await inquirer.prompt([{
    type: 'input', name: 'prompt', message: 'Test prompt:',
    default: 'Hello! What model are you? Reply briefly.'
  }]);

  info('Sending to Qwen3.8-Max...\n');
  divider();
  const result = run(`qodercli -p -m "Qwen3.8-Max" "${prompt.replace(/"/g, '\\"')}"`, 60000);
  divider();

  if (result) {
    console.log(result);
    ok('Model responded!');
  } else {
    err('No response or timeout');
  }
}

// ═══════════════════════════════════════════════════════════════
//  7. TEST OLLAMA API
// ═══════════════════════════════════════════════════════════════

async function testOllama() {
  banner('TEST OLLAMA API', c.mag);

  const keyFile = path.join(WORKDIR, 'ollama-key.txt');
  if (!fs.existsSync(keyFile)) {
    err('No ollama-key.txt found. Run Ollama setup first.');
    return;
  }

  const content = fs.readFileSync(keyFile, 'utf-8');
  const keyMatch = content.match(/Key:\s*(\S+)/);
  if (!keyMatch) { err('No key found in ollama-key.txt'); return; }

  const key = keyMatch[1];

  const inquirer = loadModule('inquirer');
  const { model, prompt } = await inquirer.prompt([
    { type: 'select', name: 'model', message: 'Model:', choices: [
      { name: 'gpt-oss:20b (Free)', value: 'gpt-oss:20b' },
      { name: 'gpt-oss:120b (Free)', value: 'gpt-oss:120b' },
      { name: 'gemma4:31b (Free)', value: 'gemma4:31b' },
    ]},
    { type: 'input', name: 'prompt', message: 'Prompt:', default: 'Hello! What model are you?' }
  ]);

  info(`Sending to ${model}...\n`);
  divider();
  const result = run(`curl -sL -m 30 -X POST "https://ollama.com/api/chat" -H "Authorization: Bearer ${key}" -H "Content-Type: application/json" -d '${JSON.stringify({ model, messages: [{ role: "user", content: prompt }], stream: false })}'`, 35000);
  divider();

  if (result) {
    try {
      const parsed = JSON.parse(result);
      if (parsed.message?.content) {
        console.log(parsed.message.content);
        ok('API responded!');
      } else if (parsed.error) {
        err(`API Error: ${JSON.stringify(parsed.error)}`);
      } else {
        console.log(result.substring(0, 500));
      }
    } catch {
      console.log(result.substring(0, 500));
    }
  } else {
    err('No response or timeout');
  }
}

// ═══════════════════════════════════════════════════════════════
//  FULL ONE-CLICK SETUP
// ═══════════════════════════════════════════════════════════════

async function fullSetup(account) {
  banner('🚀 FULL ONE-CLICK SETUP', c.grn);
  info(`Akun: ${c.cyn}${account.email}${c.r}`);

  const results = {};

  // 1. Qoder CLI
  results.cli = await installQoderCli();

  // 2. Qoder Login
  results.login = await loginQoder(account);

  // 3. Ollama
  results.ollama = await setupOllama(account);

  // 4. Cline
  results.cline = await setupCline();

  // 5. Desktop
  results.desktop = await setupDesktop();

  // 6. Claim guide
  showClaimGuide();

  // Summary
  banner('📊 SETUP RESULTS', c.grn);
  const items = [
    ['Qoder CLI', results.cli],
    ['Qoder Login', results.login],
    ['Ollama API', results.ollama],
    ['Cline CLI', results.cline],
    ['Desktop', results.desktop],
  ];

  console.log(`  ${c.b}┌────────────────────────────────────────────┐${c.r}`);
  for (const [name, status] of items) {
    const icon = status ? `${c.grn}✅${c.r}` : `${c.red}❌${c.r}`;
    console.log(`  ${c.b}│${c.r} ${icon} ${name.padEnd(20)} ${status ? 'Ready' : 'Needs attention'}`);
  }
  console.log(`  ${c.b}└────────────────────────────────────────────┘${c.r}`);

  const successCount = items.filter(([, s]) => s).length;
  console.log(`\n  ${successCount === items.length ? c.grn : c.yel}${c.b}${successCount}/${items.length} components ready${c.r}`);
}

// ═══════════════════════════════════════════════════════════════
//  ACCOUNT SELECTOR (shared helper)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  SHOW ACCOUNT STATUS (ringkasan per akun)
// ═══════════════════════════════════════════════════════════════

function showAccountStatus(account) {
  const cliStatus = run('qodercli status');
  const currentEmail = cliStatus?.match(/Email:\s*(.+)/)?.[1]?.trim() || '';
  const isLoggedIn = cliStatus && !cliStatus.includes('Not logged in');
  const qoderState = loadQoderState();

  const items = [];
  if (isLoggedIn && currentEmail === account.email) {
    items.push(`${c.grn}✅ Qoder${c.r}`);
  } else if (isLoggedIn) {
    items.push(`${c.yel}⚠️  Qoder (${currentEmail})${c.r}`);
  } else if (qoderState[account.email]?.loggedIn) {
    items.push(`${c.yel}⚠️  Qoder (re-login)${c.r}`);
  } else {
    items.push(`${c.red}❌ Qoder${c.r}`);
  }

  const ollamaKey = getKey(account.email);
  items.push(ollamaKey ? `${c.grn}✅ Ollama${c.r}` : `${c.red}❌ Ollama${c.r}`);

  return items.join('  ');
}

// ═══════════════════════════════════════════════════════════════
//  MAIN MENU — Pilih operasi, jalankan untuk SEMUA akun
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  FLOW 1: QODER — Install → Login semua akun → Claim
// ═══════════════════════════════════════════════════════════════

async function flowQoder(accounts) {
  banner('⚡ FLOW QODER', c.cyn);
  info(`${accounts.length} akun akan diproses`);

  // Step 1: Install CLI
  banner('Step 1/3 — Install Qoder CLI', c.cyn);
  await installQoderCli();

  // Step 2: Login semua akun
  banner('Step 2/3 — Login Semua Akun', c.cyn);
  const results = [];
  for (let i = 0; i < accounts.length; i++) {
    const a = accounts[i];
    console.log(`\n  ${c.b}[${i+1}/${accounts.length}]${c.r} ${c.cyn}${a.email}${c.r}`);
    const ok = await loginQoder(a);
    results.push({ email: a.email, status: ok ? '✅' : '❌' });
  }

  // Step 3: Claim guide
  banner('Step 3/3 — Claim 800 Free Calls', c.grn);
  showClaimGuide();

  // Summary
  banner('HASIL QODER', c.grn);
  for (const r of results) {
    console.log(`  ${r.status} ${r.email}`);
  }
}

// ═══════════════════════════════════════════════════════════════
//  FLOW 2: OLLAMA — Login semua akun → Create API key → Simpan
// ═══════════════════════════════════════════════════════════════

async function flowOllama(accounts) {
  banner('☁️  FLOW OLLAMA', c.mag);
  info(`${accounts.length} akun akan diproses`);

  // Step 1: Setup semua akun (login + create key + simpan)
  banner('Step 1/1 — Login & Create API Key', c.mag);
  const results = [];
  for (let i = 0; i < accounts.length; i++) {
    const a = accounts[i];
    console.log(`\n  ${c.b}[${i+1}/${accounts.length}]${c.r} ${c.mag}${a.email}${c.r}`);
    const ok = await setupOllama(a);
    results.push({ email: a.email, status: ok ? '✅' : '❌' });
  }

  // Summary
  banner('HASIL OLLAMA', c.grn);
  const keys = loadKeys();
  for (const r of results) {
    const key = keys[r.email];
    const masked = key ? key.substring(0, 12) + '...' : 'tidak ada';
    console.log(`  ${r.status} ${r.email}  ${c.d}${masked}${c.r}`);
  }
  console.log(`\n  ${c.b}📁 Semua key tersimpan di:${c.r} ollama-keys.json`);
}

// ═══════════════════════════════════════════════════════════════
//  FLOW 3: FULL — Qoder + Ollama + Cline + Desktop
// ═══════════════════════════════════════════════════════════════

async function flowFull(accounts) {
  banner('🚀 FLOW FULL SETUP', c.grn);
  info(`${accounts.length} akun akan diproses\n`);

  // Qoder flow
  await flowQoder(accounts);

  // Ollama flow
  await flowOllama(accounts);

  // Global tools
  banner('Install Cline CLI', c.blu);
  await setupCline();

  banner('Setup Qoder Desktop', c.yel);
  await setupDesktop();
}

// ═══════════════════════════════════════════════════════════════
//  CAPTCHA SOLVER — Setup & Manage
// ═══════════════════════════════════════════════════════════════

const CAPTCHA_DIR = path.join(WORKDIR, 'captcha-solver');
const CAPTCHA_PORT = 8877;

function isCaptchaInstalled() {
  return fs.existsSync(path.join(CAPTCHA_DIR, 'server.py'));
}

function isCaptchaRunning() {
  const result = run(`curl -sL -m 3 http://127.0.0.1:${CAPTCHA_PORT}/health`, 5000);
  return result && result.includes('turnstile');
}

async function setupCaptcha() {
  banner('🛡️  CAPTCHA SOLVER', c.mag);

  if (!isCaptchaInstalled()) {
    err('captcha-solver tidak ditemukan!');
    info('Pastikan folder captcha-solver ada di project root');
    return false;
  }
  ok('captcha-solver ditemukan');

  // Check Python deps
  info('Checking Python dependencies...');
  const deps = ['fastapi', 'uvicorn', 'pydantic', 'cloakbrowser', 'PIL'];
  const missing = [];
  for (const dep of deps) {
    const check = run(`python3 -c "import ${dep === 'PIL' ? 'PIL' : dep}" 2>&1`, 5000);
    if (check && check.includes('ModuleNotFoundError')) missing.push(dep);
  }

  if (missing.length > 0) {
    warn(`Missing: ${missing.join(', ')}`);
    info('Installing dependencies...');
    run('pip3 install --user fastapi uvicorn pydantic cloakbrowser pillow onnxruntime opencv-python-headless numpy', 120000);
  }
  ok('Dependencies OK');

  // Check if running
  if (isCaptchaRunning()) {
    ok(`Already running on port ${CAPTCHA_PORT}`);
    return true;
  }

  // Start server
  info(`Starting on port ${CAPTCHA_PORT}...`);
  const proc = spawn('python3', ['server.py'], {
    cwd: CAPTCHA_DIR,
    env: { ...process.env, PORT: String(CAPTCHA_PORT), BROWSER_HEADLESS: '0' },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  proc.unref();

  // Wait for startup
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    if (isCaptchaRunning()) {
      ok(`Running on http://127.0.0.1:${CAPTCHA_PORT}`);
      return true;
    }
  }
  warn('Server started but health check not confirmed');
  return true;
}

async function testCaptcha() {
  banner('🧪 TEST CAPTCHA SOLVER', c.mag);

  if (!isCaptchaRunning()) {
    err('Server not running! Jalankan setup dulu.');
    return;
  }

  // Health check
  info('Health check...');
  const health = run(`curl -sL http://127.0.0.1:${CAPTCHA_PORT}/health`, 5000);
  if (health) {
    try {
      const data = JSON.parse(health);
      ok(`Status: ${data.status}`);
      console.log(`  Types: ${data.types?.join(', ') || 'N/A'}`);
    } catch { ok(health.substring(0, 100)); }
  }

  // Test solve (turnstile stub)
  info('Test solve (turnstile)...');
  const result = run(`curl -sL -m 65 -X POST http://127.0.0.1:${CAPTCHA_PORT}/solve -H "Content-Type: application/json" -d '{"type":"turnstile","sitekey":"0x4AAAAAAABnp1QeF6Mg","url":"https://example.com","timeout_s":30}'`, 70000);
  if (result) {
    try {
      const data = JSON.parse(result);
      if (data.token) {
        ok(`Token: ${data.token.substring(0, 30)}...`);
      } else if (data.error) {
        warn(`Error: ${data.error}`);
      } else {
        console.log(JSON.stringify(data, null, 2).substring(0, 300));
      }
    } catch { console.log(result.substring(0, 300)); }
  } else {
    warn('No response (timeout or connection error)');
  }
}

function showCaptchaStatus() {
  banner('🛡️  CAPTCHA SOLVER STATUS', c.mag);

  const installed = isCaptchaInstalled();
  const running = isCaptchaRunning();

  console.log(`  ${installed ? c.grn + '✅' : c.red + '❌'}${c.r} Installed: ${installed ? 'Yes' : 'No'}`);
  console.log(`  ${running ? c.grn + '✅' : c.red + '❌'}${c.r} Running: ${running ? `http://127.0.0.1:${CAPTCHA_PORT}` : 'No'}`);

  if (running) {
    const health = run(`curl -sL http://127.0.0.1:${CAPTCHA_PORT}/health`, 5000);
    if (health) {
      try {
        const data = JSON.parse(health);
        console.log(`  ${c.blu}ℹ${c.r} Types: ${data.types?.join(', ') || 'N/A'}`);
      } catch {}
    }
  }

  console.log(`\n  ${c.b}Endpoints:${c.r}`);
  console.log(`    GET  /health  — Liveness check`);
  console.log(`    POST /solve   — Solve captcha`);
  console.log(`    GET  /docs    — Swagger UI`);
  console.log(`    GET  /status  — Service status`);
}

// ═══════════════════════════════════════════════════════════════
//  MAIN MENU
// ═══════════════════════════════════════════════════════════════

async function mainMenu() {
  console.clear();
  console.log(LOGO);

  // Quick status
  const cliVer = run('qodercli --version');
  const cliStatus = run('qodercli status');
  const cliLoggedIn = cliStatus && !cliStatus.includes('Not logged in');
  const cliEmail = cliStatus?.match(/Email:\s*(.+)/)?.[1] || '';

  if (cliLoggedIn) {
    console.log(`  ${c.grn}●${c.r} Qoder: ${c.b}logged in${c.r} as ${c.cyn}${cliEmail}${c.r}`);
  } else if (cliVer) {
    console.log(`  ${c.yel}●${c.r} Qoder: installed (v${cliVer}) — ${c.red}not logged in${c.r}`);
  } else {
    console.log(`  ${c.red}●${c.r} Qoder: not installed`);
  }

  if (!CHROME_PATH) {
    console.log(`  ${c.red}●${c.r} Chrome: NOT FOUND — browser automation will fail!`);
  }

  // Load & tampilkan semua akun
  const inquirer = loadModule('inquirer');
  const accounts = loadAccounts();

  if (accounts.length === 0) {
    err('Tidak ada akun di accounts.txt!');
    info('Tambah manual: echo "email|password" >> accounts.txt');
    return;
  }

  console.log(`\n  ${c.blu}📋 ${accounts.length} akun:${c.r}`);
  for (const a of accounts) {
    console.log(`     ${c.mag}●${c.r} ${a.email}  ${showAccountStatus(a)}`);
  }

  // Pilih flow
  console.log('');
  const { flow } = await inquirer.prompt([{
    type: 'select', name: 'flow', message: 'Pilih flow:', pageSize: 12,
    choices: [
      { name: '🚀  FULL — Qoder + Ollama + Cline + Desktop (semua akun)', value: 'full' },
      new inquirer.Separator(`── Per Layanan (loop semua akun) ──`),
      { name: '⚡  QODER — Install → Login semua → Claim 800 calls', value: 'qoder' },
      { name: '☁️   OLLAMA — Login semua → Create API key → Simpan', value: 'ollama' },
      new inquirer.Separator(`── Tools ──`),
      { name: '🛡️   CAPTCHA SOLVER — Setup & manage', value: 'captcha' },
      new inquirer.Separator(`── Info ──`),
      { name: '📊  Status Dashboard', value: 'status' },
      { name: '🔑  Lihat Semua Ollama Keys', value: 'keys' },
      { name: '❌  Keluar', value: 'exit' },
    ]
  }]);

  switch (flow) {
    case 'full':   await flowFull(accounts); break;
    case 'qoder':  await flowQoder(accounts); break;
    case 'ollama': await flowOllama(accounts); break;
    case 'captcha': {
      const inquirer2 = loadModule('inquirer');
      const { cAction } = await inquirer2.prompt([{
        type: 'select', name: 'cAction', message: 'Captcha Solver:',
        choices: [
          { name: '🚀  Setup & Start', value: 'setup' },
          { name: '🧪  Test Solve', value: 'test' },
          { name: '📊  Status', value: 'status' },
          { name: '←  Back', value: 'back' },
        ]
      }]);
      if (cAction === 'setup') await setupCaptcha();
      else if (cAction === 'test') await testCaptcha();
      else if (cAction === 'status') showCaptchaStatus();
      break;
    }
    case 'status': await showDashboard(); break;
    case 'keys': {
      banner('🔑 OLLAMA API KEYS', c.mag);
      const keys = loadKeys();
      const entries = Object.entries(keys);
      if (entries.length === 0) {
        warn('Belum ada key tersimpan');
      } else {
        console.log(`  ${c.b}Total: ${entries.length} akun${c.r}\n`);
        for (const [email, key] of entries) {
          const masked = key.substring(0, 12) + '...' + key.substring(key.length - 4);
          console.log(`  ${c.grn}●${c.r} ${c.cyn}${email}${c.r}`);
          console.log(`    ${c.d}${masked}${c.r}`);
        }
      }
      break;
    }
    case 'exit':
      console.log(`\n${c.cyn}Bye! 👋${c.r}\n`);
      process.exit(0);
  }

  console.log('');
  const { again } = await inquirer.prompt([{
    type: 'confirm', name: 'again', message: 'Kembali ke menu?', default: true
  }]);
  if (again) mainMenu();
  else console.log(`\n${c.cyn}Bye! 👋${c.r}\n`);
}

async function cliMode(args) {
  const cmd = args[0];
  const accounts = loadAccounts();

  switch (cmd) {
    case 'status':
    case '--status':
      await showDashboard();
      break;
    case 'qoder':
    case '--qoder':
      if (accounts.length === 0) { err('No accounts in accounts.txt'); return; }
      await flowQoder(accounts);
      break;
    case 'ollama':
    case '--ollama':
      if (accounts.length === 0) { err('No accounts in accounts.txt'); return; }
      await flowOllama(accounts);
      break;
    case 'full':
    case '--full':
      if (accounts.length === 0) { err('No accounts in accounts.txt'); return; }
      await flowFull(accounts);
      break;
    case 'captcha':
    case '--captcha':
      await setupCaptcha();
      break;
    case 'keys':
    case '--keys': {
      const keys = loadKeys();
      const entries = Object.entries(keys);
      if (entries.length === 0) { console.log('No keys'); return; }
      for (const [email, key] of entries) {
        console.log(`${email}: ${key.substring(0, 12)}...`);
      }
      break;
    }
    case 'help':
    case '--help':
    case '-h':
      console.log(`
${c.cyn}${c.b}MIMO SETUP — All-In-One Manager${c.r}
`);
      console.log(`Usage: node mimo-setup.js [command]
`);
      console.log(`Flows (loop semua akun di accounts.txt):`);
      console.log(`  (no args)    Interactive TUI menu`);
      console.log(`  full         Qoder + Ollama + Cline + Desktop`);
      console.log(`  qoder        Install -> Login semua -> Claim 800 calls`);
      console.log(`  ollama       Login semua -> Create API key -> Simpan`);
      console.log(`  captcha      Setup & start captcha solver`);
      console.log();
      console.log(`Tools:`);
      console.log(`  status       Status dashboard`);
      console.log(`  help         Show this help`);
      break;
    default:
      console.error(`Unknown command: ${cmd}. Run with 'help' for usage.`);
      process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════
//  ENTRY POINT
// ═══════════════════════════════════════════════════════════════

(async () => {
  try {
    const args = process.argv.slice(2);
    if (args.length > 0) {
      await cliMode(args);
    } else {
      await mainMenu();
    }
  } catch (e) {
    console.error(`\n${c.red}Fatal Error: ${e.message}${c.r}`);
    if (e.message.includes('Module')) {
      console.log(`\n${c.yel}Fix: Run ${c.b}npm install${c.r}${c.yel} in the mimo-agent directory${c.r}`);
    }
    process.exit(1);
  }
})();
