#!/usr/bin/env node
// Non-interactive: Qoder login + Ollama API key creation
const puppeteer = require('./node_modules/puppeteer-extra');
const StealthPlugin = require('./node_modules/puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const { execSync, spawn } = require('child_process');
const fs = require('fs');

const HOME = process.env.HOME;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROME = `${HOME}/.cache/puppeteer/chrome/linux-151.0.7922.71/chrome-linux64/chrome`;
const EMAIL = 'respati1@bozztirex.us';
const PASS = 'Daffa112233';

const c = {
  r: '\x1b[0m', b: '\x1b[1m',
  red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m',
  blu: '\x1b[34m', cyn: '\x1b[36m', mag: '\x1b[35m',
};

function ok(m) { console.log(`  ${c.grn}✔${c.r} ${m}`); }
function err(m) { console.log(`  ${c.red}✘${c.r} ${m}`); }
function info(m) { console.log(`  ${c.blu}ℹ${c.r} ${m}`); }

async function launchBrowser() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,900']
  });
}

async function googleLogin(page) {
  info('Google OAuth...');
  // Email
  try {
    await page.waitForSelector('#identifierId', { timeout: 8000 });
    await page.click('#identifierId', { clickCount: 3 });
    await page.type('#identifierId', EMAIL, { delay: 60 });
    await sleep(800);
    await page.keyboard.press('Enter');
    await sleep(5000);
  } catch {
    // fallback
    const inp = await page.$('input[type="text"]');
    if (inp) {
      await inp.click({ clickCount: 3 });
      await inp.type(EMAIL, { delay: 60 });
      await sleep(800);
      await page.keyboard.press('Enter');
      await sleep(5000);
    }
  }

  // Password
  try {
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.click('input[type="password"]', { clickCount: 3 });
    await page.type('input[type="password"]', PASS, { delay: 60 });
    await sleep(800);
    await page.keyboard.press('Enter');
    await sleep(8000);
  } catch {}

  // Consent / speedbump loops
  for (let i = 0; i < 10; i++) {
    await sleep(2000);
    const url = page.url();
    if (url.includes('speedbump') || url.includes('workspacetermsofservice')) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(1000);
      const clicked = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        for (const b of btns) {
          const t = b.textContent.toLowerCase();
          if (t.includes('i understand') || t.includes('next') || t.includes('continue')) { b.click(); return t; }
        }
        return null;
      });
      if (clicked) info(`Speedbump: clicked "${clicked}"`);
      await sleep(3000);
      continue;
    }
    if (url.includes('consent') || url.includes('oauth') || url.includes('accounts.google.com')) {
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        for (const b of btns) {
          const t = b.textContent.toLowerCase();
          if (t.includes('lanjutkan') || t.includes('continue') || t.includes('allow') || t.includes('accept')) { b.click(); return t; }
        }
        return null;
      });
      await sleep(3000);
      continue;
    }
    break;
  }
}

