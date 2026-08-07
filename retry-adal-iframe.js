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
    console.log('[1] Opening sign-up page...');
    await page.goto('https://adal.sylph.ai/sign-up', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(5000);

    // Enter email first
    console.log('[2] Entering email...');
    const emailInput = await page.$('#identifier-field') || await page.$('input[name="identifier"]') || await page.$('input[type="text"]');
    if (emailInput) {
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(email, { delay: 80 });
      await sleep(1000);
      console.log('  ✅ Email entered');
    }

    // Find and interact with Turnstile iframe
    console.log('[3] Looking for Turnstile iframe...');
    const iframes = await page.frames();
    console.log(`  Found ${iframes.length} frames`);
    
    let turnstileFrame = null;
    for (const frame of iframes) {
      const url = frame.url();
      console.log(`  Frame: ${url.substring(0, 100)}`);
      if (url.includes('turnstile') || url.includes('challenges.cloudflare')) {
        turnstileFrame = frame;
        console.log('  ✅ Turnstile frame found!');
      }
    }

    if (turnstileFrame) {
      // Try to click the checkbox inside the iframe
      console.log('[4] Clicking Turnstile checkbox in iframe...');
      
      // Get the iframe position on the page
      const iframeElement = await page.$('iframe[src*="turnstile"]') || await page.$('iframe[src*="challenges.cloudflare"]');
      if (iframeElement) {
        const box = await iframeElement.boundingBox();
        console.log(`  Iframe box: ${JSON.stringify(box)}`);
        
        // Click inside the iframe (checkbox is typically at left side)
        const clickX = box.x + 30;
        const clickY = box.y + box.height / 2;
        console.log(`  Clicking at (${clickX}, ${clickY})`);
        await page.mouse.click(clickX, clickY);
        await sleep(8000);
        
        // Check if it worked
        const afterClick = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
        console.log('  After click:', afterClick.substring(0, 200).replace(/\n/g, ' | '));
        await page.screenshot({ path: 'adal-turnstile-clicked.png' });
        
        // Check the hidden input value
        const tokenValue = await page.evaluate(() => {
          const input = document.querySelector('input[name="cf-turnstile-response"]');
          return input ? input.value : 'no input';
        });
        console.log(`  Token value: ${tokenValue ? tokenValue.substring(0, 50) + '...' : 'empty'}`);
      }
      
      // Also try clicking the checkbox directly in the frame
      console.log('[5] Trying to click checkbox element in frame...');
      try {
        const checkbox = await turnstileFrame.$('input[type="checkbox"]') || 
                         await turnstileFrame.$('#cf-chl-widget-ntpw9') ||
                         await turnstileFrame.$('[id*="turnstile"]') ||
                         await turnstileFrame.$('.mark');
        if (checkbox) {
          await checkbox.click();
          console.log('  ✅ Checkbox clicked in frame');
          await sleep(5000);
        } else {
          console.log('  No checkbox element found in frame');
          // Try to find any clickable element
          const clickable = await turnstileFrame.$$('button, input, [role="checkbox"]');
          console.log(`  Found ${clickable.length} clickable elements in frame`);
        }
      } catch (e) {
        console.log('  Frame interaction error:', e.message.substring(0, 100));
      }
    } else {
      console.log('  ❌ No Turnstile iframe found');
      
      // Try clicking the container directly
      const container = await page.$('.turnstile-container') || await page.$('#turnstile-widget');
      if (container) {
        const box = await container.boundingBox();
        console.log(`  Container box: ${JSON.stringify(box)}`);
        await page.mouse.click(box.x + 30, box.y + box.height / 2);
        await sleep(5000);
      }
    }

    // Check state after clicking
    console.log('\n[6] Checking verification state...');
    const verifyState = await page.evaluate(() => {
      const input = document.querySelector('input[name="cf-turnstile-response"]');
      const hasToken = input && input.value && input.value.length > 10;
      const bodyText = document.body.innerText;
      const stillVerify = bodyText.includes('complete the verification');
      return { hasToken, stillVerify, tokenLen: input?.value?.length || 0 };
    });
    console.log(`  Has token: ${verifyState.hasToken} (len: ${verifyState.tokenLen})`);
    console.log(`  Still needs verify: ${verifyState.stillVerify}`);

    // If still needs verification, try a different approach
    if (verifyState.stillVerify && !verifyState.hasToken) {
      console.log('\n[7] Trying alternative: wait for Turnstile to auto-solve...');
      // Some Turnstile widgets auto-solve after a delay
      for (let i = 0; i < 15; i++) {
        await sleep(2000);
        const token = await page.evaluate(() => {
          const input = document.querySelector('input[name="cf-turnstile-response"]');
          return input ? input.value : '';
        });
        if (token && token.length > 10) {
          console.log(`  ✅ Token appeared after ${i*2}s!`);
          break;
        }
        console.log(`  Waiting... (${i*2}s)`);
      }
    }

    // Click Continue
    console.log('\n[8] Clicking Continue...');
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        const t = b.textContent.trim().toLowerCase();
        if (t === 'continue') { b.click(); return; }
      }
    });
    await sleep(5000);
    console.log('  URL:', page.url());

    // Final check
    const finalBody = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
    console.log('  Body:', finalBody.substring(0, 300).replace(/\n/g, ' | '));
    await page.screenshot({ path: 'adal-final.png' });

    // __client_uat
    const uat = await page.evaluate(() => {
      const m = document.cookie.match(/__client_uat=(\d+)/);
      return m ? m[1] : null;
    });
    console.log(`  __client_uat: ${uat}`);

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
