#!/usr/bin/env node
// ============================================================
//  Qoder Manager — Interactive TUI
//  Menu-based interface for Qoder CLI + 800 Free Calls
// ============================================================

const inquirer = require('/home/work/.openclaw/tmp/node_modules/inquirer');
const { execSync, spawn } = require('child_process');
const puppeteer = require('/home/work/.openclaw/tmp/node_modules/puppeteer-extra');
const StealthPlugin = require('/home/work/.openclaw/tmp/node_modules/puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME;
const TMP = `${HOME}/.openclaw/tmp`;
const PATH = `${HOME}/.local/bin:${process.env.PATH}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ============================================================
//  Helpers
// ============================================================

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
  bgCyan: '\x1b[46m',
};

const logo = `
${c.cyan}${c.bold}  ╔══════════════════════════════════════════╗
  ║        ⚡ QODER MANAGER v1.0 ⚡          ║
  ║   Login • Claim • Test • Manage          ║
  ╚══════════════════════════════════════════╝${c.reset}
`;

function banner(text) {
  console.log(`\n${c.cyan}${c.bold}  ━━━ ${text} ━━━${c.reset}\n`);
}

function ok(msg) { console.log(`  ${c.green}✓${c.reset} ${msg}`); }
function err(msg) { console.log(`  ${c.red}✗${c.reset} ${msg}`); }
function info(msg) { console.log(`  ${c.blue}ℹ${c.reset} ${msg}`); }
function warn(msg) { console.log(`  ${c.yellow}!${c.reset} ${msg}`); }

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { 
      env: { ...process.env, PATH },
      encoding: 'utf-8',
      timeout: opts.timeout || 15000,
      ...opts
    }).trim();
  } catch (e) {
    return opts.fallback || null;
  }
}

function loadAccounts() {
  const file = path.join(process.cwd(), 'accounts.txt');
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
  return lines.map(line => {
    const [email, password] = line.split('|').map(s => s.trim());
    return { email, password };
  });
}

async function clickBtn(page, ...texts) {
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = (await page.evaluate(el => el.textContent, btn)).trim().toLowerCase();
    const disabled = await page.evaluate(el => el.disabled, btn);
    const visible = await page.evaluate(el => el.offsetParent !== null, btn);
    if (disabled || !visible) continue;
    for (const t of texts) {
      if (text.includes(t.toLowerCase())) {
        await btn.scrollIntoViewIfNeeded();
        await sleep(400);
        await btn.click();
        return true;
      }
    }
  }
  return false;
}

// ============================================================
//  Menu Actions
// ============================================================

async function checkStatus() {
  banner('STATUS');
  const status = run('qodercli status');
  if (!status) {
    err('Qoder CLI not found or not installed');
    return;
  }
  
  if (status.includes('Not logged in')) {
    warn('Not logged in');
  } else {
    console.log(status);
    ok('Logged in!');
  }
  
  // Check promo
  const now = Date.now();
  const promoEnd = new Date('2026-09-03T23:59:59+08:00').getTime();
  const daysLeft = Math.ceil((promoEnd - now) / 86400000);
  
  if (daysLeft > 0) {
    info(`Qwen3.8-Max promo: ${c.bold}${daysLeft} days left${c.reset} (ends 3 Sep 2026)`);
  } else {
    warn('Promo has ended');
  }
}

async function listModels() {
  banner('AVAILABLE MODELS');
  const models = run('qodercli --list-models');
  if (!models) {
    err('Not logged in or no models available');
    return;
  }
  console.log(models);
  
  if (models.includes('Qwen3.8-Max')) {
    ok('Qwen3.8-Max is available! 🎉');
  }
}

async function installCLI() {
  banner('INSTALL QODER CLI');
  
  if (run('qodercli --version')) {
    ok(`Already installed: ${run('qodercli --version')}`);
    const { reinstall } = await inquirer.prompt([{
      type: 'confirm',
      name: 'reinstall',
      message: 'Reinstall/update?',
      default: false
    }]);
    if (!reinstall) return;
  }
  
  info('Installing Qoder CLI...');
  const result = run('curl -fsSL https://qoder.com/install | bash', { timeout: 60000 });
  if (result !== null) {
    ok('Qoder CLI installed!');
  } else {
    err('Installation failed');
  }
}

async function loginCLI() {
  banner('LOGIN TO QODER');
  
  const accounts = loadAccounts();
  
  if (accounts.length === 0) {
    warn('No accounts found in accounts.txt');
    info('Create accounts.txt with format: email|password');
    
    const { addNow } = await inquirer.prompt([{
      type: 'confirm',
      name: 'addNow',
      message: 'Add account now?',
      default: true
    }]);
    
    if (addNow) {
      const { email, password } = await inquirer.prompt([
        { type: 'input', name: 'email', message: 'Email:' },
        { type: 'password', name: 'password', message: 'Password:' }
      ]);
      fs.writeFileSync('accounts.txt', `# Qoder Accounts\n${email}|${password}\n`);
      accounts.push({ email, password });
    } else {
      return;
    }
  }
  
  let account;
  if (accounts.length === 1) {
    account = accounts[0];
    info(`Using: ${account.email}`);
  } else {
    const { selected } = await inquirer.prompt([{
      type: 'list',
      name: 'selected',
      message: 'Select account:',
      choices: accounts.map(a => ({ name: a.email, value: a }))
    }]);
    account = selected;
  }
  
  info('Starting login flow...');
  info('Browser will open, login will complete automatically.\n');
  
  // Start CLI login
  const cliProcess = spawn('qodercli', ['login'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PATH }
  });

  let loginUrl = '';
  cliProcess.stdout.on('data', (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/qoder\.com\/device\/selectAccounts\?[^\s]+/);
    if (match) loginUrl = match[0];
    if (text.includes('Login successful')) {
      console.log(`  ${c.green}${c.bold}${text.trim()}${c.reset}`);
    }
  });
  cliProcess.stderr.on('data', (data) => {
    process.stdout.write(`  ${c.dim}${data}${c.reset}`);
  });

  // Wait for URL
  info('Waiting for login URL...');
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    if (loginUrl) break;
  }

  if (!loginUrl) {
    err('Failed to get login URL');
    cliProcess.kill();
    return;
  }

  ok('Got login URL, opening browser...');

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

    // Google login
    info('Clicking Google...');
    const gl = await page.$('a[href*="sso/login/google"]');
    if (gl) await gl.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await sleep(3000);

    info('Entering email...');
    let inp;
    try { inp = await page.waitForSelector('input[type="email"]', { timeout: 5000 }); }
    catch { inp = await page.waitForSelector('input[type="text"]', { timeout: 10000 }); }
    await inp.click({ clickCount: 3 });
    await inp.type(account.email, { delay: 60 });
    await sleep(1000);
    await page.keyboard.press('Enter');
    await sleep(5000);

    info('Entering password...');
    const pwd = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await pwd.click({ clickCount: 3 });
    await pwd.type(account.password, { delay: 60 });
    await sleep(1000);
    await page.keyboard.press('Enter');
    await sleep(5000);

    // Handle consent
    info('Handling consent...');
    for (let i = 0; i < 8; i++) {
      await sleep(2000);
      const url = page.url();
      if (url.includes('qoder.com') && !url.includes('sign-in') && !url.includes('selectAccounts')) break;
      if (url.includes('oauth/id') || url.includes('consent') || url.includes('signin/oauth')) {
        await clickBtn(page, 'lanjutkan', 'continue', 'allow', 'accept');
        await sleep(3000);
        continue;
      }
      if (url.includes('speedbump') || url.includes('workspacetermsofservice')) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await sleep(1000);
        await clickBtn(page, 'i understand', 'understand', 'next', 'continue', 'review');
        await sleep(3000);
        continue;
      }
      if (url.includes('selectAccounts') || url.includes('device/select')) {
        await clickBtn(page, 'continue', 'select', 'lanjutkan');
        await sleep(3000);
        continue;
      }
      break;
    }
  } catch (e) {
    err(`Browser error: ${e.message}`);
  }

  await browser.close();

  // Wait for CLI
  info('Waiting for CLI to detect login...');
  await Promise.race([
    new Promise(r => cliProcess.on('close', r)),
    sleep(20000)
  ]);
  cliProcess.kill();

  // Verify
  await sleep(2000);
  const status = run('qodercli status');
  if (status && !status.includes('Not logged in')) {
    ok('LOGIN SUCCESS! ✅');
    console.log(status);
  } else {
    err('Login may have failed — check manually');
  }
}

