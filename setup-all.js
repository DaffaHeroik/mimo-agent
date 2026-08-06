#!/usr/bin/env node
// ============================================================
//  ALL-IN-ONE SETUP — Qoder Ecosystem
//  1. Qoder CLI (login + verify)
//  2. Ollama Cloud API (create key + test)
//  3. Cline CLI (install + verify)
//  4. Qoder Desktop (install + Xvfb + launch)
//  5. Claim 800 Free Calls (guide)
// ============================================================

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const HOME = process.env.HOME;
const WORKDIR = __dirname;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const c = {
  r: '\x1b[0m', b: '\x1b[1m', d: '\x1b[2m',
  red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m',
  blu: '\x1b[34m', cyn: '\x1b[36m', mag: '\x1b[35m',
};

function ok(m)   { console.log(`  ${c.grn}✔${c.r} ${m}`); }
function err(m)  { console.log(`  ${c.red}✘${c.r} ${m}`); }
function info(m) { console.log(`  ${c.blu}ℹ${c.r} ${m}`); }
function warn(m) { console.log(`  ${c.yel}⚠${c.r} ${m}`); }

function banner(title, color) {
  console.log(`\n${color}${c.b}┌──────────────────────────────────────────────┐`);
  console.log(`│  ${title.padEnd(44)}│`);
  console.log(`└──────────────────────────────────────────────┘${c.r}`);
}

function run(cmd, timeout = 15000) {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout, stdio: 'pipe' }).trim();
  } catch { return null; }
}

function runAsync(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
    setTimeout(() => { try { proc.kill(); } catch {} resolve({ code: -1, stdout: stdout.trim(), stderr: stderr.trim() }); }, opts.timeout || 15000);
  });
}

// ============================================================
//  1. QODER CLI
// ============================================================
async function setupQoderCli() {
  banner('1. QODER CLI', c.cyn);

  // Check/install CLI
  let ver = run('qodercli --version');
  if (!ver) {
    info('Installing Qoder CLI...');
    run('curl -fsSL https://qoder.com/install | bash', 60000);
    ver = run('qodercli --version');
    if (!ver) { err('CLI install failed'); return false; }
  }
  ok(`Qoder CLI ${ver}`);

  // Check login
  const status = run('qodercli status');
  if (status && !status.includes('Not logged in')) {
    const email = status.match(/Email:\s*(.+)/)?.[1] || 'unknown';
    ok(`Logged in: ${email}`);
    return true;
  }

  warn('Not logged in — run: qodercli login');
  return false;
}

