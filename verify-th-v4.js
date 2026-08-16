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
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  console.log('[1] Going to Gmail...');
  await page.goto('https://mail.google.com', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  let url = page.url();

  if (url.includes('accounts.google.com')) {
    console.log('[2] Logging in...');
    await page.waitForSelector('#identifierId', { timeout: 10000 });
    await page.type('#identifierId', EMAIL, { delay: 30 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
      if (btn) btn.click();
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    await page.evaluate((pw) => {
      const input = document.querySelector('input[type="password"]');
      if (input) {
        input.value = pw;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, PASSWORD);
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
      if (btn) btn.click();
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));

    // Consent
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        b.textContent.trim() === 'Lanjutkan' || b.textContent.trim() === 'Continue'
      );
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 5000));
  }

  url = page.url();
  console.log('[3] URL:', url.substring(0, 60));

  if (url.includes('mail.google.com')) {
    console.log('[4] In Gmail! Waiting for inbox to load...');
    await new Promise(r => setTimeout(r, 8000));
    await page.screenshot({ path: 'verify-inbox.png' });

    // Get all visible text
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('[5] Page text (first 1000):');
    console.log(pageText.substring(0, 1000));
    
    // Check for any emails
    const emailCount = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr[role="row"], div[data-legacy-message-id], div[role="listitem"]');
      return rows.length;
    });
    console.log('[6] Email rows found:', emailCount);
    
    // Check for "No new mail" or similar
    const noMail = pageText.includes('No new mail') || pageText.includes('Your Primary tab is empty') || pageText.includes('Tidak ada');
    console.log('[7] No mail message:', noMail);
    
    // Check spam
    console.log('[8] Checking spam...');
    const spamLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const spam = links.find(l => l.textContent.includes('Spam') || l.href.includes('spam'));
      if (spam) { spam.click(); return 'clicked'; }
      return 'not found';
    });
    console.log('[9] Spam link:', spamLink);
    if (spamLink === 'clicked') {
      await new Promise(r => setTimeout(r, 5000));
      const spamText = await page.evaluate(() => document.body.innerText.substring(0, 500));
      console.log('[10] Spam page:', spamText.substring(0, 300));
    }
  }

  await browser.close();
  console.log('[DONE]');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