async function claimCalls() {
  banner('CLAIM 800 FREE CALLS');
  
  info('To claim your 800 free calls for Qwen3.8-Max:');
  console.log(`
  ${c.bold}Option 1 — Qoder Web:${c.reset}
    Open: ${c.cyan}https://qoder.com/account/usage${c.reset}
    Look for "Event Claims" or "Anniversary Promotion"
    Click "Claim" on the 800 calls offer

  ${c.bold}Option 2 — Qoder Desktop:${c.reset}
    Open Qoder Desktop → Settings → Usage
    Find the claim button

  ${c.bold}Option 3 — Qoder CLI:${c.reset}
    Run: ${c.cyan}qodercli${c.reset} (interactive mode)
    Check Usage/Status panel
  `);
  
  const { openBrowser } = await inquirer.prompt([{
    type: 'confirm',
    name: 'openBrowser',
    message: 'Open Qoder usage page in browser?',
    default: true
  }]);
  
  if (openBrowser) {
    info('Opening https://qoder.com/account/usage ...');
    run(`xdg-open "https://qoder.com/account/usage" 2>/dev/null || open "https://qoder.com/account/usage" 2>/dev/null || echo "Open manually: https://qoder.com/account/usage"`, { fallback: 'ok' });
  }
}

async function testModel() {
  banner('TEST QWEN3.8-MAX');
  
  const status = run('qodercli status');
  if (!status || status.includes('Not logged in')) {
    err('Not logged in! Please login first.');
    return;
  }
  
  const { prompt } = await inquirer.prompt([{
    type: 'input',
    name: 'prompt',
    message: 'Test prompt:',
    default: 'Hello! What model are you? Reply briefly.'
  }]);
  
  info('Sending to Qwen3.8-Max...\n');
  console.log(`${c.cyan}────────────────────────────────────────${c.reset}`);
  
  const result = run(`qodercli -p -m "Qwen3.8-Max" "${prompt.replace(/"/g, '\\"')}"`, { timeout: 60000 });
  
  console.log(`${c.cyan}────────────────────────────────────────${c.reset}`);
  
  if (result) {
    console.log(result);
    ok('Model responded!');
  } else {
    err('No response or timeout');
  }
}