// ============================================================
//  2. OLLAMA CLOUD API
// ============================================================
async function setupOllama() {
  banner('2. OLLAMA CLOUD API', c.mag);

  const keyFile = path.join(WORKDIR, 'ollama-key.txt');

  // Check if key exists
  if (fs.existsSync(keyFile)) {
    const content = fs.readFileSync(keyFile, 'utf-8');
    const keyMatch = content.match(/Key:\s*(\S+)/);
    if (keyMatch) {
      const key = keyMatch[1];
      // Test the key
      info('Testing existing key...');
      const test = run(`curl -sL -X POST "https://ollama.com/api/chat" -H "Authorization: Bearer ${key}" -H "Content-Type: application/json" -d '{"model":"gpt-oss:20b","messages":[{"role":"user","content":"Say OK"}],"stream":false}'`, 30000);
      if (test && test.includes('message')) {
        ok(`API key works: ${key.substring(0, 15)}...`);
        return true;
      }
      warn('Existing key invalid, will create new one');
    }
  }

  // Create new key via browser automation
  info('Creating new API key...');
  try {
    const puppeteer = require('./node_modules/puppeteer-extra');
    const StealthPlugin = require('./node_modules/puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());

    const browser = await puppeteer.launch({
      executablePath: `${HOME}/.cache/puppeteer/chrome/linux-151.0.7922.71/chrome-linux64/chrome`,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // Login to Ollama via Google
    await page.goto('https://ollama.com/signin', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);
    await page.evaluate(() => {
      for (const l of document.querySelectorAll('a')) {
        if (l.href && l.href.includes('Google')) { l.click(); return; }
      }
    });
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await sleep(5000);

    // Google OAuth
    try {
      await page.waitForSelector('#identifierId', { timeout: 8000 });
      await page.click('#identifierId', { clickCount: 3 });
      await page.type('#identifierId', 'respati1@bozztirex.us', { delay: 50 });
      await sleep(500);
      await page.keyboard.press('Enter');
      await sleep(6000);
    } catch {}

    try {
      await page.waitForSelector('input[type="password"]', { timeout: 8000 });
      await page.click('input[type="password"]', { clickCount: 3 });
      await page.type('input[type="password"]', 'Daffa112233', { delay: 50 });
      await sleep(500);
      await page.keyboard.press('Enter');
      await sleep(10000);
    } catch {}

    // Consent/speedbump
    for (let i = 0; i < 10; i++) {
      await sleep(2000);
      const url = page.url();
      if (url.includes('ollama.com') && !url.includes('signin') && !url.includes('auth')) break;
      if (url.includes('speedbump')) {
        await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
        await sleep(1000);
        await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (b.textContent.toLowerCase().match(/i understand|next|continue/)) { b.click(); return; } });
        await sleep(3000); continue;
      }
      if (url.includes('accounts.google.com')) {
        await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (b.textContent.toLowerCase().match(/lanjutkan|continue|allow/)) { b.click(); return; } });
        await sleep(3000); continue;
      }
    }

    // Navigate to API keys
    await page.goto('https://ollama.com/settings/keys', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(3000);

    // Click Create/Add API Key
    await page.evaluate(() => {
      for (const b of document.querySelectorAll('button, a')) {
        const t = (b.textContent || '').toLowerCase();
        if (t.includes('create') || t.includes('add') || t.includes('generate')) { b.click(); return; }
      }
    });
    await sleep(3000);

    // Click Generate
    await page.evaluate(() => {
      for (const b of document.querySelectorAll('button')) {
        const t = (b.textContent || '').toLowerCase();
        if (t.includes('generate') || t.includes('create') || t.includes('submit')) { b.click(); return; }
      }
    });
    await sleep(5000);

    // Extract key
    const apiKey = await page.evaluate(() => {
      const inp = document.querySelector('input[name="api-key-string"]');
      if (inp && inp.value) return inp.value;
      for (const el of document.querySelectorAll('code, pre')) {
        const t = el.textContent.trim();
        if (t.length > 20 && !t.includes(' ')) return t;
      }
      return null;
    });

    if (apiKey) {
      fs.writeFileSync(keyFile, `Ollama API Key\nAccount: respati1@bozztirex.us\nKey: ${apiKey}\n\nUsage:\ncurl -X POST "https://ollama.com/api/chat" \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": "gpt-oss:20b", "messages": [{"role": "user", "content": "Hello"}], "stream": false}'\n`);
      ok(`API key created: ${apiKey.substring(0, 15)}...`);

      // Test
      const test = run(`curl -sL -X POST "https://ollama.com/api/chat" -H "Authorization: Bearer ${apiKey}" -H "Content-Type: application/json" -d '{"model":"gpt-oss:20b","messages":[{"role":"user","content":"Say OK"}],"stream":false}'`, 30000);
      if (test && test.includes('message')) ok('API test passed');
      else warn('API test inconclusive');
    } else {
      err('Could not extract API key');
    }

    await browser.close();
    return !!apiKey;
  } catch (e) {
    err(`Ollama setup error: ${e.message}`);
    return false;
  }
}