// ============================================================
//  TASK 1: QODER LOGIN
// ============================================================
async function taskQoder() {
  console.log(`\n${c.cyn}${c.b}═══ TASK 1: QODER LOGIN ═══${c.r}\n`);

  // Check CLI
  let ver = null;
  try { ver = execSync('qodercli --version', { encoding: 'utf-8', timeout: 5000 }).trim(); } catch {}
  if (!ver) {
    info('Installing Qoder CLI...');
    try {
      execSync('curl -fsSL https://qoder.com/install | bash', { encoding: 'utf-8', timeout: 60000, stdio: 'pipe' });
      ver = execSync('qodercli --version', { encoding: 'utf-8', timeout: 5000 }).trim();
    } catch { err('Qoder CLI install failed'); return null; }
  }
  ok(`Qoder CLI ${ver}`);

  // Check if already logged in
  try {
    const status = execSync('qodercli status', { encoding: 'utf-8', timeout: 10000 }).trim();
    if (!status.includes('Not logged in')) {
      ok(`Already logged in: ${status}`);
      return 'already_logged_in';
    }
  } catch {}

  // Start CLI login
  info('Starting CLI login...');
  const cliProc = spawn('qodercli', ['login'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PATH: `${HOME}/.local/bin:${process.env.PATH}` }
  });

  let loginUrl = '';
  cliProc.stdout.on('data', d => {
    const text = d.toString();
    const m = text.match(/https:\/\/qoder\.com\/device\/selectAccounts\?[^\s]+/);
    if (m) loginUrl = m[0];
    if (text.includes('Login successful')) ok('CLI detected login!');
  });
  cliProc.stderr.on('data', d => {
    const text = d.toString();
    const m = text.match(/https:\/\/qoder\.com\/device\/selectAccounts\?[^\s]+/);
    if (m) loginUrl = m[0];
  });

  // Wait for URL
  for (let i = 0; i < 30; i++) { await sleep(500); if (loginUrl) break; }
  if (!loginUrl) { err('No login URL from CLI'); cliProc.kill(); return null; }
  info(`Login URL: ${loginUrl}`);

  // Browser OAuth
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    // Click Google
    info('Clicking Google login...');
    await page.evaluate(() => {
      const links = document.querySelectorAll('a, button');
      for (const l of links) {
        const t = (l.textContent || '').toLowerCase();
        if (t.includes('google')) { l.click(); return; }
      }
    });
    await sleep(6000);

    await googleLogin(page);

    // Check if redirected back to Qoder
    for (let i = 0; i < 10; i++) {
      await sleep(2000);
      const url = page.url();
      if (url.includes('qoder.com') && !url.includes('sign-in') && !url.includes('selectAccounts')) {
        ok('Redirected to Qoder!');
        break;
      }
    }
  } catch (e) {
    err(`Qoder browser error: ${e.message}`);
  }

  await browser.close();

  // Wait for CLI to detect
  await Promise.race([
    new Promise(r => cliProc.on('close', r)),
    sleep(15000)
  ]);
  cliProc.kill();
  await sleep(2000);

  // Verify
  try {
    const status = execSync('qodercli status', { encoding: 'utf-8', timeout: 10000 }).trim();
    if (!status.includes('Not logged in')) {
      ok(`Qoder LOGIN SUCCESS: ${status}`);
      return 'success';
    }
  } catch {}

  err('Qoder login could not be verified');
  return 'unverified';
}

