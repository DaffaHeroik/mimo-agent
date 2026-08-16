const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const CHROME_PATH = '/tmp/chrome-dir/chrome';
const INVITE = 'TH-653T-4B6A';

// ========== ACCOUNTS ==========
const ACCOUNTS = [
  { email: 'josef1@bekri.site', password: 'Daffa112233' },
  // { email: 'josef2@bekri.site', password: 'Daffa112233' },
  // { email: 'josef3@bekri.site', password: 'Daffa112233' },
  // { email: 'josef4@bekri.site', password: 'Daffa112233' },
  // { email: 'josef5@bekri.site', password: 'Daffa112233' },
  // { email: 'josef6@bekri.site', password: 'Daffa112233' },
  // { email: 'josef7@bekri.site', password: 'Daffa112233' },
  // { email: 'josef8@bekri.site', password: 'Daffa112233' },
  // { email: 'josef9@bekri.site', password: 'Daffa112233' },
  // { email: 'josef10@bekri.site', password: 'Daffa112233' },
];
// ===============================

const delay = ms => new Promise(r => setTimeout(r, ms));

async function processAccount(account) {
  const { email, password } = account;
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Processing: ${email}`);
  console.log(`${'='.repeat(50)}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    // Step 1: Go to TokenHarbor
    console.log(`  [1] Opening TokenHarbor...`);
    await page.goto(`https://tokenharbor.ai/login?invite=${INVITE}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);

    // Handle cookie consent
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Essential only'));
      if (btn) btn.click();
    });
    await delay(1000);

    // Step 2: Click "Continue with Google"
    console.log(`  [2] Clicking Continue with Google...`);
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Continue with Google'));
      if (btn) btn.click();
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await delay(3000);

    let url = page.url();

    // Step 3: Google OAuth
    if (url.includes('accounts.google.com')) {
      // Account chooser
      const hasChooser = await page.evaluate(() => document.body.innerText.includes('Pilih akun') || document.body.innerText.includes('Choose an account'));
      if (hasChooser) {
        console.log(`  [3] Selecting account...`);
        await page.evaluate((email) => {
          const btns = Array.from(document.querySelectorAll('button, div'));
          const btn = btns.find(b => b.textContent.includes(email));
          if (btn) btn.click();
        }, email);
        await delay(5000);
      }

      // Enter email if needed
      const emailInput = await page.$('#identifierId');
      if (emailInput) {
        console.log(`  [3] Entering email...`);
        await emailInput.type(email, { delay: 30 });
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
          if (btn) btn.click();
        });
        await delay(5000);
      }

      // Enter password if needed
      const passField = await page.$('input[type="password"]');
      if (passField) {
        console.log(`  [3] Entering password...`);
        await passField.click();
        await passField.type(password, { delay: 30 });
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
          if (btn) btn.click();
        });
        await delay(5000);
      }

      // Handle consent
      console.log(`  [4] Handling consent...`);
      for (let i = 0; i < 10; i++) {
        url = page.url();
        if (url.includes('tokenharbor')) break;

        const clicked = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          for (const btn of btns) {
            const t = btn.textContent.trim();
            if (t === 'Lanjutkan' || t === 'Continue' || t === 'Izinkan' || t === 'Allow' || t === 'Confirm') {
              btn.click();
              return t;
            }
          }
          return null;
        });
        if (clicked) { console.log(`    Clicked: ${clicked}`); await delay(3000); }
        else await delay(2000);
      }
    }

    // Step 4: Finish setup
    url = page.url();
    console.log(`  [5] URL: ${url.substring(0, 60)}`);

    if (url.includes('tokenharbor')) {
      // Click "Finish and start chatting" if present
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Finish'));
        if (btn) btn.click();
      });
      await delay(3000);
    }

    // Step 5: Verify email
    console.log(`  [6] Verifying email...`);
    
    // Click "Verify email" button on dashboard
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Verify email'));
      if (btn) btn.click();
    });
    await delay(3000);

    // Open Gmail to get verification link
    const gmailPage = await browser.newPage();
    await gmailPage.setViewport({ width: 1280, height: 900 });
    await gmailPage.goto('https://mail.google.com', { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(5000);

    const gmailUrl = gmailPage.url();
    if (gmailUrl.includes('accounts.google.com')) {
      // Login to Gmail
      await gmailPage.waitForSelector('#identifierId', { timeout: 10000 });
      await gmailPage.type('#identifierId', email, { delay: 30 });
      await gmailPage.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
        if (btn) btn.click();
      });
      await delay(5000);

      const passField = await gmailPage.$('input[type="password"]');
      if (passField) {
        await passField.click();
        await passField.type(password, { delay: 30 });
        await gmailPage.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
          if (btn) btn.click();
        });
        await delay(5000);
      }

      // Consent
      await gmailPage.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent.trim() === 'Lanjutkan' || b.textContent.trim() === 'Continue'
        );
        if (btn) btn.click();
      });
      await delay(5000);
    }

    // Search for TokenHarbor email
    console.log(`  [6] Searching for verification email...`);
    await delay(3000);
    
    const searchBox = await gmailPage.$('input[aria-label="Search"], input[name="q"]');
    if (searchBox) {
      await searchBox.click();
      await searchBox.type('tokenharbor', { delay: 30 });
      await gmailPage.keyboard.press('Enter');
      await delay(5000);
    }

    // Click on verification email
    await gmailPage.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr, div[role="row"], z'));
      const row = rows.find(r => r.textContent.includes('Token Harbor') || r.textContent.includes('Verify'));
      if (row) row.click();
    });
    await delay(3000);

    // Click verify link
    const verifyClicked = await gmailPage.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const verify = links.find(l => l.textContent.includes('Verify email') || l.href.includes('verify'));
      if (verify) { verify.click(); return true; }
      return false;
    });
    console.log(`  [6] Verify link clicked: ${verifyClicked}`);
    await delay(5000);

    // Check if verification opened in a new tab
    const pages = await browser.pages();
    const verifyPage = pages[pages.length - 1];
    if (verifyPage !== page) {
      await delay(5000);
      console.log(`  [6] Verify page URL: ${verifyPage.url()}`);
    }

    await gmailPage.close();

    // Step 6: Enable free models
    console.log(`  [7] Enabling free models...`);
    await page.goto('https://tokenharbor.ai/dashboard', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await delay(3000);

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Enable free models'));
      if (btn) btn.click();
    });
    await delay(2000);

    // Also toggle the switch if button didn't work
    await page.evaluate(() => {
      const toggle = document.querySelector('input[type="checkbox"], [role="switch"]');
      if (toggle && !toggle.checked) toggle.click();
    });
    await delay(1000);

    // Step 7: Create API key
    console.log(`  [8] Creating API key...`);
    await page.goto('https://tokenharbor.ai/dashboard/api-keys', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await delay(3000);

    // Click + New key
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New key'));
      if (btn) btn.click();
    });
    await delay(2000);

    // Fill label
    const labelInput = await page.$('input[placeholder*="Cursor"], input[placeholder*="label"], input[type="text"]');
    if (labelInput) {
      await labelInput.click();
      await labelInput.type(`key-${Date.now()}`, { delay: 30 });
    }
    await delay(500);

    // Click Create key
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Create key'));
      if (btn) btn.click();
    });
    await delay(3000);

    // Extract API key
    let apiKey = await page.evaluate(() => {
      const match = document.body.innerText.match(/thk_live_[\w-]+/);
      return match ? match[0] : null;
    });

    if (apiKey) {
      console.log(`  [9] ✅ SUCCESS! API Key: ${apiKey}`);
      await browser.close();
      return { email, success: true, key: apiKey };
    }

    // Try Show plaintext
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Show plaintext'));
      if (btn) btn.click();
    });
    await delay(2000);

    apiKey = await page.evaluate(() => {
      const match = document.body.innerText.match(/thk_live_[\w-]+/);
      return match ? match[0] : null;
    });

    if (apiKey) {
      console.log(`  [9] ✅ SUCCESS! API Key: ${apiKey}`);
      await browser.close();
      return { email, success: true, key: apiKey };
    }

    console.log(`  [9] ❌ Could not extract API key`);
    await browser.close();
    return { email, success: false, error: 'KEY_NOT_FOUND' };

  } catch (err) {
    console.error(`  [ERROR] ${err.message}`);
    await browser.close();
    return { email, success: false, error: err.message };
  }
}

// Main
(async () => {
  console.log(`TokenHarbor Full Registration (Google OAuth + Verify + API Key)`);
  console.log(`Accounts: ${ACCOUNTS.length}\n`);

  const results = [];
  for (const account of ACCOUNTS) {
    const result = await processAccount(account);
    results.push(result);
    console.log(result.success ? `\n✅ ${result.email}|${result.key}` : `\n❌ ${result.email}|${result.error}`);
    if (ACCOUNTS.indexOf(account) < ACCOUNTS.length - 1) {
      console.log(`Waiting 5s...`);
      await delay(5000);
    }
  }

  console.log(`\n${'='.repeat(50)}\nSUMMARY\n${'='.repeat(50)}`);
  for (const r of results) {
    console.log(`${r.success ? '✅' : '❌'} ${r.email}|${r.key || r.error}`);
  }
})();
