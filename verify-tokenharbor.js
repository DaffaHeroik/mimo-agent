const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const CHROME_PATH = '/tmp/chrome-dir/chrome';

const ACCOUNTS = [
  'ahmed1@bekri.id', 'ahmed2@bekri.id', 'ahmed3@bekri.id',
  'ahmed4@bekri.id', 'ahmed5@bekri.id', 'ahmed6@bekri.id',
  'ahmed7@bekri.id', 'ahmed8@bekri.id', 'ahmed9@bekri.id', 'ahmed10@bekri.id'
];

const PASSWORD = 'Daffa112233';

async function verifyAccount(browser, email) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  
  console.log(`\n[${email}] Logging into Gmail...`);
  
  // Go to Gmail
  await page.goto('https://mail.google.com', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  
  let url = page.url();
  
  // If not logged in, do Google OAuth
  if (url.includes('accounts.google.com')) {
    await page.waitForSelector('#identifierId', { timeout: 10000 });
    await page.type('#identifierId', email, { delay: 30 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
      if (btn) btn.click();
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    
    const passInput = await page.$('input[type="password"]');
    if (passInput) {
      await passInput.click();
      await passInput.type(PASSWORD, { delay: 30 });
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
        if (btn) btn.click();
      });
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 5000));
    }
    
    // Handle consent
    const consentResult = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        b.textContent.trim() === 'Lanjutkan' || b.textContent.trim() === 'Continue'
      );
      if (btn) { btn.click(); return 'clicked'; }
      return 'no button';
    });
    if (consentResult === 'clicked') {
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  
  url = page.url();
  console.log(`[${email}] URL: ${url.substring(0, 60)}`);
  
  // Check if we're in Gmail
  if (!url.includes('mail.google.com')) {
    await page.goto('https://mail.google.com', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
  }
  
  // Search for TokenHarbor verification email
  console.log(`[${email}] Searching for TokenHarbor email...`);
  
  // Look for search box and search
  const searchResult = await page.evaluate(() => {
    const searchBox = document.querySelector('input[aria-label="Search"], input[name="q"], input[placeholder*="Search"]');
    if (searchBox) {
      searchBox.value = 'tokenharbor';
      searchBox.dispatchEvent(new Event('input', { bubbles: true }));
      return 'found search box';
    }
    return 'no search box';
  });
  console.log(`[${email}] Search: ${searchResult}`);
  
  // Try pressing Enter to search
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 3000));
  
  // Look for verification email
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log(`[${email}] Page contains 'tokenharbor': ${pageText.toLowerCase().includes('tokenharbor')}`);
  console.log(`[${email}] Page contains 'verify': ${pageText.toLowerCase().includes('verify')}`);
  console.log(`[${email}] Page contains 'confirm': ${pageText.toLowerCase().includes('confirm')}`);
  
  // Look for links in emails
  const links = await page.evaluate(() => {
    const allLinks = Array.from(document.querySelectorAll('a'));
    return allLinks.map(l => ({ href: l.href, text: l.textContent.trim().substring(0, 50) }))
      .filter(l => l.href.includes('tokenharbor') || l.href.includes('verify') || l.href.includes('confirm'));
  });
  console.log(`[${email}] Verification links:`, JSON.stringify(links));
  
  // Click on first email if found
  if (links.length > 0) {
    console.log(`[${email}] Found verification link!`);
    await page.goto(links[0].href, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    console.log(`[${email}] After verify URL: ${page.url()}`);
  }
  
  await page.close();
  return links.length > 0;
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  // Try first account
  const email = ACCOUNTS[0];
  const result = await verifyAccount(browser, email);
  console.log(`\nResult: ${result ? 'VERIFIED' : 'NEED MANUAL'}`);

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
