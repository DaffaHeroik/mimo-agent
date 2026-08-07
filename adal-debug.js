const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOME = process.env.HOME;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: `${HOME}/.cache/puppeteer/chrome/linux-151.0.7922.71/chrome-linux64/chrome`,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    // Intercept all requests to find auth endpoints
    const authUrls = [];
    page.on('request', req => {
      const url = req.url();
      if (url.includes('auth') || url.includes('login') || url.includes('sign') || url.includes('clerk') || url.includes('oauth')) {
        authUrls.push(url);
      }
    });

    console.log('[1] Loading adal.ai...');
    await page.goto('https://adal.ai', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    // Get ALL links and their hrefs
    const allLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.textContent.trim().substring(0, 60),
        href: a.href,
        classes: a.className.substring(0, 50)
      })).filter(l => l.text.length > 0);
    });
    console.log('\n[2] All links on page:');
    allLinks.forEach(l => console.log(`  "${l.text}" → ${l.href}`));

    // Get all buttons
    const allBtns = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent.trim().substring(0, 60),
        classes: b.className.substring(0, 50),
        onclick: b.getAttribute('onclick') || ''
      }));
    });
    console.log('\n[3] All buttons:');
    allBtns.forEach(b => console.log(`  "${b.text}" class=${b.classes}`));

    // Check for iframes
    const iframes = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('iframe')).map(f => f.src);
    });
    console.log('\n[4] Iframes:', iframes);

    // Check for any popup/modal triggers
    const dataAttrs = await page.evaluate(() => {
      const els = document.querySelectorAll('[data-action], [data-modal], [data-auth], [data-login], [data-signup]');
      return Array.from(els).map(el => ({
        tag: el.tagName,
        text: el.textContent.trim().substring(0, 40),
        attrs: Array.from(el.attributes).map(a => `${a.name}=${a.value}`).join(', ')
      }));
    });
    console.log('\n[5] Data-attr elements:', JSON.stringify(dataAttrs.slice(0, 10)));

    // Try clicking "Get Started Free" by coordinates
    console.log('\n[6] Trying to click Get Started Free by finding it...');
    const getStartedPos = await page.evaluate(() => {
      const els = document.querySelectorAll('a, button, span, div');
      for (const el of els) {
        const text = el.textContent.trim();
        if (text === 'Get Started Free' || text === 'Start Building — It\'s Free') {
          const rect = el.getBoundingClientRect();
          return { x: rect.x + rect.width/2, y: rect.y + rect.height/2, text, tag: el.tagName, href: el.href || '' };
        }
      }
      return null;
    });
    console.log('  Found:', JSON.stringify(getStartedPos));

    if (getStartedPos) {
      console.log(`  Clicking at (${getStartedPos.x}, ${getStartedPos.y})...`);
      await page.mouse.click(getStartedPos.x, getStartedPos.y);
      await sleep(5000);
      console.log('  URL after click:', page.url());
      
      // Check for new tabs
      const pages = await browser.pages();
      console.log('  Open pages:', pages.length);
      for (const p of pages) {
        console.log('    →', p.url());
      }
    }

    console.log('\n[7] Auth-related URLs intercepted:', authUrls.slice(0, 20));

    await page.screenshot({ path: 'adal-debug.png' });

  } catch (e) {
    console.error('[Error]:', e.message);
  }

  await browser.close();
  console.log('[DONE]');
})();
