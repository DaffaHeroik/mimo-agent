import BaseWorker from '../base/BaseWorker.js';
import { sleep, randomSleep } from '../../utils/index.js';
import { googleLogin } from '../../providers/google/login.js';
import fetch from 'node-fetch';

const QODER_BASE = 'https://qoder.com';
const QODER_API = 'https://center.qoder.sh';

export default class QoderWorker extends BaseWorker {
  get platformName() { return 'qoder'; }

  async executeForAccount(account, page, log) {
    const { email, password } = account;

    // Step 1: Navigate to Qoder sign-in page
    log(`  Navigating to Qoder sign-in...`);
    await page.goto(`${QODER_BASE}/users/sign-in`, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(2000);

    // Step 2: Click "Sign in with Google"
    log(`  Looking for Google sign-in link...`);
    const googleLink = await page.$('a[href*="/sso/login/google"]');
    if (googleLink) {
      log(`  Found Google sign-in link, clicking...`);
      await googleLink.click();
      await sleep(3000);
    } else {
      throw new Error('Cannot find Google login on Qoder sign-in page');
    }

    // Step 3: Google OAuth
    log(`  Completing Google OAuth...`);
    try {
      await page.waitForSelector('input[type="email"], #identifierId', { timeout: 15000 });
    } catch {}
    const isGoogleLogin = await page.$('input[type="email"], #identifierId');
    if (isGoogleLogin) {
      await googleLogin(page, email, password);
    }

    // Handle consent screens
    for (let i = 0; i < 5; i++) {
      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => {
          const t = (b.textContent || '').toLowerCase();
          return t.includes('continue') || t.includes('allow') || t.includes('accept') || t.includes('review');
        });
        if (btn) { btn.click(); return btn.textContent.trim(); }
        const cbs = document.querySelectorAll('input[type="checkbox"]');
        for (const cb of cbs) { if (!cb.checked) { cb.click(); return 'checkbox'; } }
        return null;
      });
      if (clicked) {
        await sleep(2000);
      } else break;
    }

    await sleep(5000);

    // Step 4: Verify login by checking account page
    log(`  Verifying login...`);
    await page.goto(`${QODER_BASE}/account/profile`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    const finalUrl = page.url();
    log(`  Final URL: ${finalUrl}`);

    // Check if logged in
    const profileText = await page.evaluate(() => document.body.innerText).catch(() => '');
    if (profileText.includes(email) || profileText.includes('Profile') || profileText.includes('Usage')) {
      log(`  ✅ Qoder login successful!`);
      
      // Extract session cookies
      const cookies = await page.cookies();
      const sessionCookie = cookies.find(c => c.name === 'qoder_session_cookie');
      const uidCookie = cookies.find(c => c.name === 'qoderuid');
      
      const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      
      // Try to claim via web API
      log(`  Attempting to claim 800 free calls...`);
      const claimResult = await this.claimViaWeb(cookieStr, email, log);
      
      return { 
        success: true, 
        key: `${email}|session:${sessionCookie ? sessionCookie.value.substring(0, 20) : 'none'}|${claimResult}` 
      };
    }

    throw new Error(`Qoder: Login verification failed. URL: ${finalUrl}`);
  }

  async claimViaWeb(cookieStr, email, log = console.log) {
    // Try claim endpoints with session cookies
    const endpoints = [
      `${QODER_API}/algo/api/v2/activity/claim`,
      `${QODER_BASE}/api/activity/claim`,
      `${QODER_BASE}/api/credits/claim`,
    ];

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieStr,
          },
          body: JSON.stringify({}),
          redirect: 'manual',
        });

        const status = res.status;
        const body = await res.text().catch(() => '');
        log(`    ${endpoint}: ${status} ${body.substring(0, 100)}`);
        
        if (status >= 200 && status < 400) {
          return `claimed-via-web`;
        }
      } catch (err) {
        log(`    ${endpoint}: error ${err.message}`);
      }
    }

    // Also try via browser fetch (uses cookies automatically)
    log(`  Trying claim via browser fetch...`);
    try {
      // We need to do this in the browser context
      // But we don't have access to page here, so we'll try via API
      return 'claim-needs-cli';
    } catch {}

    return 'claim-needs-manual';
  }
}
