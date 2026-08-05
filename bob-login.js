const puppeteer = require('/home/work/.openclaw/tmp/node_modules/puppeteer-extra');
const StealthPlugin = require('/home/work/.openclaw/tmp/node_modules/puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const { spawn } = require('child_process');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOME = process.env.HOME;

async function clickByText(page, texts) {
  return page.evaluate((texts) => {
    const btns = document.querySelectorAll('button, a, div[role="button"]');
    for (const b of btns) {
      const t = (b.textContent || '').trim().toLowerCase();
      if (texts.some(x => t.includes(x.toLowerCase()))) { b.click(); return t; }
    }
    return null;
  }, texts);
}

(async () => {
  const email = 'respati1@bozztirex.us';
  const password = 'Daffa112233';

  // Start bob
  const bobProc = spawn(HOME + '/.local/node_modules/.bin/bob', ['-p', 'Hello'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  let loginUrl = '';
  bobProc.stderr.on('data', d => {
    const m = d.toString().match(/https:\/\/bob\.ibm\.com\/login[^\s]+/);
    if (m) loginUrl = m[0];
  });
  bobProc.stdout.on('data', d => process.stdout.write('[BOB] ' + d));

  console.log('[1] Getting login URL...');
  for (let i = 0; i < 20; i++) { await sleep(500); if (loginUrl) break; }
  if (!loginUrl) { console.log('[!] No URL'); bobProc.kill(); return; }
  console.log('[✓]', loginUrl.substring(0, 80));

  const browser = await puppeteer.launch({
    executablePath: HOME + '/.local/chrome/chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Open IBM Bob login
  console.log('[2] Opening IBM Bob login...');
  await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(3000);

  // Accept cookies
  console.log('[2.5] Accepting cookies...');
  await clickByText(page, ['accept all']);
  await sleep(2000);

  // Click Google login
  console.log('[3] Clicking Google login...');
  const clicked = await clickByText(page, ['continue with google', 'google']);
  console.log('[✓] Clicked:', clicked);
  await sleep(8000);
  console.log('[URL]:', page.url().substring(0, 100));

  // Google login
  if (page.url().includes('google') || page.url().includes('accounts')) {
    console.log('[4] Email...');
    let inp;
    try { inp = await page.waitForSelector('input[type="email"]', { timeout: 5000 }); }
    catch { inp = await page.$('input[type="text"]'); }
    if (inp) {
      await inp.click({ clickCount: 3 });
      await inp.type(email, { delay: 60 });
      await sleep(1000);
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const b of btns) { if (b.textContent.trim() === 'Next') { b.click(); break; } }
      });
      await sleep(5000);
    }

    console.log('[5] Password...');
    try {
      const pwd = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
      if (pwd) {
        await pwd.click({ clickCount: 3 });
        await pwd.type(password, { delay: 60 });
        await sleep(1000);
        await page.evaluate(() => {
          const btn = document.querySelector('#passwordNext');
          if (btn) btn.click();
          else { const btns = document.querySelectorAll('button'); for (const b of btns) { if (b.textContent.trim() === 'Next') { b.click(); break; } } }
        });
        await sleep(10000);
      }
    } catch (e) {
      console.log('[!] Password error:', e.message.substring(0, 100));
    }
  }

  // Post-login loop
  console.log('[6] Post-login...');
  for (let i = 0; i < 12; i++) {
    await sleep(2000);
    const url = page.url();
    const text = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');

    console.log('[' + i + '] ' + url.substring(0, 80));
    console.log('    ' + text.substring(0, 120).replace(/\n/g, ' | '));

    if (url.includes('bob.ibm.com') && !url.includes('login')) {
      console.log('\n✅ LOGGED IN TO IBM BOB!');
      break;
    }

    if (text.includes('Access Restricted') || text.includes('temporarily unavailable')) {
      console.log('  ⚠️ RESTRICTED');
      break;
    }

    if (text.includes('Link Account') || url.includes('first-broker-login')) {
      await clickByText(page, ['submit', 'link', 'confirm', 'register']);
      await sleep(5000);
      continue;
    }

    if (url.includes('oauth') || url.includes('consent')) {
      await clickByText(page, ['allow', 'continue', 'accept', 'lanjutkan']);
      await sleep(3000);
      continue;
    }

    if (url.includes('speedbump') || url.includes('workspacetermsofservice')) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(1000);
      await clickByText(page, ['i understand', 'understand', 'next', 'continue']);
      await sleep(3000);
      continue;
    }

    // CAPTCHA check
    if (text.includes('captcha') || text.includes('type the text') || text.includes('hear or see')) {
      console.log('  ⚠️ CAPTCHA detected!');
      break;
    }

    break;
  }

  await page.screenshot({ path: '/home/work/.openclaw/workspace/bob-final.png' });
  console.log('\nFinal URL:', page.url());

  const cookies = await page.cookies();
  const ibmCookies = cookies.filter(c => c.domain.includes('ibm') || c.domain.includes('bob'));
  console.log('Cookies:', ibmCookies.length);
  ibmCookies.forEach(c => console.log('  ' + c.name + ' = ' + c.value.substring(0, 40)));

  fs.writeFileSync('/home/work/.openclaw/workspace/bob-cookies.json', JSON.stringify(cookies, null, 2));

  await browser.close();
  bobProc.kill();
  console.log('[DONE]');
})();
