import BaseWorker from '../base/BaseWorker.js';
import { sleep, randomSleep } from '../../utils/index.js';
import { getEmailProvider } from '../../providers/email/index.js';
import config from '../../config/index.js';

const BLACKBOX_BASE = 'https://www.blackbox.ai';
const NOVABOX_API = 'https://api.novabox.io';

export default class NovaboxWorker extends BaseWorker {
  get platformName() {
    return 'novabox';
  }

  async executeForAccount(account, page, log) {
    // Novabox uses temp email for registration, not Google OAuth
    // The account email/password are used as fallback if temp email fails

    // Step 1: Create temp email
    log(`  Creating temp email...`);
    const emailProvider = getEmailProvider(config.TEMP_EMAIL_PROVIDER);
    const emailAccount = await emailProvider.createAccount();
    const tempEmail = emailAccount.address;
    log(`  Temp email: ${tempEmail}`);

    // Step 2: Navigate to Blackbox.ai / Novabox registration
    log(`  Navigating to Blackbox.ai...`);
    await page.goto(`${BLACKBOX_BASE}`, { waitUntil: 'networkidle', timeout: 60000 });
    await sleep(2000);

    // Look for sign up / register
    const signupBtn = await page.$(
      'a:has-text("Sign Up"), a:has-text("Register"), button:has-text("Sign Up"), a[href*="signup"], a[href*="register"]'
    );

    if (signupBtn) {
      await signupBtn.click();
      await sleep(3000);
    } else {
      await page.goto(`${BLACKBOX_BASE}/signup`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      await sleep(2000);
    }

    // Step 3: Fill registration form
    log(`  Filling registration form...`);
    const randomPass = `BlkBx!${Math.random().toString(36).slice(2)}${Date.now()}`;

    // Email
    const emailInput = await page.$(
      'input[name="email"], input[type="email"], input[placeholder*="email"], input[placeholder*="Email"]'
    );
    if (emailInput) {
      await emailInput.fill(tempEmail);
      await randomSleep(300, 800);
    }

    // Password
    const passInputs = await page.$$('input[type="password"]');
    if (passInputs.length >= 1) {
      await passInputs[0].fill(randomPass);
      await randomSleep(300, 800);
    }
    if (passInputs.length >= 2) {
      await passInputs[1].fill(randomPass); // confirm password
      await randomSleep(300, 800);
    }

    // Name (if present)
    const nameInput = await page.$('input[name="name"], input[name="firstName"], input[placeholder*="name"]');
    if (nameInput) {
      await nameInput.fill(`MimoUser${Math.random().toString(36).slice(2, 8)}`);
      await randomSleep(300, 800);
    }

    // Submit registration
    const submitBtn = await page.$(
      'button[type="submit"], button:has-text("Sign Up"), button:has-text("Register"), button:has-text("Create Account")'
    );
    if (submitBtn) {
      await submitBtn.click();
      await sleep(5000);
    }

    // Step 4: Check for verification email
    log(`  Waiting for verification email...`);
    let verificationLink = '';

    try {
      const email = await emailProvider.waitForEmail(
        (msg) => {
          const subject = (msg.subject || '').toLowerCase();
          const from = (msg.from?.address || msg.from || '').toLowerCase();
          return (
            subject.includes('verif') ||
            subject.includes('confirm') ||
            subject.includes('activate') ||
            from.includes('blackbox') ||
            from.includes('novabox')
          );
        },
        120000,
        5000
      );

      // Extract verification link
      const body = email.text || email.html || email.body || '';
      const linkMatch = body.match(/(https?:\/\/[^\s"<>]+(?:verify|confirm|activate)[^\s"<>]*)/i);
      if (linkMatch) {
        verificationLink = linkMatch[1];
      }

      // Also check for verification code
      const codeMatch = body.match(/(?:code|OTP|pin)[:\s]*(\d{4,8})/i);
      if (codeMatch && !verificationLink) {
        // Navigate to verification page and enter code
        const codeInput = await page.$('input[name="code"], input[name="otp"], input[placeholder*="code"]');
        if (codeInput) {
          await codeInput.fill(codeMatch[1]);
          const verifyBtn = await page.$('button:has-text("Verify"), button:has-text("Confirm"), button[type="submit"]');
          if (verifyBtn) await verifyBtn.click();
          await sleep(3000);
        }
      }
    } catch (err) {
      log(`  Warning: ${err.message}. Trying without verification...`);
    }

    // Step 5: Visit verification link if found
    if (verificationLink) {
      log(`  Verifying email...`);
      await page.goto(verificationLink, { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(3000);
    }

    // Step 6: Navigate to API keys / settings
    log(`  Getting API key...`);
    await page.goto(`${BLACKBOX_BASE}/settings`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await sleep(2000);

    // Also try the API directly
    let apiKey = '';

    // Try to find API key on settings page
    apiKey = await page.evaluate(() => {
      const elements = document.querySelectorAll('code, .api-key, .key, pre, [data-key], input[readonly]');
      for (const el of elements) {
        const text = (el.textContent || el.value || '').trim();
        if (text.length > 20 && text.match(/^[a-zA-Z0-9_-]{20,}$/)) {
          return text;
        }
      }
      return '';
    });

    // If no key found, try creating one
    if (!apiKey) {
      apiKey = await this.createApiKey(page);
    }

    // Try getting key from API endpoints
    if (!apiKey) {
      apiKey = await this.fetchApiKeyFromAPI(page);
    }

    if (!apiKey) {
      throw new Error('Could not obtain API key from Novabox/Blackbox.ai');
    }

    log(`  API key: ${apiKey.substring(0, 15)}...`);

    return {
      success: true,
      key: `${tempEmail}|${apiKey}`,
    };
  }

  async createApiKey(page) {
    try {
      // Navigate to API keys page
      await page.goto(`${BLACKBOX_BASE}/api-keys`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      await sleep(2000);

      const createBtn = await page.$(
        'button:has-text("Create"), button:has-text("Generate"), button:has-text("New"), button:has-text("Add")'
      );

      if (createBtn) {
        await createBtn.click();
        await sleep(2000);

        // Fill name if needed
        const nameInput = await page.$('input[name="name"], input[placeholder*="name"]');
        if (nameInput) {
          await nameInput.fill(`key-${Date.now()}`);
          await randomSleep(200, 500);
        }

        const submitBtn = await page.$('button[type="submit"], button:has-text("Create"), button:has-text("Save")');
        if (submitBtn) {
          await submitBtn.click();
          await sleep(3000);
        }

        // Extract key
        const key = await page.evaluate(() => {
          const all = document.querySelectorAll('code, pre, .key, input[readonly], [data-key]');
          for (const el of all) {
            const text = (el.textContent || el.value || '').trim();
            if (text.length > 20) return text;
          }
          return '';
        });

        if (key) return key;
      }
    } catch {
      // ignore
    }
    return '';
  }

  async fetchApiKeyFromAPI(page) {
    return new Promise((resolve) => {
      let key = '';
      const handler = async (response) => {
        try {
          const url = response.url();
          if ((url.includes('key') || url.includes('api')) && response.status() >= 200 && response.status() < 300) {
            const body = await response.json().catch(() => null);
            if (body) {
              const possible = body.key || body.api_key || body.apiKey || body.token || body.secret || '';
              if (typeof possible === 'string' && possible.length > 15) key = possible;
              // Check nested
              if (body.keys && Array.isArray(body.keys) && body.keys.length > 0) {
                key = body.keys[0].key || body.keys[0].api_key || key;
              }
            }
          }
        } catch {
          // ignore
        }
      };

      page.on('response', handler);
      // Trigger a page that might return keys
      page.reload().catch(() => {});
      setTimeout(() => {
        page.removeListener('response', handler);
        resolve(key);
      }, 10000);
    });
  }
}