async function manageAccounts() {
  banner('MANAGE ACCOUNTS');
  
  const file = path.join(process.cwd(), 'accounts.txt');
  const accounts = loadAccounts();
  
  if (accounts.length > 0) {
    info(`Found ${accounts.length} account(s):`);
    accounts.forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.email}`);
    });
  } else {
    warn('No accounts in accounts.txt');
  }
  
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'Action:',
    choices: [
      { name: '➕ Add account', value: 'add' },
      { name: '📋 View accounts', value: 'view' },
      { name: '🗑️  Clear all', value: 'clear' },
      { name: '← Back', value: 'back' }
    ]
  }]);
  
  switch (action) {
    case 'add': {
      const { email, password } = await inquirer.prompt([
        { type: 'input', name: 'email', message: 'Email:' },
        { type: 'password', name: 'password', message: 'Password:' }
      ]);
      const existing = accounts.map(a => `${a.email}|${a.password}`).join('\n');
      const content = existing ? `${existing}\n${email}|${password}\n` : `${email}|${password}\n`;
      fs.writeFileSync(file, `# Qoder Accounts\n${content}`);
      ok(`Added: ${email}`);
      break;
    }
    case 'view': {
      if (accounts.length === 0) {
        warn('No accounts');
      } else {
        accounts.forEach(a => {
          console.log(`  ${c.cyan}${a.email}${c.reset} | ${'*'.repeat(a.password.length)}`);
        });
      }
      break;
    }
    case 'clear': {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm', name: 'confirm', message: 'Clear all accounts?', default: false
      }]);
      if (confirm) {
        fs.writeFileSync(file, '# Qoder Accounts\n');
        ok('Cleared');
      }
      break;
    }
  }
}

