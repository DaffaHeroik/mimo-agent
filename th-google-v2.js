const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const CHROME_PATH = '/tmp/chrome-dir/chrome';
const INVITE = 'TH-653T-4B6A';

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
    console.log(`  [2] Handling cookies...`);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const essential = btns.find(b => b.textContent.includes('Essential only'));
      if (essential) essential.click();
    });
    await delay(1000);

    // Make sure we're on "Sign up" tab (not "Sign in")
    console.log(`  [3] Clicking Sign up tab...`);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const signup = btns.find(b => b.textContent.trim() === 'Sign up');
      if (signup) signup.click();
    });
    await delay(2000);

    // Step 2: Click "Continue with Google"
    console.log(`  [4] Clicking Continue with Google...`);
    const googleClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Continue with Google'));
      if (btn) { btn.click(); return true; }
      // Fallback: find by aria-label or other attributes
      const allBtns = document.querySelectorAll('button, [role="button"]');
      for (const b of allBtns) {
        if (b.textContent.includes('Google')) { b.click(); return true; }
      }
      return false;
    });
    console.log(`  [4] Google clicked: ${googleClicked}`);

    if (!googleClicked) {
      await page.screenshot({ path: `th-nobutton-${email.split('@')[0]}.png` });
      await browser.close();
      return { email, success: false, error: 'NO_GOOGLE_BUTTON' };
    }

    // Wait for Google OAuth page
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await delay(3000);

    let url = page.url();
    console.log(`  [5] URL: ${url.substring(0, 80)}`);

    // Step 3: Google OAuth
    if (url.includes('accounts.google.com')) {
      // Check if "Choose an account" page
      const hasChooser = await page.evaluate(() => document.body.innerText.includes('Choose an account'));
      
      if (hasChooser) {
        console.log(`  [6] Account chooser detected...`);
        // Check if our email is listed
        const hasEmail = await page.evaluate((email) => document.body.innerText.includes(email), email);
        
        if (hasEmail) {
          // Click on our account
          await page.evaluate((email) => {
            const els = Array.from(document.querySelectorAll('div, span, li'));
            const el = els.find(e => e.textContent.includes(email) && e.offsetParent !== null);
            if (el) el.click();
          }, email);
          await delay(3000);
        }
      }

      // Check if we need to enter email
      const emailInput = await page.$('#identifierId, input[type="email"]');
      if (emailInput) {
        console.log(`  [6] Entering email...`);
        await emailInput.click();
        await emailInput.type(email, { delay: 30 });
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
          if (btn) btn.click();
        });
        await delay(5000);
      }

      // Check for error
      const errText = await page.evaluate(() => document.body.innerText);
      if (errText.includes("Couldn't sign you in") || errText.includes("update to the latest")) {
        console.log(`  [7] ❌ Google blocked sign-in`);
        await page.screenshot({ path: `th-gblocked-${email.split('@')[0]}.png` });
        await browser.close();
        return { email, success: false, error: 'GOOGLE_BLOCKED' };
      }

      // Enter password
      const passField = await page.$('input[type="password"]');
      if (passField) {
        console.log(`  [7] Entering password...`);
        await passField.click();
        await passField.type(password, { delay: 30 });
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
          if (btn) btn.click();
        });
        await delay(5000);
      }

      // Handle consent/continue
      console.log(`  [8] Handling consent...`);
      for (let i = 0; i < 8; i++) {
        url = page.url();
        if (url.includes('tokenharbor')) {
          console.log(`  [8] ✅ Back on TokenHarbor!`);
          break;
        }

        const clicked = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          for (const btn of btns) {
            const t = btn.textContent.trim();
            if (t === 'Lanjutkan' || t === 'Continue' || t === 'Allow' || t === 'Confirm') {
              btn.click();
              return t;
            }
          }
          return null;
        });

        if (clicked) {
          console.log(`  [8] Clicked: ${clicked}`);
          await delay(3000);
        } else {
          await delay(2000);
        }
      }
    }

    // Step 4: Check TokenHarbor status
    await delay(3000);
    url = page.url();
    console.log(`  [9] Final URL: ${url.substring(0, 80)}`);
    await page.screenshot({ path: `th-result-${email.split('@')[0]}.png` });

    if (!url.includes('tokenharbor')) {
      console.log(`  [9] ❌ Not on TokenHarbor`);
      await browser.close();
      return { email, success: false, error: 'NO_REDIRECT' };
    }

    const pageText = await page.evaluate(() => document.body.innerText);
    
    if (pageText.includes('suspended') || pageText.includes('Suspended')) {
      console.log(`  [9] ❌ Account suspended`);
      await browser.close();
      return { email, success: false, error: 'SUSPENDED' };
    }

    if (pageText.includes('verify') || pageText.includes('Verify')) {
      console.log(`  [9] ⚠️ Email verification needed`);
      // Try clicking resend/verify button
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a'));
        const verify = btns.find(b => b.textContent.toLowerCase().includes('verify') || b.textContent.toLowerCase().includes('resend'));
        if (verify) verify.click();
      });
      await delay(3000);
    }

    console.log(`  [9] ✅ Logged into TokenHarbor!`);

    // Step 5: Claim gift
    if (pageText.includes('gift') || pageText.includes('claim') || pageText.includes('Claim')) {
      console.log(`  [10] Claiming gift...`);
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const claim = btns.find(b => b.textContent.toLowerCase().includes('claim'));
        if (claim) claim.click();
      });
      await delay(3000);
    }

    // Step 6: Create API key
    console.log(`  [11] Creating API key...`);
    await page.goto('https://tokenharbor.ai/dashboard/api-keys', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await delay(3000);
    url = page.url();

    if (url.includes('login')) {
      console.log(`  [11] ❌ Not logged in`);
      await browser.close();
      return { email, success: false, error: 'NOT_LOGGED_IN' };
    }

    // Click "New key" or "+"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const btn = btns.find(b => 
        b.textContent.includes('New key') || b.textContent.includes('Create') || 
        b.textContent.includes('Generate') || b.textContent.includes('+ New')
      );
      if (btn) btn.click();
    });
    await delay(2000);

    // Fill label
    const labelInput = await page.$('input[name="name"], input[placeholder*="label"], input[placeholder*="name"]');
    if (labelInput) {
      await labelInput.click();
      await labelInput.type(`key-${Date.now()}`, { delay: 30 });
    }
    await delay(500);

    // Submit
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button[type="submit"], button'));
      const submit = btns.find(b => b.textContent.trim().toLowerCase().includes('create'));
      if (submit) submit.click();
    });
    await delay(3000);

    // Extract API key
    let apiKey = await page.evaluate(() => {
      const match = document.body.innerText.match(/thk_live_[\w-]+/);
      return match ? match[0] : null;
    });

    if (!apiKey) {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const show = btns.find(b => b.textContent.toLowerCase().includes('show'));
        if (show) show.click();
      });
      await delay(2000);
      apiKey = await page.evaluate(() => {
        const match = document.body.innerText.match(/thk_live_[\w-]+/);
        return match ? match[0] : null;
      });
    }

    if (apiKey) {
      console.log(`  [12] ✅ API Key created!`);
      await browser.close();
      return { email, success: true, key: apiKey };
    }

    console.log(`  [12] ❌ Could not extract API key`);
    await page.screenshot({ path: `th-nokey-${email.split('@')[0]}.png` });
    await browser.close();
    return { email, success: false, error: 'KEY_NOT_FOUND' };

  } catch (err) {
    console.error(`  [ERROR] ${err.message}`);
    await browser.close();
    return { email, success: false, error: err.message };
  }
}

(async () => {
  console.log(`TokenHarbor Registration (Google OAuth)`);
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