// ============================================================
//  3. CLINE CLI
// ============================================================
async function setupCline() {
  banner('3. CLINE CLI', c.blu);

  // Check if installed
  const binPath = path.join(WORKDIR, 'node_modules', '.bin', 'cline');
  const clineBin = path.join(WORKDIR, 'node_modules', 'cline', 'bin', 'cline');

  if (fs.existsSync(clineBin)) {
    const ver = run(`node "${clineBin}" --version`, 10000);
    if (ver) { ok(`Cline CLI ${ver}`); return true; }
  }

  // Install
  info('Installing Cline CLI...');
  try {
    // Install npm package
    run('npm install --ignore-scripts --no-optional cline', 60000);

    // Install platform binary
    const platform = run('uname -m') === 'x86_64' ? 'x64' : 'arm64';
    const cliPkg = `@cline/cli-linux-${platform}`;

    // Download and extract manually
    run(`npm pack ${cliPkg}`, 30000);
    const tgz = run(`ls cline-cli-linux-${platform}-*.tgz 2>/dev/null | head -1`);
    if (tgz) {
      run(`mkdir -p /tmp/cline-bin && tar xzf ${tgz} -C /tmp/cline-bin`);
      run(`mkdir -p node_modules/@cline/cli-linux-${platform}`);
      run(`cp -r /tmp/cline-bin/package/* node_modules/@cline/cli-linux-${platform}/`);
      run(`rm -f ${tgz}`);
    }

    const ver = run(`node "${clineBin}" --version`, 10000);
    if (ver) { ok(`Cline CLI ${ver}`); return true; }
    err('Cline install failed');
    return false;
  } catch (e) {
    err(`Cline install error: ${e.message}`);
    return false;
  }
}

// ============================================================
//  4. QODER DESKTOP
// ============================================================
async function setupDesktop() {
  banner('4. QODER DESKTOP (Xvfb)', c.yel);

  const desktopDir = '/tmp/qoder-desktop';
  const debPath = path.join(WORKDIR, 'qoder_amd64.deb');
  const qoderBin = path.join(desktopDir, 'usr', 'share', 'qoder', 'qoder');

  // Check if already extracted
  if (!fs.existsSync(qoderBin)) {
    if (!fs.existsSync(debPath)) {
      info('Downloading Qoder Desktop...');
      run(`curl -L -o "${debPath}" "https://download.qoder.com/release/latest/qoder_amd64.deb"`, 120000);
    }

    if (fs.existsSync(debPath)) {
      info('Extracting...');
      run(`dpkg -x "${debPath}" "${desktopDir}/"`);
    }
  }

  if (!fs.existsSync(qoderBin)) {
    err('Qoder Desktop not found');
    return false;
  }
  ok('Qoder Desktop extracted');

  // Check dependencies
  const gtkLib = '/tmp/gtk3/usr/lib/x86_64-linux-gnu/libgtk-3.so.0';
  if (!fs.existsSync(gtkLib)) {
    info('Downloading GTK3...');
    run('curl -L -o /tmp/libgtk-3-0.deb "http://archive.ubuntu.com/ubuntu/pool/main/g/gtk+3.0/libgtk-3-0_3.24.33-1ubuntu2.2_amd64.deb"', 30000);
    run('dpkg -x /tmp/libgtk-3-0.deb /tmp/gtk3/');
  }

  const epoxyLib = '/tmp/deps/usr/lib/x86_64-linux-gnu/libepoxy.so.0';
  if (!fs.existsSync(epoxyLib)) {
    info('Downloading libepoxy...');
    run('curl -L -o /tmp/libepoxy0.deb "http://archive.ubuntu.com/ubuntu/pool/main/libe/libepoxy/libepoxy0_1.5.10-2build1_amd64.deb"', 15000);
    run('dpkg -x /tmp/libepoxy0.deb /tmp/deps/');
  }

  const xineramaLib = '/tmp/deps/usr/lib/x86_64-linux-gnu/libXinerama.so.1';
  if (!fs.existsSync(xineramaLib)) {
    info('Downloading libXinerama...');
    run('curl -L -o /tmp/libxinerama1.deb "http://archive.ubuntu.com/ubuntu/pool/main/libx/libxinerama/libxinerama1_1.1.4-3build1_amd64.deb"', 15000);
    run('dpkg -x /tmp/libxinerama1.deb /tmp/deps/');
  }

  // Check Xvfb
  if (!run('pgrep Xvfb')) {
    info('Starting Xvfb...');
    spawn('Xvfb', [':99', '-screen', '0', '1920x1080x24'], { detached: true, stdio: 'ignore' }).unref();
    await sleep(2000);
  }
  ok('Xvfb running on :99');

  // Verify LD_LIBRARY_PATH works
  const ldPath = '/tmp/gtk3/usr/lib/x86_64-linux-gnu:/tmp/deps/usr/lib/x86_64-linux-gnu:/tmp/qoder-desktop/usr/share/qoder';
  const missing = run(`LD_LIBRARY_PATH=${ldPath} ldd ${qoderBin} 2>&1 | grep "not found"`);
  if (missing) {
    warn(`Missing libs: ${missing.split('\n').join(', ')}`);
  } else {
    ok('All dependencies satisfied');
  }

  info(`Launch: DISPLAY=:99 LD_LIBRARY_PATH=${ldPath} ${qoderBin} --no-sandbox --disable-gpu`);
  info('Then open browser → Usage panel → Claim 800 Free Calls');

  return true;
}

