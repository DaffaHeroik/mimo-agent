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

async function loginGmail(page, email) {
  console.log(`[${email}] Going to Gmail...`);
  await page.goto('https://mail.google.com', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  let url = page.url();

  if (url.includes('accounts.google.com')) {
    // Enter email
    await page.waitForSelector('#identifierId', { timeout: 10000 });
    await page.type('#identifierId', email, { delay: 30 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
      if (btn) btn.click();
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    // Check for error
    const errText = await page.evaluate(() => document.body.innerText);
    if (errText.includes("Couldn't sign you in") || errText.includes("update to the latest")) {
      console.log(`[${email}] BLOCKED by Google`);
      return false;
    }

    // Enter password using page.evaluate
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
  console.log(`[${email}] URL: ${url.substring(0, 60)}`);
  return url.includes('mail.google.com');
}

async function findAndClickVerify(page, email) {
  console.log(`[${email}] Looking for TokenHarbor email...`);
  
  // Wait for Gmail to load
  await new Promise(r => setTimeout(r, 5000));
  
  // Try searching
  const searchBox = await page.$('input[aria-label="Search"], input[name="q"], input[aria-label="Search mail"]');
  if (searchBox) {
    await searchBox.click();
    await new Promise(r => setTimeout(r, 500));
    await searchBox.type('tokenharbor', { delay: 30 });
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: `verify-${email.split('@')[0]}-search.png` });
  }
  
  // Look for email with verification link
  const emailContent = await page.evaluate(() => {
    // Find all links in the page
    const links = Array.from(document.querySelectorAll('a'));
    const verifyLinks = links.filter(l => 
      l.href.includes('tokenharbor') || 
      l.href.includes('verify') ||
      l.textContent.toLowerCase().includes('verify') ||
      l.textContent.toLowerCase().includes('confirm email')
    );
    return verifyLinks.map(l => ({ href: l.href, text: l.textContent.trim().substring(0, 80) }));
  });
  
  console.log(`[${email}] Found links:`, emailContent.length);
  emailContent.forEach(l => console.log(`  ${l.text} -> ${l.href.substring(0, 80)}`));
  
  // Click on first email
  const clicked = await page.evaluate(() => {
    // Find email row
    const rows = Array.from(document.querySelectorAll('tr, div[role="row"], div[data-legacy-message-id]'));
    const thRow = rows.find(r => r.textContent.includes('TokenHarbor') || r.textContent.includes('tokenharbor'));
    if (thRow) {
      thRow.click();
      return 'clicked email';
    }
    
    // Try clicking any link with tokenharbor
    const link = Array.from(document.querySelectorAll('a')).find(l => l.href.includes('tokenharbor'));
    if (link) {
      link.click();
      return 'clicked link';
    }
    return 'not found';
  });
  console.log(`[${email}] Click: ${clicked}`);
  await new Promise(r => setTimeout(r, 3000));
  
  // Look for verify link in email body
  const verifyLink = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    for (const l of links) {
      if (l.href.includes('verify') || l.href.includes('confirm') || 
          l.textContent.toLowerCase().includes('verify') || l.textContent.toLowerCase().includes('confirm')) {
        return l.href;
      }
    }
    return null;
  });
  
  if (verifyLink) {
    console.log(`[${email}] Found verify link!`);
    await page.goto(verifyLink, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    console.log(`[${email}] Verified! URL: ${page.url()}`);
    return true;
  }
  
  // If no verify link found, check if there's a button in the email
  const btnResult = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('a, button'));
    const verifyBtn = btns.find(b => 
      b.textContent.toLowerCase().includes('verify') || 
      b.textContent.toLowerCase().includes('confirm') ||
      b.textContent.toLowerCase().includes('click here')
    );
    if (verifyBtn) {
      verifyBtn.click();
      return verifyBtn.href || 'clicked';
    }
    return null;
  });
  
  if (btnResult) {
    console.log(`[${email}] Clicked verify button: ${btnResult}`);
    await new Promise(r => setTimeout(r, 3000));
    return true;
  }
  
  console.log(`[${email}] No verification link found`);
  return false;
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  // Try first account
  const loggedIn = await loginGmail(page, ACCOUNTS[0]);
  
  if (loggedIn) {
    const verified = await findAndClickVerify(page, ACCOUNTS[0]);
    console.log(`\nResult: ${verified ? 'VERIFIED ✅' : 'NOT FOUND ❌'}`);
  } else {
    console.log('\nLogin blocked by Google');
  }

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
