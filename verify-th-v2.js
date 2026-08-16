const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const CHROME_PATH = '/tmp/chrome-dir/chrome';
const EMAIL = 'ahmed1@bekri.id';
const PASSWORD = 'Daffa112233';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Set a modern user agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  console.log('[1] Going to Gmail...');
  await page.goto('https://mail.google.com', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  let url = page.url();
  console.log('[2] URL:', url.substring(0, 80));

  // Login
  if (url.includes('accounts.google.com')) {
    console.log('[3] Entering email...');
    await page.waitForSelector('#identifierId', { timeout: 10000 });
    await page.type('#identifierId', EMAIL, { delay: 50 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
      if (btn) btn.click();
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    // Check for error
    const pageText = await page.evaluate(() => document.body.innerText);
    if (pageText.includes("Couldn't sign you in") || pageText.includes("update to the latest")) {
      console.log('[4] Google blocking sign-in (browser version)');
      await page.screenshot({ path: 'verify-blocked.png' });
      await browser.close();
      return;
    }

    console.log('[5] Entering password...');
    const passInput = await page.$('input[type="password"]');
    if (passInput) {
      await passInput.click();
      await passInput.type(PASSWORD, { delay: 50 });
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
        if (btn) btn.click();
      });
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 5000));
    }

    // Handle consent
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        b.textContent.trim() === 'Lanjutkan' || b.textContent.trim() === 'Continue'
      );
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 5000));
  }

  url = page.url();
  console.log('[6] After login URL:', url.substring(0, 80));
  await page.screenshot({ path: 'verify-gmail.png' });

  // Check if we're in Gmail
  if (url.includes('mail.google.com')) {
    console.log('[7] In Gmail! Looking for TokenHarbor email...');
    
    // Wait for Gmail to load
    await new Promise(r => setTimeout(r, 5000));
    
    // Search for tokenharbor
    const searchBox = await page.$('input[aria-label="Search"], input[name="q"]');
    if (searchBox) {
      await searchBox.click();
      await searchBox.type('tokenharbor', { delay: 30 });
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 5000));
      await page.screenshot({ path: 'verify-search.png' });
      
      // Look for verification link
      const verifyLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        return links.map(l => ({ href: l.href, text: l.textContent.trim().substring(0, 80) }))
          .filter(l => l.href.includes('tokenharbor') || l.text.toLowerCase().includes('verify') || l.text.toLowerCase().includes('confirm'));
      });
      console.log('[8] Verify links:', JSON.stringify(verifyLinks));
      
      // Click on the email
      const emailLink = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, tr, div'));
        const email = links.find(l => l.textContent.includes('TokenHarbor') || l.textContent.includes('tokenharbor'));
        if (email) { email.click(); return 'clicked'; }
        return 'not found';
      });
      console.log('[9] Email click:', emailLink);
      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: 'verify-email.png' });
      
      // Look for verify button/link in the email
      const verifyBtn = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const verify = links.find(l => 
          l.href.includes('verify') || l.href.includes('confirm') || 
          l.textContent.toLowerCase().includes('verify') || l.textContent.toLowerCase().includes('confirm')
        );
        if (verify) return verify.href;
        return null;
      });
      console.log('[10] Verify link:', verifyBtn);
      
      if (verifyBtn) {
        await page.goto(verifyBtn, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 3000));
        console.log('[11] After verify URL:', page.url());
        await page.screenshot({ path: 'verify-done.png' });
      }
    } else {
      console.log('[7] No search box found');
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
      console.log('[8] Page text:', bodyText.substring(0, 200));
    }
  } else {
    console.log('[7] Not in Gmail, checking page...');
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('[8] Page text:', bodyText.substring(0, 300));
  }

  await browser.close();
  console.log('[DONE]');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
