const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const HOME = process.env.HOME;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({
    executablePath: HOME + '/.cache/puppeteer/chrome/linux-151.0.7922.71/chrome-linux64/chrome',
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  
  console.log('[1] Opening sign-up...');
  await page.goto('https://adal.sylph.ai/sign-up', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(5000);
  
  // Enter email
  const emailInput = await page.$('#identifier-field') || await page.$('input[type="text"]');
  if (emailInput) {
    await emailInput.click({ clickCount: 3 });
    await emailInput.type('respati1@bozztirex.us', { delay: 80 });
    await sleep(1000);
    console.log('[2] Email entered');
  }
  
  // Find iframe position and click
  const iframeEl = await page.$('iframe[src*="turnstile"]') || await page.$('iframe[src*="challenges"]');
  if (iframeEl) {
    const box = await iframeEl.boundingBox();
    console.log('[3] Iframe:', JSON.stringify(box));
    
    // Click the checkbox (left side of iframe)
    await page.mouse.click(box.x + 30, box.y + box.height / 2);
    console.log('[4] Clicked checkbox');
    await sleep(8000);
    
    // Check token
    const token = await page.evaluate(() => {
      const inp = document.querySelector('input[name="cf-turnstile-response"]');
      return inp ? inp.value : '';
    });
    console.log('[5] Token:', token ? token.substring(0, 50) + '...' : 'empty');
    
    if (token) {
      // Click Continue
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const b of btns) { if (b.textContent.trim().toLowerCase() === 'continue') { b.click(); break; } }
      });
      await sleep(5000);
      console.log('[6] URL:', page.url());
      const body = await page.$eval('body', el => el.innerText.substring(0, 300)).catch(() => '');
      console.log('[6] Body:', body.replace(/\n/g, ' | ').substring(0, 200));
    }
  } else {
    console.log('[3] No iframe found');
  }
  
  await page.screenshot({ path: 'adal-headed-final.png' });
  console.log('[DONE]');
  await browser.close();
})();
