const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOME = process.env.HOME;

(async () => {
  const email = 'respati1@bozztirex.us';
  const password = 'Daffa112233';

  const browser = await puppeteer.launch({
    executablePath: `${HOME}/.cache/puppeteer/chrome/linux-151.0.7922.71/chrome-linux64/chrome`,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    // Go directly to Clerk sign-in
    console.log('[1] Opening Clerk sign-in directly...');
    await page.goto('https://clerk.adal.sylph.ai/sign-in', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    console.log('  URL:', page.url());
    
    // Dump page content
    const bodyText = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => 'empty');
    console.log('  Body:', bodyText.substring(0, 300).replace(/\n/g, ' | '));
    
    // Check all inputs
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.type, name: i.name, id: i.id, placeholder: i.placeholder
      }));
    });
    console.log('  Inputs:', JSON.stringify(inputs));
    
    // Check all buttons/links
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, a')).map(b => ({
        tag: b.tagName, text: b.textContent.trim().substring(0, 50), href: b.href || ''
      })).filter(b => b.text.length > 0);
    });
    console.log('  Buttons:', JSON.stringify(buttons.slice(0, 15)));

    await page.screenshot({ path: 'adal-clerk-direct.png' });

    // Try Google OAuth if available
    console.log('\n[2] Looking for Google login...');
    const googleBtn = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, a');
      for (const b of btns) {
        const text = (b.textContent || '').toLowerCase();
        const href = (b.href || '').toLowerCase();
        if (text.includes('google') || href.includes('google')) {
          b.click();
          return text;
        }
      }
      return null;
    });
    console.log(`  Google button: "${googleBtn}"`);
    
    if (googleBtn) {
      await sleep(5000);
      console.log('  URL after Google:', page.url());
      
      // Google OAuth flow
      if (page.url().includes('google') || page.url().includes('accounts')) {
        console.log('[3] Google OAuth...');
        let emailInput;
        try { emailInput = await page.waitForSelector('input[type="email"]', { timeout: 5000 }); }
        catch { emailInput = await page.$('input[type="text"]'); }
        if (emailInput) {
          await emailInput.click({ clickCount: 3 });
          await emailInput.type(email, { delay: 80 });
          await sleep(1000);
          await page.keyboard.press('Enter');
          await sleep(5000);
        }
        
        try {
          const pwd = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
          await pwd.click({ clickCount: 3 });
          await pwd.type(password, { delay: 80 });
          await sleep(1000);
          await page.keyboard.press('Enter');
          await sleep(8000);
        } catch (e) {
          console.log('  Password error:', e.message.substring(0, 100));
        }
        
        // Post-login
        for (let i = 0; i < 8; i++) {
          await sleep(2000);
          const url = page.url();
          const text = await page.$eval('body', el => el.innerText.substring(0, 300)).catch(() => '');
          console.log(`  [${i}] ${url.substring(0, 80)} | ${text.substring(0, 80).replace(/\n/g, ' ')}`);
          
          if (url.includes('adal') && !url.includes('clerk') && !url.includes('accounts')) {
            console.log('\n✅ LOGGED IN!');
            break;
          }
          if (text.includes('restricted') || text.includes('blocked') || text.includes('unavailable')) {
            console.log('  ⚠️ BLOCKED');
            break;
          }
          
          // Handle consent
          const consentClicked = await page.evaluate(() => {
            const btns = document.querySelectorAll('button');
            for (const b of btns) {
              const t = b.textContent.trim().toLowerCase();
              if (t.includes('continue') || t.includes('allow') || t.includes('accept') || t.includes('lanjutkan')) {
                b.click(); return t;
              }
            }
            return null;
          });
          if (consentClicked) {
            console.log(`  Consent: "${consentClicked}"`);
            await sleep(3000);
          }
        }
      }
    } else {
      // No Google button — try email/password directly
      console.log('[2b] Trying email/password directly...');
      const emailInput = await page.$('input[type="email"]') || await page.$('input[type="text"]') || await page.$('input[name="identifier"]');
      if (emailInput) {
        await emailInput.click({ clickCount: 3 });
        await emailInput.type(email, { delay: 80 });
        await sleep(1000);
        
        // Look for continue/next button
        await page.evaluate(() => {
          const btns = document.querySelectorAll('button');
          for (const b of btns) {
            const t = b.textContent.trim().toLowerCase();
            if (t.includes('continue') || t.includes('next')) { b.click(); break; }
          }
        });
        await sleep(5000);
        
        // Password
        try {
          const pwd = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
          await pwd.click({ clickCount: 3 });
          await pwd.type(password, { delay: 80 });
          await sleep(1000);
          await page.keyboard.press('Enter');
          await sleep(8000);
        } catch (e) {
          console.log('  Password error:', e.message.substring(0, 100));
        }
      } else {
        console.log('  No email input found');
      }
    }

    await page.screenshot({ path: 'adal-final.png' });
    console.log('\n[Final URL]:', page.url());
    
    const cookies = await page.cookies();
    console.log('[Cookies]:', cookies.length);
    fs.writeFileSync('adal-cookies-new.json', JSON.stringify(cookies, null, 2));

  } catch (e) {
    console.error('[Error]:', e.message);
    await page.screenshot({ path: 'adal-error.png' }).catch(() => {});
  }

  await browser.close();
  console.log('[DONE]');
})();
