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

    // Handle consent
    console.log('[5] Handling consent...');
    const buttonInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.trim() === 'Lanjutkan' || b.textContent.trim() === 'Continue');
      if (btn) {
        const rect = btn.getBoundingClientRect();
        return { found: true, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      }
      return { found: false };
    });
    
    if (buttonInfo.found) {
      await page.mouse.click(buttonInfo.x, buttonInfo.y);
      await new Promise(r => setTimeout(r, 5000));
    }

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));
  }

  url = page.url();
  console.log('[6] Logged in URL:', url);

  // Now find the API key page
  console.log('[7] Looking for API key page...');
  
  // Try direct URL first
  const apiUrls = [
    'https://manus.im/settings/api-keys',
    'https://manus.im/settings/apikeys', 
    'https://manus.im/settings/api_keys',
    'https://manus.im/settings',
    'https://manus.im/account',
    'https://manus.im/account/api-keys',
    'https://manus.im/profile',
    'https://manus.im/dashboard/settings'
  ];

  for (const apiUrl of apiUrls) {
    console.log(`[8] Trying: ${apiUrl}`);
    await page.goto(apiUrl, { waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    
    const currentUrl = page.url();
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 200));
    
    if (!pageText.includes('404') && !pageText.includes('not found')) {
      console.log(`[9] Found page: ${currentUrl}`);
      console.log('[10] Content:', pageText.substring(0, 300));
      await page.screenshot({ path: `manus-api-${apiUrl.split('/').pop() || 'root'}.png` });
      
      // Look for API key section
      if (pageText.toLowerCase().includes('api')) {
        console.log('[11] Found API section!');
        break;
      }
    }
  }

  // Also try clicking on profile/settings from the main page
  console.log('[12] Going to main app...');
  await page.goto('https://manus.im/app', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: 'manus-app-main.png' });

  // Look for settings/profile icon
  const mainText = await page.evaluate(() => document.body.innerText);
  console.log('[13] Main app text (first 500):');
  console.log(mainText.substring(0, 500));

  // Look for any links to settings
  const links = await page.evaluate(() => {
    const allLinks = Array.from(document.querySelectorAll('a'));
    return allLinks.map(l => ({ href: l.href, text: l.textContent.trim() }))
      .filter(l => l.href.includes('setting') || l.href.includes('api') || l.href.includes('account') || l.href.includes('profile'));
  });
  console.log('[14] Settings-related links:');
  links.forEach(l => console.log(`  ${l.text} -> ${l.href}`));

  // Get auth cookies
  const cookies = await page.cookies();
  const authCookies = cookies.filter(c => 
    c.name.includes('token') || c.name.includes('auth') || c.name.includes('session') || c.name.includes('user')
  );
  console.log('[15] Auth cookies:');
  authCookies.forEach(c => console.log(`  ${c.name} = ${c.value.substring(0, 80)}`));

  await browser.close();
  console.log('[DONE]');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