async function fullSetup() {
  banner('FULL AUTO SETUP');
  
  info('This will:');
  console.log('  1. Install Qoder CLI (if needed)');
  console.log('  2. Login via Google OAuth');
  console.log('  3. List available models');
  console.log('  4. Show claim instructions');
  console.log('');
  
  const { proceed } = await inquirer.prompt([{
    type: 'confirm', name: 'proceed', message: 'Continue?', default: true
  }]);
  
  if (!proceed) return;
  
  await installCLI();
  await loginCLI();
  await listModels();
  await claimCalls();
}

// ============================================================
//  Main Menu
// ============================================================

async function mainMenu() {
  console.clear();
  console.log(logo);
  
  // Quick status
  const status = run('qodercli status', { fallback: '' });
  if (status && !status.includes('Not logged in')) {
    const email = status.match(/Email:\s*(.+)/)?.[1] || 'unknown';
    console.log(`  ${c.green}●${c.reset} Logged in as: ${c.bold}${email}${c.reset}`);
  } else {
    console.log(`  ${c.red}●${c.reset} Not logged in`);
  }
  
  // Promo status
  const now = Date.now();
  const promoEnd = new Date('2026-09-03T23:59:59+08:00').getTime();
  const daysLeft = Math.ceil((promoEnd - now) / 86400000);
  if (daysLeft > 0) {
    console.log(`  ${c.yellow}●${c.reset} Qwen3.8-Max promo: ${c.bold}${daysLeft} days left${c.reset}`);
  }
  console.log('');

  const { menu } = await inquirer.prompt([{
    type: 'list',
    name: 'menu',
    message: 'Select action:',
    pageSize: 12,
    choices: [
      { name: '🚀 Full Auto Setup (install + login + claim)', value: 'full' },
      new inquirer.Separator(),
      { name: '📦 Install Qoder CLI', value: 'install' },
      { name: '🔐 Login via Google OAuth', value: 'login' },
      { name: '📊 Check Status', value: 'status' },
      { name: '📋 List Models', value: 'models' },
      { name: '🎁 Claim 800 Free Calls', value: 'claim' },
      { name: '🧪 Test Qwen3.8-Max', value: 'test' },
      new inquirer.Separator(),
      { name: '👤 Manage Accounts', value: 'accounts' },
      { name: '❌ Exit', value: 'exit' }
    ]
  }]);

  switch (menu) {
    case 'full': await fullSetup(); break;
    case 'install': await installCLI(); break;
    case 'login': await loginCLI(); break;
    case 'status': await checkStatus(); break;
    case 'models': await listModels(); break;
    case 'claim': await claimCalls(); break;
    case 'test': await testModel(); break;
    case 'accounts': await manageAccounts(); break;
    case 'exit':
      console.log(`\n${c.cyan}Bye! 👋${c.reset}\n`);
      process.exit(0);
  }

  // Return to menu
  console.log('');
  const { again } = await inquirer.prompt([{
    type: 'confirm',
    name: 'again',
    message: 'Back to menu?',
    default: true
  }]);
  
  if (again) {
    mainMenu();
  } else {
    console.log(`\n${c.cyan}Bye! 👋${c.reset}\n`);
  }
}

// ============================================================
//  Start
// ============================================================

mainMenu().catch(err => {
  console.error(`\n${c.red}Error: ${err.message}${c.reset}`);
  process.exit(1);
});