// ============================================================
//  TASK 2: OLLAMA API KEY
// ============================================================
async function taskOllama() {
  console.log(`\n${c.mag}${c.b}═══ TASK 2: OLLAMA API KEY ═══${c.r}\n`);

  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  let apiKey = null;

  try {
    // Login
    info('Opening Ollama...');
    await page.goto('https://ollama.com/signin', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    info('Clicking Google login...');
    await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const l of links) { if (l.href && l.href.includes('Google')) { l.click(); return; } }
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await sleep(5000);

    await googleLogin(page);

    // Wait for ollama.com redirect
    info('Waiting for Ollama redirect...');
    for (let i = 0; i < 15; i++) {
      await sleep(2000);
      const url = page.url();
      if (url.includes('ollama.com') && !url.includes('signin') && !url.includes('auth')) {
        ok('Ollama LOGIN SUCCESS!');
        break;
      }
    }

    // Navigate to API keys
    info('Opening API keys page...');
    await page.goto('https://ollama.com/settings/keys', { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(3000);

    // Take debug screenshot
    await page.screenshot({ path: 'ollama-keys-page.png' });
    info('Debug screenshot: ollama-keys-page.png');

    // Click "Create" or "Add API Key"
    info('Creating new API key...');
    const clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button, a')];
      for (const b of btns) {
        const t = (b.textContent || '').toLowerCase();
        if (t.includes('create') || t.includes('add') || t.includes('new api key') || t.includes('generate')) {
          b.click();
          return t;
        }
      }
      return null;
    });
    if (clicked) info(`Clicked: "${clicked}"`);
    await sleep(3000);

    // If there's a name input, type a name
    try {
      const nameInput = await page.$('input[type="text"], input[name="name"]');
      if (nameInput) {
        await nameInput.type('mimo-agent-key', { delay: 40 });
        await sleep(500);
      }
    } catch {}

    // Click Generate/Create/Submit
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      for (const b of btns) {
        const t = (b.textContent || '').toLowerCase();
        if (t.includes('generate') || t.includes('create') || t.includes('submit') || t.includes('save')) {
          b.click();
          return t;
        }
      }
      return null;
    });
    await sleep(5000);

    // Extract key
    apiKey = await page.evaluate(() => {
      // Try hidden input first
      const inp = document.querySelector('input[name="api-key-string"]');
      if (inp && inp.value) return inp.value;
      // Try code/pre elements
      const codes = document.querySelectorAll('code, pre, [class*="key"], [class*="token"]');
      for (const el of codes) {
        const t = el.textContent.trim();
        if (t.length > 20 && !t.includes(' ')) return t;
      }
      return null;
    });

    await page.screenshot({ path: 'ollama-key-created.png' });

    if (apiKey) {
      ok(`API Key: ${apiKey.substring(0, 15)}...${apiKey.substring(apiKey.length - 4)}`);
      fs.writeFileSync('ollama-key.txt', `Ollama API Key\nAccount: ${EMAIL}\nKey: ${apiKey}\n\nUsage:\ncurl -X POST "https://ollama.com/api/chat" \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": "gpt-oss:20b", "messages": [{"role": "user", "content": "Hello"}], "stream": false}'\n`);
      ok('Saved to ollama-key.txt');

      // Test
      info('Testing API...');
      try {
        const result = execSync(`curl -sL -X POST "https://ollama.com/api/chat" -H "Authorization: Bearer ${apiKey}" -H "Content-Type: application/json" -d '{"model": "gpt-oss:20b", "messages": [{"role": "user", "content": "Say hello in one word"}], "stream": false}'`, { encoding: 'utf-8', timeout: 30000 });
        const parsed = JSON.parse(result);
        if (parsed.message?.content) {
          ok(`API Test: "${parsed.message.content.substring(0, 80)}"`);
        } else if (parsed.error) {
          err(`API Error: ${JSON.stringify(parsed.error)}`);
        }
      } catch (e) {
        err(`API test failed: ${e.message}`);
      }
    } else {
      err('Could not extract API key from page');
    }

  } catch (e) {
    err(`Ollama error: ${e.message}`);
  }

  await browser.close();
  return apiKey;
}

// ============================================================
//  MAIN
// ============================================================
(async () => {
  console.log(`\n${c.b}${c.cyn}╔════════════════════════════════════════════════╗`);
  console.log(`║  ⚡ MIMO AGENT — FULL AUTO SETUP ⚡           ║`);
  console.log(`║  1. Qoder Login                                ║`);
  console.log(`║  2. Ollama API Key                             ║`);
  console.log(`╚════════════════════════════════════════════════╝${c.r}\n`);

  const qoderResult = await taskQoder();
  const ollamaResult = await taskOllama();

  // Summary
  console.log(`\n${c.grn}${c.b}╔════════════════════════════════════════════════╗`);
  console.log(`║  📊 RESULTS                                    ║`);
  console.log(`╠════════════════════════════════════════════════╣`);
  console.log(`║  Qoder:   ${(qoderResult === 'success' || qoderResult === 'already_logged_in') ? '✅ ' + qoderResult : '❌ failed'}${''.padEnd(30 - (qoderResult || 'failed').length)}║`);
  console.log(`║  Ollama:  ${ollamaResult ? '✅ Key obtained' : '❌ failed'}${''.padEnd(20)}║`);
  console.log(`╚════════════════════════════════════════════════╝${c.r}\n`);
})();
