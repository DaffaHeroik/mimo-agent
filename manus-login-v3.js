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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,900']
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

  let url = page.url();
  console.log('[3] Current URL:', url.substring(0, 80));

  if (url.includes('accounts.google.com')) {
    // Enter email
    console.log('[4] Entering email...');
    const emailInput = await page.$('#identifierId, input[type="email"]');
    if (emailInput) {
      await emailInput.click();
      await emailInput.type(EMAIL, { delay: 50 });
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const next = buttons.find(b => b.textContent.includes('Next'));
        if (next) next.click();
      });
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
    }

    // Enter password
    const passInput = await page.$('input[type="password"]');
    if (passInput) {
      console.log('[5] Entering password...');
      await passInput.click();
      await passInput.type(PASSWORD, { delay: 50 });
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const next = buttons.find(b => b.textContent.includes('Next'));
        if (next) next.click();
      });
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 5000));
    }

    url = page.url();
    console.log('[6] After login URL:', url.substring(0, 80));
    await page.screenshot({ path: 'manus-v3-6-afterlogin.png' });

    // Handle consent page - click Continue
    console.log('[7] Looking for Continue button on consent page...');
    
    // Try multiple times to click Continue
    for (let i = 0; i < 5; i++) {
      const clicked = await page.evaluate(() => {
        // Look for Continue/Allow button
        const buttons = Array.from(document.querySelectorAll('button'));
        const continueBtn = buttons.find(b => {
          const text = b.textContent.trim().toLowerCase();
          return text === 'continue' || text === 'allow' || text === 'accept';
        });
        if (continueBtn) {
          continueBtn.click();
          return true;
        }
        return false;
      });
      
      if (clicked) {
        console.log(`  [${i}] Clicked Continue button`);
        await new Promise(r => setTimeout(r, 3000));
      } else {
        // Check for "Confirm" button (recovery info popup)
        const confirmed = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const confirmBtn = buttons.find(b => b.textContent.trim().toLowerCase() === 'confirm');
          if (confirmBtn) {
            confirmBtn.click();
            return true;
          }
          return false;
        });
        if (confirmed) {
          console.log(`  [${i}] Clicked Confirm button`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      
      url = page.url();
      if (url.includes('manus.im')) break;
    }

    await new Promise(r => setTimeout(r, 5000));
    url = page.url();
    console.log('[8] Final URL:', url.substring(0, 80));
    await page.screenshot({ path: 'manus-v3-8-final.png' });
  }

  // Check if we're on Manus
  if (url.includes('manus.im') && !url.includes('login')) {
    console.log('[9] Successfully logged into Manus!');
    
    // Navigate to settings to find API key
    console.log('[10] Navigating to settings...');
    await page.goto('https://manus.im/settings', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: 'manus-v3-10-settings.png' });
    
    // Get page content to find API key section
    const settingsContent = await page.evaluate(() => document.body.innerText);
    console.log('[11] Settings page content (first 500 chars):');
    console.log(settingsContent.substring(0, 500));
    
    // Look for API key button/link
    const hasApiSection = settingsContent.toLowerCase().includes('api');
    console.log('[12] Has API section:', hasApiSection);
    
    if (hasApiSection) {
      // Try clicking on API key section
      await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, button, div, span'));
        const apiLink = links.find(l => l.textContent.toLowerCase().includes('api key') || l.textContent.toLowerCase().includes('api-key'));
        if (apiLink) apiLink.click();
      });
      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: 'manus-v3-12-apikey.png' });
    }

    // Get cookies
    const cookies = await page.cookies();
    const authCookies = cookies.filter(c => 
      c.name.includes('token') || c.name.includes('auth') || c.name.includes('session') || c.name.includes('user')
    );
    console.log('[13] Auth cookies:', authCookies.map(c => `${c.name}=${c.value.substring(0, 30)}`).join('\n  '));
  } else {
    console.log('[9] Not logged into Manus. Current URL:', url);
    // Get page text to understand what happened
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
    console.log('[10] Page text:', bodyText.substring(0, 300));
  }

  await browser.close();
  console.log('[DONE]');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
