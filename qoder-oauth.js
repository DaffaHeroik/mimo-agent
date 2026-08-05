const puppeteer = require('/home/work/.openclaw/tmp/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const TMP = '/home/work/.openclaw/tmp';

(async () => {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node qoder-oauth.js <login_url>');
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath: process.env.HOME + '/.local/chrome/chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  
  console.log('[1] Opening Qoder login page...');
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  
  await page.screenshot({ path: path.join(TMP, 'qoder-login-1.png'), fullPage: true });
  console.log('[✓] Screenshot 1 saved');

  console.log('[2] Looking for Google login button...');
  
  // Get all interactive elements
  const allButtons = await page.$$eval('button, a, [role="button"], input[type="submit"]', els => 
    els.map((el, i) => ({
      idx: i,
      tag: el.tagName,
      text: (el.textContent || '').trim().substring(0, 100),
      cls: (el.className || '').substring(0, 100),
      href: el.href || '',
      id: el.id || '',
      visible: el.offsetParent !== null
    }))
  );
  
  console.log('[DEBUG] Interactive elements found:', allButtons.length);
  allButtons.forEach(el => {
    if (el.text || el.cls) {
      console.log(`  [${el.idx}] <${el.tag}> "${el.text}" class="${el.cls}" href="${el.href}"`);
    }
  });

  // Try to find and click Google button
  let clicked = false;
  
  for (const el of allButtons) {
    const combined = `${el.text} ${el.cls} ${el.href} ${el.id}`.toLowerCase();
    if (combined.includes('google') || combined.includes('gsi') || combined.includes('accounts.google')) {
      console.log(`[✓] Found Google element at index ${el.idx}: "${el.text}"`);
      
      // Click it
      const elements = await page.$$('button, a, [role="button"], input[type="submit"]');
      if (elements[el.idx]) {
        await elements[el.idx].click();
        clicked = true;
        console.log('[✓] Clicked!');
        break;
      }
    }
  }
  
  if (!clicked) {
    // Try evaluating page for any Google-related links
    const googleLinks = await page.$$eval('a[href*="google"], a[href*="Google"], button[onclick*="google"]', els =>
      els.map(el => ({ href: el.href, text: el.textContent }))
    );
    console.log('[DEBUG] Google links:', JSON.stringify(googleLinks));
    
    // Also check for iframes (Google Sign-In often uses iframes)
    const iframes = await page.$$eval('iframe', els => els.map(el => ({ src: el.src, id: el.id })));
    console.log('[DEBUG] Iframes:', JSON.stringify(iframes));
    
    // Print full page HTML summary
    const bodyText = await page.$eval('body', el => el.innerText.substring(0, 2000));
    console.log('[DEBUG] Page text:\n', bodyText);
  }
  
  if (clicked) {
    console.log('[3] Waiting for navigation...');
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(TMP, 'qoder-login-2.png'), fullPage: true });
    console.log('[✓] Screenshot 2 saved');
    console.log('[✓] Current URL:', page.url());
  }
  
  await browser.close();
  console.log('[DONE]');
})();
