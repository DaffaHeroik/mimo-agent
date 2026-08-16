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

  console.log('[2] Clicking Continue with Google...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent.includes('Continue with Google'));
    if (btn) btn.click();
  });

  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));

  let url = page.url();
  console.log('[3] URL:', url.substring(0, 80));

  if (url.includes('accounts.google.com')) {
    // Enter email
    console.log('[4] Entering email...');
    await page.waitForSelector('#identifierId', { timeout: 10000 });
    await page.type('#identifierId', EMAIL, { delay: 30 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
      if (btn) btn.click();
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    // Enter password
    console.log('[5] Entering password...');
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.type('input[type="password"]', PASSWORD, { delay: 30 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
      if (btn) btn.click();
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));

    url = page.url();
    console.log('[6] After password URL:', url.substring(0, 80));
    await page.screenshot({ path: 'manus-v4-6-consent.png' });

    // Handle consent page - this is the key part
    console.log('[7] Handling consent page...');
    
    // First, try to close any overlay/popup (like "Confirm your recovery info")
    for (let attempt = 0; attempt < 10; attempt++) {
      // Check if we've been redirected to Manus
      url = page.url();
      if (url.includes('manus.im') && !url.includes('login')) {
        console.log(`  [${attempt}] Redirected to Manus!`);
        break;
      }

      // Try to click Continue/Allow button
      const result = await page.evaluate(() => {
        const allButtons = Array.from(document.querySelectorAll('button'));
        
        // First, look for "Continue" button (consent)
        let btn = allButtons.find(b => b.textContent.trim() === 'Continue' && b.offsetParent !== null);
        if (btn) {
          btn.click();
          return 'Clicked Continue';
        }
        
        // Look for "Allow" button
        btn = allButtons.find(b => b.textContent.trim() === 'Allow' && b.offsetParent !== null);
        if (btn) {
          btn.click();
          return 'Clicked Allow';
        }
        
        // Look for "Confirm" button (recovery info popup)
        btn = allButtons.find(b => b.textContent.trim() === 'Confirm' && b.offsetParent !== null);
        if (btn) {
          btn.click();
          return 'Clicked Confirm';
        }
        
        // Look for close/dismiss button on popup
        btn = allButtons.find(b => b.textContent.trim() === 'Cancel' && b.offsetParent !== null);
        if (btn) {
          btn.click();
          return 'Clicked Cancel';
        }
        
        // Try clicking any visible button with relevant text
        btn = allButtons.find(b => {
          const text = b.textContent.trim().toLowerCase();
          return (text === 'continue' || text === 'allow' || text === 'accept' || text === 'confirm') && b.offsetParent !== null;
        });
        if (btn) {
          btn.click();
          return 'Clicked: ' + btn.textContent.trim();
        }
        
        return 'No button found';
      });
      
      console.log(`  [${attempt}] ${result}`);
      await new Promise(r => setTimeout(r, 2000));
    }

    await new Promise(r => setTimeout(r, 5000));
    url = page.url();
    console.log('[8] Final URL:', url.substring(0, 80));
    await page.screenshot({ path: 'manus-v4-8-final.png' });
  }

  // Check if we're on Manus
  if (url.includes('manus.im') && !url.includes('login')) {
    console.log('[9] Successfully logged into Manus!');
    
    // Navigate to settings
    console.log('[10] Navigating to settings...');
    await page.goto('https://manus.im/settings', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: 'manus-v4-10-settings.png' });
    
    const settingsText = await page.evaluate(() => document.body.innerText);
    console.log('[11] Settings text (first 800 chars):');
    console.log(settingsText.substring(0, 800));
    
    // Look for API key section
    if (settingsText.toLowerCase().includes('api')) {
      console.log('[12] Found API section, clicking...');
      await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('a, button, div, span'));
        const apiEl = els.find(el => {
          const text = el.textContent.toLowerCase();
          return text.includes('api key') || text.includes('api-key') || text === 'api';
        });
        if (apiEl) apiEl.click();
      });
      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: 'manus-v4-12-api.png' });
      
      // Get page content after clicking API section
      const apiText = await page.evaluate(() => document.body.innerText);
      console.log('[13] API page text (first 500 chars):');
      console.log(apiText.substring(0, 500));
    }

    // Get auth cookies
    const cookies = await page.cookies();
    const authCookies = cookies.filter(c => 
      c.name.includes('token') || c.name.includes('auth') || c.name.includes('session') || c.name.includes('user')
    );
    console.log('[14] Auth cookies:');
    authCookies.forEach(c => console.log(`  ${c.name} = ${c.value.substring(0, 50)}`));
  } else {
    console.log('[9] NOT logged into Manus. URL:', url.substring(0, 100));
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('[10] Page text:', bodyText.substring(0, 300));
  }

  await browser.close();
  console.log('[DONE]');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
