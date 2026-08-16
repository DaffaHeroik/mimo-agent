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

  if (url.includes('accounts.google.com')) {
    // Enter email
    console.log('[3] Entering email...');
    await page.waitForSelector('#identifierId', { timeout: 10000 });
    await page.type('#identifierId', EMAIL, { delay: 30 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
      if (btn) btn.click();
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    // Enter password
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
    await page.screenshot({ path: 'manus-v5-5-consent.png' });

    // Get the full HTML to understand the structure
    const html = await page.content();
    
    // Find all buttons with their text and visibility
    const buttonInfo = await page.evaluate(() => {
      const allElements = document.querySelectorAll('button, [role="button"], input[type="submit"]');
      return Array.from(allElements).map(el => ({
        tag: el.tagName,
        text: el.textContent.trim().substring(0, 50),
        type: el.type,
        className: el.className.substring(0, 50),
        visible: el.offsetParent !== null,
        disabled: el.disabled,
        id: el.id
      }));
    });
    console.log('[6] All buttons on page:');
    buttonInfo.forEach(b => console.log(`  ${b.tag} "${b.text}" visible=${b.visible} disabled=${b.disabled} id=${b.id}`));

    // Try clicking by coordinates - Continue button is usually at bottom right
    console.log('[7] Trying to click Continue by coordinates...');
    
    // First, try to find and click the Continue button using evaluate
    const clickResult = await page.evaluate(() => {
      // Get all elements
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const text = el.textContent.trim();
        if (text === 'Continue' && el.offsetParent !== null) {
          // Try clicking the element
          el.click();
          return `Clicked: ${el.tagName} "${text}"`;
        }
      }
      
      // Also try Lanzarote (Indonesian might be different)
      for (const el of allElements) {
        const text = el.textContent.trim();
        if ((text === 'Lanjutkan' || text === 'Izinkan' || text === 'Setuju') && el.offsetParent !== null) {
          el.click();
          return `Clicked: ${el.tagName} "${text}"`;
        }
      }
      
      return 'No Continue button found';
    });
    console.log('[8] Click result:', clickResult);

    // Wait and check
    await new Promise(r => setTimeout(r, 5000));
    url = page.url();
    console.log('[9] After click URL:', url.substring(0, 80));
    await page.screenshot({ path: 'manus-v5-9-afterclick.png' });

    // If still on consent page, try clicking at specific coordinates
    if (url.includes('oauth/id') || url.includes('consent')) {
      console.log('[10] Still on consent page, trying coordinate click...');
      // The Continue button is usually around (640, 580) in a 1280x900 viewport
      await page.mouse.click(640, 580);
      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: 'manus-v5-10-coord.png' });
      
      // Try clicking at different positions
      await page.mouse.click(640, 500);
      await new Promise(r => setTimeout(r, 2000));
      
      // Try pressing Enter
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: 'manus-v5-11-enter.png' });
    }

    // Wait for potential redirect
    await new Promise(r => setTimeout(r, 5000));
    url = page.url();
    console.log('[12] Final URL:', url.substring(0, 80));
    await page.screenshot({ path: 'manus-v5-12-final.png' });
  }

  // Check if we're on Manus
  if (url.includes('manus.im') && !url.includes('login')) {
    console.log('[13] Successfully logged into Manus!');
    
    // Navigate to settings
    await page.goto('https://manus.im/settings', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: 'manus-v5-13-settings.png' });
    
    const settingsText = await page.evaluate(() => document.body.innerText);
    console.log('[14] Settings text:');
    console.log(settingsText.substring(0, 800));
    
    // Get auth cookies
    const cookies = await page.cookies();
    const authCookies = cookies.filter(c => 
      c.name.includes('token') || c.name.includes('auth') || c.name.includes('session') || c.name.includes('user')
    );
    console.log('[15] Auth cookies:');
    authCookies.forEach(c => console.log(`  ${c.name} = ${c.value.substring(0, 50)}`));
  } else {
    console.log('[13] NOT logged into Manus');
    // Dump page HTML for debugging
    const bodyHtml = await page.evaluate(() => document.body.innerHTML.substring(0, 2000));
    console.log('[14] Page HTML (first 2000 chars):');
    console.log(bodyHtml);
  }

  await browser.close();
  console.log('[DONE]');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
