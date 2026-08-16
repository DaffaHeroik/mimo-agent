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

  // Click "Continue with Google"
  console.log('[2] Clicking Continue with Google...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent.includes('Continue with Google'));
    if (btn) btn.click();
  });

  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));

  const url = page.url();
  console.log('[3] Current URL:', url.substring(0, 80));

  // Check if we're on Google login
  if (url.includes('accounts.google.com')) {
    // Check if it's the "Choose an account" page
    const pageContent = await page.content();
    
    if (pageContent.includes('Choose an account') || pageContent.includes('josef1@bekri.site')) {
      console.log('[4] Account chooser detected, clicking on account...');
      // Click on the account
      await page.evaluate((email) => {
        const divs = Array.from(document.querySelectorAll('div[data-email], div[data-identifier], div, span'));
        const account = divs.find(d => d.textContent.includes(email) || d.getAttribute('data-email') === email);
        if (account) account.click();
      }, EMAIL);
      await new Promise(r => setTimeout(r, 2000));
      await page.screenshot({ path: 'manus-3b-chooser.png' });
    }

    // Check if we need to enter email
    const emailInput = await page.$('#identifierId, input[type="email"]');
    if (emailInput) {
      console.log('[5] Entering email...');
      await emailInput.click();
      await emailInput.type(EMAIL, { delay: 50 });
      await page.screenshot({ path: 'manus-3-email.png' });

      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const next = buttons.find(b => b.textContent.includes('Next'));
        if (next) next.click();
      });

      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
    }

    // Check if we need to enter password
    const passInput = await page.$('input[type="password"]');
    if (passInput) {
      console.log('[6] Entering password...');
      await passInput.click();
      await passInput.type(PASSWORD, { delay: 50 });
      await page.screenshot({ path: 'manus-4-password.png' });

      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const next = buttons.find(b => b.textContent.includes('Next'));
        if (next) next.click();
      });

      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 5000));
    }

    // Handle consent page
    console.log('[7] Checking for consent page...');
    await page.screenshot({ path: 'manus-5-consent.png' });
    
    // Check for "Continue" or "Allow" button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const allow = buttons.find(b => 
        b.textContent.includes('Continue') || 
        b.textContent.includes('Allow') || 
        b.textContent.includes('Accept') ||
        b.textContent.includes('Confirm')
      );
      if (allow) allow.click();
    });

    await new Promise(r => setTimeout(r, 3000));
    
    // Handle recovery info confirmation if present
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const confirm = buttons.find(b => b.textContent.includes('Confirm'));
      if (confirm) confirm.click();
    });

    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: 'manus-6-result.png' });
  }

  console.log('[8] Final URL:', page.url());

  // Wait for redirect to Manus
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 5000));
  
  console.log('[9] After redirect URL:', page.url());
  await page.screenshot({ path: 'manus-7-manus.png' });

  // Check if we're logged into Manus
  if (page.url().includes('manus.im')) {
    console.log('[10] Logged into Manus! Looking for API key page...');
    
    // Try to find API key settings
    await page.goto('https://manus.im/settings/api-keys', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: 'manus-8-apikeys.png' });
    console.log('[11] API keys page URL:', page.url());

    // If that doesn't work, try settings
    if (!page.url().includes('api')) {
      await page.goto('https://manus.im/settings', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: 'manus-8-settings.png' });
      console.log('[12] Settings URL:', page.url());
    }
  }

  // Get cookies
  const cookies = await page.cookies();
  const authCookies = cookies.filter(c => 
    c.name.includes('token') || c.name.includes('auth') || c.name.includes('session') || c.name.includes('user')
  );
  console.log('[13] Auth cookies:', authCookies.map(c => `${c.name}=${c.value.substring(0, 20)}...`).join(', '));

  await browser.close();
  console.log('[DONE]');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
