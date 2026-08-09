import BaseWorker from '../base/BaseWorker.js';
import { sleep, randomSleep } from '../../utils/index.js';
import { googleLogin } from '../../providers/google/login.js';

const IBM_CLOUD_URL = 'https://cloud.ibm.com/registration';

export default class IbmBobWorker extends BaseWorker {
  get platformName() { return 'ibmbob'; }

  async executeForAccount(account, page, log) {
    const { email, password } = account;

    // Step 1: Navigate to IBM registration
    log(`  Navigating to IBM registration...`);
    await page.goto(IBM_CLOUD_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(3000);

    // Step 2: Find "Sign up with Google" link (it's an <a> tag, not a button)
    log(`  Looking for Google signup link...`);
    const googleHref = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const g = links.find(l => {
        const text = (l.textContent || '').toLowerCase();
        const href = (l.href || '').toLowerCase();
        return (text.includes('google') && text.includes('sign')) || href.includes('google');
      });
      return g ? g.href : '';
    });

    if (googleHref) {
      log(`  Found Google signup link, navigating...`);
      await page.goto(googleHref, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(3000);
    } else {
      throw new Error('Google signup link not found on IBM registration page');
    }

    // Step 3: Google OAuth login
    log(`  Completing Google OAuth...`);
    // Wait for Google login page to fully load
    try {
      await page.waitForSelector('input[type="email"], #identifierId', { timeout: 15000 });
    } catch {
      // May already be on Google login or redirected
      log(`  Current URL: ${page.url()}`);
    }

    const isGoogleLogin = await page.$('input[type="email"], #identifierId');
    if (isGoogleLogin) {
      log(`  Google login page detected, entering credentials...`);
      await googleLogin(page, email, password);
    } else {
      log(`  Not on Google login page, checking if already authenticated...`);
    }

    await sleep(5000);

    // Step 4: Handle post-login redirect
    log(`  Handling post-login redirect...`);
    const currentUrl = page.url();
    log(`  Current URL: ${currentUrl.substring(0, 100)}`);

    // Handle Google consent/speedbump
    for (let i = 0; i < 5; i++) {
      const url = page.url();
      if (!url.includes('accounts.google.com')) break;
      
      try {
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const btn = btns.find(b => {
            const t = (b.textContent || '').toLowerCase();
            return t.includes('continue') || t.includes('allow') || t.includes('accept') || t.includes('review');
          });
          if (btn) btn.click();
          // Also check checkboxes
          const cbs = document.querySelectorAll('input[type="checkbox"]');
          cbs.forEach(cb => { if (!cb.checked) cb.click(); });
        });
      } catch {}
      await sleep(2000);
    }

    // Step 5: Wait for IBM redirect
    try {
      await page.waitForFunction(
        () => !window.location.href.includes('accounts.google.com'),
        { timeout: 30000 }
      );
    } catch {}
    await sleep(3000);

    const afterUrl = page.url();
    log(`  After redirect: ${afterUrl.substring(0, 100)}`);

    // Check if blocked
    if (afterUrl.includes('unavailable') || afterUrl.includes('blocked')) {
      throw new Error('IBM: Service unavailable (IP blocked by IBM Security Verify)');
    }

    // Handle IBM ela notice / terms page
    if (afterUrl.includes('elanotice') || afterUrl.includes('notice')) {
      log(`  IBM ela notice page detected, clicking Proceed...`);
      // Click the "Proceed" button (id=confirm-btn)
      const proceedBtn = await page.$('#confirm-btn');
      if (proceedBtn) {
        await proceedBtn.click();
        await sleep(5000);
      } else {
        // Fallback: find by text
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const btn = btns.find(b => {
            const t = (b.textContent || '').toLowerCase();
            return t.includes('proceed') || t.includes('accept') || t.includes('continue');
          });
          if (btn) btn.click();
        });
        await sleep(5000);
      }
    }

    // Step 6: Handle IBM registration flow
    // Fill remaining fields if present
    try {
      const firstName = await page.$('#firstName, input[name="firstName"]');
      if (firstName) {
        await firstName.type('Mimo', { delay: 30 });
      }
      const lastName = await page.$('#lastName, input[name="lastName"]');
      if (lastName) {
        await lastName.type('Harvester', { delay: 30 });
      }

      // Check terms checkbox
      const terms = await page.$('#terms-and-condition-checkbox, input[type="checkbox"]');
      if (terms) {
        const checked = await terms.evaluate(el => el.checked);
        if (!checked) await terms.click();
      }

      // Click Next/Create
      const nextBtn = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => {
          const t = (b.textContent || '').toLowerCase();
          return t.includes('create account') || t.includes('next');
        });
        if (btn) { btn.click(); return true; }
        return false;
      });
      if (nextBtn) await sleep(5000);
    } catch {}

    // Step 7: Check for verification code
    const codeInput = await page.$('#emailCode, input[name="code"], input[placeholder*="code" i]');
    if (codeInput) {
      throw new Error('IBM: Verification code required (sent to email, cannot automate)');
    }

    // Check success
    const finalUrl = page.url();
    if (finalUrl.includes('dashboard') || finalUrl.includes('welcome') || finalUrl.includes('cloud.ibm.com/registration') && !finalUrl.includes('authorize')) {
      log(`  ✅ IBM registration successful!`);
      return { success: true, key: `ibmbob:${email}` };
    }

    throw new Error(`IBM: Unexpected state. URL: ${finalUrl.substring(0, 100)}`);
  }
}
