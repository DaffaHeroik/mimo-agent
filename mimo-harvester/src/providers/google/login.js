import { sleep, randomSleep } from '../../utils/index.js';

/**
 * Google OAuth login helper using Puppeteer + Stealth.
 * Handles navigation properly to avoid context destruction.
 */
export async function googleLogin(page, email, password, opts = {}) {
  const { timeout = 60000 } = opts;

  try {
    // Wait for Google login page
    let emailInput;
    try {
      emailInput = await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    } catch {
      try {
        emailInput = await page.waitForSelector('#identifierId', { timeout: 10000 });
      } catch {
        throw new Error('Email input not found on Google login page');
      }
    }

    // Enter email
    try {
      await emailInput.click({ clickCount: 3 });
    } catch {
      await page.evaluate(() => {
        const input = document.querySelector('input[type="email"], #identifierId');
        if (input) { input.focus(); input.value = ''; }
      });
    }
    await emailInput.type(email, { delay: 50 });
    await randomSleep(500, 1000);
    
    // Press Enter and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      page.keyboard.press('Enter'),
    ]);

    await sleep(3000);

    // Check if rejected
    const afterEmailUrl = page.url();
    if (afterEmailUrl.includes('rejected') || afterEmailUrl.includes('denied')) {
      throw new Error('Google rejected login attempt (datacenter IP detected)');
    }

    // Wait for password field
    let passwordInput;
    try {
      passwordInput = await page.waitForSelector('input[type="password"]', { timeout: 15000 });
    } catch {
      throw new Error('Password field not found — Google may have blocked this IP');
    }

    // Enter password
    try {
      await passwordInput.click({ clickCount: 3 });
    } catch {
      // Fallback: use evaluate to focus and clear
      await page.evaluate(() => {
        const input = document.querySelector('input[type="password"]');
        if (input) { input.focus(); input.value = ''; }
      });
    }
    await passwordInput.type(password, { delay: 50 });
    await randomSleep(500, 1000);
    
    // Press Enter and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      page.keyboard.press('Enter'),
    ]);

    await sleep(5000);

    // Handle consent/speedbump
    await handleConsentScreens(page);

    return true;
  } catch (err) {
    throw new Error(`Google login failed for ${email}: ${err.message}`);
  }
}

/**
 * Handle Google consent, speedbump, and security challenge screens.
 */
async function handleConsentScreens(page) {
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(2000);
    
    let url;
    try {
      url = page.url();
    } catch {
      // Context destroyed due to navigation, wait and retry
      await sleep(2000);
      continue;
    }

    // If we're back on the target site, done
    if (!url.includes('google.com') && !url.includes('accounts.google')) {
      break;
    }

    // Handle consent/speedbump
    try {
      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        for (const btn of btns) {
          const text = btn.textContent.toLowerCase().trim();
          if (text.includes('continue') || text.includes('allow') || 
              text.includes('accept') || text.includes('i understand') ||
              text.includes('lanjutkan') || text.includes('review') ||
              text.includes('confirm')) {
            btn.click();
            return text;
          }
        }
        // Also check checkboxes
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        for (const cb of checkboxes) {
          if (!cb.checked) {
            cb.click();
            return 'checkbox';
          }
        }
        return null;
      });
      
      if (clicked) {
        await sleep(2000);
      }
    } catch {
      // Context may have been destroyed due to navigation
      await sleep(2000);
    }

    // Handle 2FA
    try {
      const has2FA = await page.$('input[type="tel"], input[type="totp"]');
      if (has2FA) {
        throw new Error('2FA required — cannot automate');
      }
    } catch (e) {
      if (e.message.includes('2FA')) throw e;
    }
  }
}

export default googleLogin;
