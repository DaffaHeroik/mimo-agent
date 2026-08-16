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
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Continue with Google'));
    if (btn) btn.click();
  });

  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));

  let url = page.url();

  if (url.includes('accounts.google.com')) {
    console.log('[3] Entering email...');
    await page.waitForSelector('#identifierId', { timeout: 10000 });
    await page.type('#identifierId', EMAIL, { delay: 30 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
      if (btn) btn.click();
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    console.log('[4] Entering password...');
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.type('input[type="password"]', PASSWORD, { delay: 30 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
      if (btn) btn.click();
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));

    url = page.url();
    console.log('[5] Consent URL:', url.substring(0, 80));
    await page.screenshot({ path: 'manus-v7-5-consent.png' });

    // Wait for page to load
    await new Promise(r => setTimeout(r, 5000));

    // Find the Lanjutkan button and click it
    console.log('[6] Looking for Lanjutkan button...');
    
    const buttonInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const lanjutkan = buttons.find(b => b.textContent.trim() === 'Lanjutkan');
      if (lanjutkan) {
        const rect = lanjutkan.getBoundingClientRect();
        return { found: true, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      }
      // Also check for Continue
      const continueBtn = buttons.find(b => b.textContent.trim() === 'Continue');
      if (continueBtn) {
        const rect = continueBtn.getBoundingClientRect();
        return { found: true, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, text: 'Continue' };
      }
      return { found: false };
    });
    
    console.log('[7] Button:', JSON.stringify(buttonInfo));
    
    if (buttonInfo.found) {
      // Click the button
      console.log(`[8] Clicking at (${buttonInfo.x}, ${buttonInfo.y})...`);
      await page.mouse.click(buttonInfo.x, buttonInfo.y);
      await new Promise(r => setTimeout(r, 5000));
      url = page.url();
      console.log('[9] After click URL:', url.substring(0, 80));
      await page.screenshot({ path: 'manus-v7-9-afterclick.png' });
    }

    // If still on consent page, try keyboard
    if (url.includes('oauth/id')) {
      console.log('[10] Still on consent, trying keyboard...');
      // Tab to Continue button and press Enter
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        await new Promise(r => setTimeout(r, 300));
      }
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 5000));
      url = page.url();
      console.log('[11] After keyboard URL:', url.substring(0, 80));
      await page.screenshot({ path: 'manus-v7-11-keyboard.png' });
    }

    // If still on consent, try clicking the actual button element
    if (url.includes('oauth/id')) {
      console.log('[12] Trying direct button click...');
      await page.evaluate(() => {
        const btn = document.querySelector('button');
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 5000));
      url = page.url();
      console.log('[13] After direct click URL:', url.substring(0, 80));
    }

    // Wait for redirect
    await new Promise(r => setTimeout(r, 10000));
    url = page.url();
    console.log('[14] Final URL:', url.substring(0, 80));
    await page.screenshot({ path: 'manus-v7-14-final.png' });
  }

  // Check if we're on Manus
  if (url.includes('manus.im') && !url.includes('login')) {
    console.log('[15] Successfully logged into Manus!');
    
    await page.goto('https://manus.im/settings', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: 'manus-v7-15-settings.png' });
    
    const settingsText = await page.evaluate(() => document.body.innerText);
    console.log('[16] Settings text (first 800 chars):');
    console.log(settingsText.substring(0, 800));
    
    const cookies = await page.cookies();
    const authCookies = cookies.filter(c => 
      c.name.includes('token') || c.name.includes('auth') || c.name.includes('session') || c.name.includes('user')
    );
    console.log('[17] Auth cookies:');
    authCookies.forEach(c => console.log(`  ${c.name} = ${c.value.substring(0, 50)}`));
  } else {
    console.log('[15] NOT logged into Manus');
    
    // Debug
    const elements = await page.evaluate(() => {
      const all = document.querySelectorAll('button, a, [role="button"]');
      return Array.from(all).map(el => ({
        tag: el.tagName,
        text: el.textContent.trim().substring(0, 40),
        visible: el.offsetParent !== null,
        rect: el.getBoundingClientRect()
      })).filter(el => el.visible);
    });
    console.log('[16] Visible elements:');
    elements.forEach(el => console.log(`  ${el.tag} "${el.text}" at (${Math.round(el.rect.x)},${Math.round(el.rect.y)})`));
  }

  await browser.close();
  console.log('[DONE]');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