// ============================================================
//  5. CLAIM GUIDE
// ============================================================
function showClaimGuide() {
  banner('5. CLAIM 800 FREE CALLS', c.grn);

  console.log(`  ${c.b}Option A: Desktop App (recommended)${c.r}`);
  console.log(`    1. Run: DISPLAY=:99 ${'/tmp/qoder-desktop/usr/share/qoder/qoder'} --no-sandbox`);
  console.log(`    2. Click "Sign in" → Google OAuth`);
  console.log(`    3. Open Usage panel → Click "Claim Now"`);
  console.log('');
  console.log(`  ${c.b}Option B: Local Machine${c.r}`);
  console.log(`    1. Download: https://qoder.com/download`);
  console.log(`    2. Install & login with respati1@bozztirex.us`);
  console.log(`    3. Usage panel → Claim 800 Free Calls`);
  console.log('');
  console.log(`  ${c.b}Promo Info:${c.r}`);
  const now = Date.now();
  const promoEnd = new Date('2026-09-03T23:59:59+08:00').getTime();
  const daysLeft = Math.ceil((promoEnd - now) / 86400000);
  console.log(`    ⏰ ${daysLeft} days left (until Sep 3, 2026)`);
  console.log(`    🎁 800 calls ≈ 80 tasks on Qwen3.8-Max`);
  console.log(`    📱 Claim on one platform, use everywhere`);
}

// ============================================================
//  RESULTS
// ============================================================
function showResults(results) {
  banner('RESULTS', c.grn);

  const items = [
    ['Qoder CLI', results.cli],
    ['Ollama API', results.ollama],
    ['Cline CLI', results.cline],
    ['Desktop', results.desktop],
  ];

  console.log(`  ${c.b}┌────────────────────────────────────────────┐${c.r}`);
  for (const [name, status] of items) {
    const icon = status ? `${c.grn}✅${c.r}` : `${c.red}❌${c.r}`;
    console.log(`  ${c.b}│${c.r}  ${icon} ${name.padEnd(20)} ${status ? 'Ready' : 'Needs attention'}`);
  }
  console.log(`  ${c.b}├────────────────────────────────────────────┤${c.r}`);
  console.log(`  ${c.b}│${c.r}  📁 Files:`);
  console.log(`  ${c.b}│${c.r}    accounts.txt      — Login credentials`);
  console.log(`  ${c.b}│${c.r}    ollama-key.txt    — Ollama API key`);
  console.log(`  ${c.b}│${c.r}    setup-all.js      — This script`);
  console.log(`  ${c.b}│${c.r}    claim-guide.md    — Claim instructions`);
  console.log(`  ${c.b}└────────────────────────────────────────────┘${c.r}`);
}

// ============================================================
//  MAIN
// ============================================================
(async () => {
  console.log(`\n${c.cyn}${c.b}╔══════════════════════════════════════════════════════╗`);
  console.log(`║  ⚡ ALL-IN-ONE SETUP — Qoder Ecosystem              ║`);
  console.log(`║  CLI + Ollama + Cline + Desktop + Claim Guide       ║`);
  console.log(`╚══════════════════════════════════════════════════════╝${c.r}`);

  const results = {
    cli: await setupQoderCli(),
    ollama: await setupOllama(),
    cline: await setupCline(),
    desktop: await setupDesktop(),
  };

  showClaimGuide();
  showResults(results);

  console.log(`\n${c.grn}${c.b}✅ Setup complete!${c.r}\n`);
})();
