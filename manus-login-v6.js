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
    await page.screenshot({ path: 'manus-v6-5-consent.png' });

    // Wait for the page to fully load
    console.log('[6] Waiting for consent page to load...');
    await new Promise(r => setTimeout(r, 5000));

    // Find and click the "Lanjutkan" (Continue) button
    console.log('[7] Looking for Lanjutkan button...');
    
    // Use page.click with text selector
    try {
      // Find the button by text content
      const buttonFound = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const lanjutkan = buttons.find(b => b.textContent.trim() === 'Lanjutkan');
        if (lanjutkan) {
          // Get button details
          const rect = lanjutkan.getBoundingClientRect();
          return {
            found: true,
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            width: rect.width,
            height: rect.height
          };
        }
        return { found: false };
      });
      
      console.log('[8] Button info:', JSON.stringify(buttonFound));
      
      if (buttonFound.found) {
        console.log(`[9] Clicking at (${buttonFound.x}, ${buttonFound.y})...`);
        await page.mouse.click(buttonFound.x, buttonFound.y);
        await new Promise(r => setTimeout(r, 3000));
        await page.screenshot({ path: 'manus-v6-9-afterclick.png' });
      }
    } catch (err) {
      console.log('[8] Error:', err.message);
    }

    // Check URL
    url = page.url();
    console.log('[10] After click URL:', url.substring(0, 80));

    // If still on consent page, try using page.$eval
    if (url.includes('oauth/id') || url.includes('consent')) {
      console.log('[11] Still on consent page, trying $eval...');
      
      try {
        await page.$eval('button', (buttons) => {
          const btns = Array.from(document.querySelectorAll('button'));
          const lanjutkan = btns.find(b => b.textContent.trim() === 'Lanjutkan');
          if (lanjutkan) {
            lanjutkan.click();
            return 'clicked';
          }
          return 'not found';
        };
        await page.evaluate(clickFn);
      } catch (e) {
        console.log('[11] $eval error:', e.message);
      }
      
      await new Promise(r => setTimeout(r, 5000));
      url = page.url();
      console.log('[12] After $eval URL:', url.substring(0, 80));
      await page.screenshot({ path: 'manus-v6-12-eval.png' });
    }

    // Try using keyboard
    if (url.includes('oauth/id') || url.includes('consent')) {
      console.log('[13] Trying keyboard Enter...');
      await page.keyboard.press('Tab');
      await new Promise(r => setTimeout(r, 500));
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 5000));
      url = page.url();
      console.log('[14] After Enter URL:', url.substring(0, 80));
      await page.screenshot({ path: 'manus-v6-14-enter.png' });
    }

    // Wait for redirect
    await new Promise(r => setTimeout(r, 10000));
    url = page.url();
    console.log('[15] Final URL:', url.substring(0, 80));
    await page.screenshot({ path: 'manus-v6-15-final.png' });
  }

  // Check if we're on Manus
  if (url.includes('manus.im') && !url.includes('login')) {
    console.log('[16] Successfully logged into Manus!');
    
    await page.goto('https://manus.im/settings', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: 'manus-v6-16-settings.png' });
    
    const settingsText = await page.evaluate(() => document.body.innerText);
    console.log('[17] Settings text:');
    console.log(settingsText.substring(0, 800));
    
    const cookies = await page.cookies();
    const authCookies = cookies.filter(c => 
      c.name.includes('token') || c.name.includes('auth') || c.name.includes('session') || c.name.includes('user')
    );
    console.log('[18] Auth cookies:');
    authCookies.forEach(c => console.log(`  ${c.name} = ${c.value.substring(0, 50)}`));
  } else {
    console.log('[16] NOT logged into Manus');
    
    // Debug: get all clickable elements
    const elements = await page.evaluate(() => {
      const all = document.querySelectorAll('button, a, [role="button"], [onclick]');
      return Array.from(all).map(el => ({
        tag: el.tagName,
        text: el.textContent.trim().substring(0, 40),
        href: el.href || '',
        visible: el.offsetParent !== null,
        rect: el.getBoundingClientRect()
      })).filter(el => el.visible);
    });
    console.log('[17] Visible clickable elements:');
    elements.forEach(el => console.log(`  ${el.tag} "${el.text}" at (${Math.round(el.rect.x)},${Math.round(el.rect.y)}) ${el.rect.width}x${el.rect.height}`));
  }

  await browser.close();
  console.log('[DONE]');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
