const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const EMAIL = 'josef1@bekri.site';
const PASSWORD = 'Daffa112233';
const CHROME_PATH = '/tmp/chrome-dir/chrome';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,900'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  console.log('[1] Navigating to Manus login...');
  await page.goto('https://manus.im/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.screenshot({ path: 'manus-1-login.png' });

  // Click "Continue with Google"
  console.log('[2] Clicking Continue with Google...');
  const googleBtn = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(b => b.textContent.includes('Continue with Google'));
  });
  if (googleBtn) {
    await googleBtn.click();
  }

  // Wait for Google OAuth page
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: 'manus-2-google.png' });

  const url = page.url();
  console.log('[3] Current URL:', url);

  // Check if we're on Google login
  if (url.includes('accounts.google.com')) {
    console.log('[4] Entering email...');
    // Try multiple selectors
    const emailSelectors = ['input[type="email"]', '#identifierId', 'input[name="identifier"]', 'input[autocomplete="username"]'];
    let emailInput = null;
    for (const sel of emailSelectors) {
      emailInput = await page.$(sel);
      if (emailInput) { console.log('  Found email input:', sel); break; }
    }
    if (!emailInput) {
      // Try evaluate
      emailInput = await page.evaluateHandle(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.find(i => i.type === 'email' || i.type === 'text' || i.name === 'identifier');
      });
    }
    if (emailInput) {
      await emailInput.click();
      await emailInput.type(EMAIL, { delay: 50 });
    }
    await page.screenshot({ path: 'manus-3-email.png' });

    // Click Next
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const next = buttons.find(b => b.textContent.includes('Next'));
      if (next) next.click();
    });

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: 'manus-4-password.png' });

    console.log('[5] Entering password...');
    const passSelectors = ['input[type="password"]', 'input[name="password"]', 'input[autocomplete="current-password"]'];
    let passInput = null;
    for (const sel of passSelectors) {
      passInput = await page.$(sel);
      if (passInput) { console.log('  Found password input:', sel); break; }
    }
    if (passInput) {
      await passInput.click();
      await passInput.type(PASSWORD, { delay: 50 });
    }

    // Click Next
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const next = buttons.find(b => b.textContent.includes('Next'));
      if (next) next.click();
    });

    console.log('[6] Waiting for redirect...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: 'manus-5-result.png' });
  }

  console.log('[7] Final URL:', page.url());

  // Check if we're logged in
  if (page.url().includes('manus.im')) {
    console.log('[8] Checking for API key page...');
    // Navigate to settings
    await page.goto('https://manus.im/settings', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: 'manus-6-settings.png' });
    console.log('[9] Settings URL:', page.url());
  }

  // Check cookies for auth
  const cookies = await page.cookies();
  const authCookies = cookies.filter(c => 
    c.name.includes('token') || c.name.includes('auth') || c.name.includes('session')
  );
  console.log('[10] Auth cookies:', authCookies.map(c => c.name).join(', '));

  await browser.close();
  console.log('[DONE]');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
