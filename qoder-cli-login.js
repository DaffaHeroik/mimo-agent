const puppeteer = require('/home/work/.openclaw/tmp/node_modules/puppeteer-extra');
const StealthPlugin = require('/home/work/.openclaw/tmp/node_modules/puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const TMP = '/home/work/.openclaw/tmp';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadAccounts(file) {
  const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
  return lines.map(line => {
    const [email, password] = line.split('|').map(s => s.trim());
    return { email, password };
  });
}

async function clickVisibleButton(page, ...texts) {
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const btnText = (await page.evaluate(el => el.textContent, btn)).trim().toLowerCase();
    const disabled = await page.evaluate(el => el.disabled, btn);
    const visible = await page.evaluate(el => el.offsetParent !== null, btn);
    if (disabled || !visible) continue;
    for (const t of texts) {
      if (btnText.includes(t.toLowerCase())) {
        await btn.scrollIntoViewIfNeeded();
        await sleep(500);
        await btn.click();
        console.log(`    [✓] Clicked: "${btnText}"`);
        return true;
      }
    }
  }
  return false;
}

(async () => {
  const accountsFile = process.argv[2] || 'accounts.txt';
  if (!fs.existsSync(accountsFile)) {
    console.error(`[✗] File not found: ${accountsFile}`);
    process.exit(1);
  }

  const accounts = loadAccounts(accountsFile);
  console.log(`[INFO] Loaded ${accounts.length} account(s)\n`);

  for (const { email, password } of accounts) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[▶] ${email}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // ===== STEP 1: Start qodercli login in background =====
    console.log('\n[1] Starting qodercli login...');
    const cliProcess = spawn('qodercli', ['login'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}` }
    });

    let loginUrl = '';
    let urlFound = false;

    // Capture CLI output to get login URL
    cliProcess.stdout.on('data', (data) => {
      const text = data.toString();
      process.stdout.write(`  [CLI] ${text}`);
      const match = text.match(/https:\/\/qoder\.com\/device\/selectAccounts\?[^\s]+/);
      if (match) {
        loginUrl = match[0];
        urlFound = true;
      }
    });

    cliProcess.stderr.on('data', (data) => {
      process.stdout.write(`  [CLI] ${data}`);
    });

    // Wait for URL to appear
    console.log('  Waiting for login URL...');
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      if (urlFound) break;
    }

    if (!loginUrl) {
      console.error('[✗] Failed to get login URL');
      cliProcess.kill();
      continue;
    }

    console.log(`\n[✓] Got login URL: ${loginUrl.substring(0, 80)}...`);

    // ===== STEP 2: Complete OAuth in browser =====
    console.log('\n[2] Opening browser for OAuth...');

    const browser = await puppeteer.launch({
      executablePath: process.env.HOME + '/.local/chrome/chrome',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    try {
      // Open Qoder device auth page
      await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2000);

      // Click "Sign in with Google"
      console.log('[3] Clicking Google...');
      const googleLink = await page.$('a[href*="sso/login/google"]');
      if (googleLink) await googleLink.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await sleep(3000);

      // Enter email
      console.log('[4] Entering email...');
      let emailInput;
      try { emailInput = await page.waitForSelector('input[type="email"]', { timeout: 5000 }); }
      catch { emailInput = await page.waitForSelector('input[type="text"]', { timeout: 10000 }); }
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(email, { delay: 60 });
      await sleep(1000);
      await page.keyboard.press('Enter');
      await sleep(5000);

      // Enter password
      console.log('[5] Entering password...');
      const pwdInput = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
      await pwdInput.click({ clickCount: 3 });
      await pwdInput.type(password, { delay: 60 });
      await sleep(1000);
      await page.keyboard.press('Enter');
      await sleep(5000);

      // Handle consent/speedbump
      console.log('[6] Handling post-login flow...');
      for (let i = 0; i < 10; i++) {
        await sleep(2000);
        const url = page.url();
        
        // Check if we're back on Qoder (device authorized)
        if (url.includes('qoder.com') && !url.includes('sign-in') && !url.includes('selectAccounts')) {
          console.log('[✅] Authorized on Qoder!');
          break;
        }
        
        // Still on device select page - need to select account
        if (url.includes('selectAccounts') || url.includes('device/select')) {
          console.log('  → Device select page, clicking account...');
          // Look for account card/button
          const accountCards = await page.$$('[class*="account"], [class*="card"], [class*="select"]');
          for (const card of accountCards) {
            const text = await page.evaluate(el => el.textContent, card);
            if (text.includes(email) || text.includes('Continue') || text.includes('Select')) {
              await card.click();
              console.log(`    [✓] Clicked account card`);
              break;
            }
          }
          // Also try clicking any button
          await clickVisibleButton(page, 'continue', 'select', 'lanjutkan', 'pilih', 'confirm');
          await sleep(3000);
          continue;
        }
        
        if (url.includes('oauth/id') || url.includes('consent') || url.includes('signin/oauth')) {
          console.log('  → Consent page...');
          await clickVisibleButton(page, 'lanjutkan', 'continue', 'allow', 'accept', 'confirm');
          await sleep(3000);
          continue;
        }
        
        if (url.includes('speedbump') || url.includes('workspacetermsofservice')) {
          console.log('  → Speedbump...');
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await sleep(1000);
          await clickVisibleButton(page, 'i understand', 'understand', 'next', 'continue', 'review terms', 'review');
          await sleep(3000);
          continue;
        }
        
        if (url.includes('challenge/pwd')) {
          console.log('  → Re-entering password...');
          const pwd2 = await page.$('input[type="password"]');
          if (pwd2) {
            await pwd2.click({ clickCount: 3 });
            await pwd2.type(password, { delay: 60 });
            await sleep(500);
            await page.keyboard.press('Enter');
            await sleep(5000);
          }
          continue;
        }
        
        if (url.includes('challenge/')) {
          console.log('  → Challenge detected, waiting...');
          await sleep(5000);
          continue;
        }
        
        break;
      }

    } catch (err) {
      console.error(`[✗] Browser error: ${err.message}`);
    }

    await browser.close();

    // ===== STEP 3: Wait for CLI to detect authorization =====
    console.log('\n[7] Waiting for CLI to detect authorization...');
    
    // Wait for CLI process to complete (it should detect the auth)
    let cliExitCode = null;
    const cliPromise = new Promise((resolve) => {
      cliProcess.on('close', (code) => {
        cliExitCode = code;
        resolve();
      });
    });

    // Wait up to 30 seconds
    await Promise.race([cliPromise, sleep(30000)]);
    
    if (cliExitCode === null) {
      console.log('[!] CLI still waiting, killing...');
      cliProcess.kill();
    }

    // ===== STEP 4: Verify login =====
    console.log('\n[8] Verifying login...');
    await sleep(2000);
    
    try {
      const status = execSync('qodercli status', { 
        env: { ...process.env, PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}` },
        encoding: 'utf-8'
      });
      console.log(`\n${status}`);
      
      if (status.toLowerCase().includes('not logged in')) {
        console.log(`[✗] ${email} — Login FAILED`);
      } else {
        console.log(`[✅] ${email} — CLI Login SUCCESS!`);
        
        // List models
        console.log('\n[9] Available models:');
        try {
          const models = execSync('qodercli --list-models', {
            env: { ...process.env, PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}` },
            encoding: 'utf-8',
            timeout: 15000
          });
          console.log(models);
        } catch (e) {
          console.log('[!] Could not list models');
        }
      }
    } catch (err) {
      console.error(`[✗] Status check error: ${err.message}`);
    }

    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[DONE]');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
})();
