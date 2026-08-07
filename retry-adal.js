const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const http = require('http');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOME = process.env.HOME;

// Captcha solver helper
async function solveCaptcha(type, params) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ type, ...params });
    const req = http.request({
      hostname: '127.0.0.1', port: 8877, path: '/solve',
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(body); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function waitForCaptchaSolver() {
  return new Promise((resolve) => {
    http.get('http://127.0.0.1:8877/health', res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body).status === 'ok'); } catch { resolve(false); }
      });
    }).on('error', () => resolve(false));
  });
}

(async () => {
  const email = 'respati1@bozztirex.us';
  const password = 'Daffa112233';

  // Check captcha solver
  const solverReady = await waitForCaptchaSolver();
  console.log(`[Captcha Solver] ${solverReady ? '✅ Online' : '❌ Offline'}`);

  const browser = await puppeteer.launch({
    executablePath: `${HOME}/.cache/puppeteer/chrome/linux-151.0.7922.71/chrome-linux64/chrome`,
    headless: 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--disable-blink-features=AutomationControlled',
      '--window-size=1280,900'
    ]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Extra stealth
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    window.chrome = { runtime: {} };
  });

  try {
    // Step 1: Open AdaL
    console.log('\n[1] Opening AdaL login page...');
    await page.goto('https://adal.ai', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    console.log('  URL:', page.url());

    // Step 2: Find login/signup button
    console.log('[2] Looking for login/signup button...');
    const loginClicked = await page.evaluate(() => {
      const links = document.querySelectorAll('a, button');
      for (const el of links) {
        const text = (el.textContent || '').trim().toLowerCase();
        if (text.includes('login') || text.includes('sign in') || text.includes('get started') || text.includes('start building')) {
          el.click();
          return text;
        }
      }
      // Fallback: click first prominent CTA
      for (const el of links) {
        const text = (el.textContent || '').trim().toLowerCase();
        if (text.includes('free') || text.includes('try')) {
          el.click();
          return text;
        }
      }
      return null;
    });
    console.log(`  Clicked: "${loginClicked}"`);
    await sleep(5000);
    console.log('  URL:', page.url());

    // Step 3: Check for Clerk auth
    console.log('[3] Checking auth page...');
    await page.screenshot({ path: 'adal-step1.png' });

    // Look for Clerk sign-in
    const clerkUrl = page.url();
    if (clerkUrl.includes('clerk') || clerkUrl.includes('accounts')) {
      console.log('  → Clerk auth detected');
      
      // Check for BotGuard challenge
      const hasBgChallenge = await page.evaluate(() => {
        return !!(document.querySelector('[data-bgchallenge]') || 
                  document.querySelector('script[src*="botguard"]') ||
                  window.__bgRequest);
      });
      console.log(`  BotGuard challenge: ${hasBgChallenge ? '⚠️ Yes' : '❌ No'}`);

      // Try Google login
      console.log('[4] Clicking Google login...');
      const googleClicked = await page.evaluate(() => {
        const btns = document.querySelectorAll('button, a');
        for (const b of btns) {
          const text = (b.textContent || '').toLowerCase();
          if (text.includes('google') || text.includes('continue with google')) {
            b.click();
            return text;
          }
        }
        return null;
      });
      console.log(`  Clicked: "${googleClicked}"`);
      await sleep(5000);
      console.log('  URL:', page.url());

      // Step 5: Google OAuth
      if (page.url().includes('google') || page.url().includes('accounts')) {
        console.log('[5] Google OAuth page...');
        
        // Enter email
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

        // Enter password
        console.log('[6] Entering password...');
        try {
          const pwd = await page.waitForSelector('input[type="password"]', { timeout: 10000 });
          await pwd.click({ clickCount: 3 });
          await pwd.type(password, { delay: 80 });
          await sleep(1000);
          await page.keyboard.press('Enter');
          await sleep(5000);
        } catch (e) {
          console.log('  Password error:', e.message.substring(0, 100));
        }

        // Check for BotGuard after password
        console.log('[7] Checking for post-password challenges...');
        await page.screenshot({ path: 'adal-step2.png' });
        
        const pageContent = await page.$eval('body', el => el.innerText.substring(0, 1000)).catch(() => '');
        console.log('  Page text:', pageContent.substring(0, 200).replace(/\n/g, ' | '));

        // If BotGuard detected, try to solve it
        if (pageContent.includes('botguard') || pageContent.includes('bgRequest') || hasBgChallenge) {
          console.log('[8] Attempting BotGuard solve via captcha solver...');
          try {
            const bgResult = await solveCaptcha('botguard', {
              url: page.url(),
              timeout_s: 30
            });
            console.log('  BotGuard result:', JSON.stringify(bgResult).substring(0, 200));
          } catch (e) {
            console.log('  BotGuard solve error:', e.message);
          }
        }

        // Handle consent/speedbump
        console.log('[8] Handling post-login flow...');
        for (let i = 0; i < 10; i++) {
          await sleep(2000);
          const url = page.url();
          const text = await page.$eval('body', el => el.innerText.substring(0, 500)).catch(() => '');
          
          console.log(`  [${i}] URL: ${url.substring(0, 80)}`);
          
          if (url.includes('adal') && !url.includes('clerk') && !url.includes('accounts') && !url.includes('login')) {
            console.log('\n✅ LOGGED IN TO ADAL!');
            break;
          }
          
          if (text.includes('Access Restricted') || text.includes('temporarily unavailable') || text.includes('blocked')) {
            console.log('  ⚠️ RESTRICTED/BLOCKED');
            break;
          }

          // Handle __client_uat=0 issue
          const clientUat = await page.evaluate(() => {
            const match = document.cookie.match(/__client_uat=(\d+)/);
            return match ? match[1] : null;
          });
          if (clientUat === '0') {
            console.log('  ⚠️ __client_uat=0 detected (Clerk bot detection)');
            // Try to force refresh the session
            await page.evaluate(() => {
              document.cookie = '__client_uat=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            });
            await page.reload({ waitUntil: 'networkidle2' });
            await sleep(3000);
            continue;
          }

          if (text.includes('consent') || text.includes('allow') || text.includes('continue')) {
            await page.evaluate(() => {
              const btns = document.querySelectorAll('button');
              for (const b of btns) {
                const t = b.textContent.trim().toLowerCase();
                if (t.includes('continue') || t.includes('allow') || t.includes('accept') || t.includes('lanjutkan')) {
                  b.click(); break;
                }
              }
            });
            await sleep(3000);
            continue;
          }

          if (url.includes('speedbump') || url.includes('workspacetermsofservice')) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await sleep(1000);
            await page.evaluate(() => {
              const btns = document.querySelectorAll('button');
              for (const b of btns) {
                const t = b.textContent.trim().toLowerCase();
                if (t.includes('i understand') || t.includes('next') || t.includes('continue')) {
                  b.click(); break;
                }
              }
            });
            await sleep(3000);
            continue;
          }

          // Check for CAPTCHA on page
          if (text.includes('captcha') || text.includes('verify') || text.includes('challenge')) {
            console.log('  ⚠️ CAPTCHA detected on page!');
            await page.screenshot({ path: 'adal-captcha.png' });
            
            // Try to solve with captcha solver
            if (solverReady) {
              // Detect captcha type
              const captchaType = await page.evaluate(() => {
                if (document.querySelector('[data-sitekey]')) return 'recaptcha';
                if (document.querySelector('.h-captcha')) return 'hcaptcha';
                if (document.querySelector('[data-turnstile]')) return 'turnstile';
                return 'unknown';
              });
              console.log(`  Captcha type: ${captchaType}`);
            }
            break;
          }

          break;
        }
      }
    }

    await page.screenshot({ path: 'adal-final.png' });
    console.log('\n[Final URL]:', page.url());

    // Extract cookies
    const cookies = await page.cookies();
    const adalCookies = cookies.filter(c => c.domain.includes('adal') || c.domain.includes('clerk'));
    console.log(`[Cookies]: ${adalCookies.length} adal/clerk cookies`);
    adalCookies.forEach(c => console.log(`  ${c.name} = ${c.value.substring(0, 60)}...`));
    fs.writeFileSync('adal-cookies-new.json', JSON.stringify(cookies, null, 2));

    // Test CLI
    console.log('\n[9] Testing AdaL CLI...');
    const { execSync } = require('child_process');
    try {
      const result = execSync('timeout 20 ~/.local/bin/adal -p "Hello, what model are you?"', {
        encoding: 'utf-8', timeout: 25000
      });
      console.log('[✅] CLI Response:', result.trim().substring(0, 200));
    } catch (e) {
      console.log('[CLI Error]:', e.message.substring(0, 200));
    }

  } catch (e) {
    console.error('[Error]:', e.message);
    await page.screenshot({ path: 'adal-error.png' }).catch(() => {});
  }

  await browser.close();
  console.log('\n[DONE]');
})();
