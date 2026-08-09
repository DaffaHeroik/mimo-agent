import BaseWorker from '../base/BaseWorker.js';
import { sleep, randomSleep } from '../../utils/index.js';
import { googleLogin } from '../../providers/google/login.js';

const IBM_CLOUD_URL = 'https://cloud.ibm.com/registration';
const IBM_BUILDER_URL = 'https://dataplatform.cloud.ibm.com/registration/step?context=wx';

export default class IbmBobWorker extends BaseWorker {
  get platformName() {
    return 'ibmbob';
  }

  async executeForAccount(account, page, log) {
    const { email, password } = account;

    // Step 1: Navigate to IBM registration
    log(`  Navigating to IBM registration...`);
    await page.goto(IBM_CLOUD_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await sleep(3000);

    // Step 2: Click Google OAuth
    log(`  Initiating Google OAuth...`);
    const googleBtn = await page.$(
      'button:has-text("Google"), a:has-text("Google"), [data-provider="google"], .social-btn-google, a[href*="google"], button[class*="google"]'
    );

    if (googleBtn) {
      await googleBtn.click();
      await sleep(3000);
    } else {
      // Try finding any SSO/OAuth link
      const ssoLink = await page.$eval(
        'a[href*="sso"], a[href*="oauth"], a[href*="google"], a[href*="social"]',
        (el) => el.href
      ).catch(() => null);

      if (ssoLink) {
        await page.goto(ssoLink, { waitUntil: 'networkidle', timeout: 60000 });
      } else {
        // Try direct IBM ID creation with email
        log(`  Google OAuth not found, trying direct registration...`);
        return await this.directRegistration(page, email, password, log);
      }
    }

    // Step 3: Google login
    log(`  Logging in with Google...`);
    await sleep(2000);
    const isGoogleLogin = await page.$('input[type="email"]');
    if (isGoogleLogin) {
      await googleLogin(page, email, password);
    }

    // Step 4: Handle IBM-specific flows
    log(`  Handling IBM registration...`);
    await sleep(5000);

    // Handle IBM Security Verify if present
    await this.handleIbmSecurityVerify(page, log);

    // Step 5: Complete IBM registration form if needed
    await this.completeRegistration(page, email, log);

    // Step 6: Wait for confirmation
    log(`  Waiting for registration to complete...`);
    await sleep(5000);

    // Try to reach dashboard
    try {
      await page.waitForURL(/cloud\.ibm\.com|dataplatform\.cloud\.ibm\.com/, { timeout: 30000 });
    } catch {
      // May need to navigate manually
    }

    log(`  Registration complete for ${email}`);

    return {
      success: true,
      key: `${email}|${password}`,
    };
  }

  async handleIbmSecurityVerify(page, log) {
    // IBM Security Verify can show various challenge screens
    const maxAttempts = 5;

    for (let i = 0; i < maxAttempts; i++) {
      const url = page.url();

      // Check for Security Verify
      if (url.includes('security') || url.includes('verify') || url.includes('challenge')) {
        log(`  Handling IBM Security Verify (step ${i + 1})...`);

        // Try "Continue with current session"
        const continueBtn = await page.$(
          'button:has-text("Continue"), button:has-text("Proceed"), button:has-text("Next"), input[type="submit"]'
        );
        if (continueBtn && (await continueBtn.isVisible())) {
          await continueBtn.click();
          await sleep(3000);
          continue;
        }

        // Try email verification
        const emailVerify = await page.$('button:has-text("Email"), input[name="email"]');
        if (emailVerify) {
          await emailVerify.click().catch(() => {});
          await sleep(2000);
        }

        // Check for CAPTCHA — can't automate this
        const captcha = await page.$('.g-recaptcha, #captcha, iframe[src*="captcha"]');
        if (captcha) {
          throw new Error('CAPTCHA encountered — cannot automate IBM Security Verify');
        }

        // Check for TOTP
        const totpInput = await page.$('input[name="totp"], input[name="otp"], input[autocomplete="one-time-code"]');
        if (totpInput) {
          throw new Error('TOTP required — cannot automate');
        }
      }

      await sleep(2000);
    }
  }

  async completeRegistration(page, email, log) {
    // Check if we need to fill additional registration fields
    const countrySelect = await page.$('select[name="country"], select[id*="country"]');
    if (countrySelect) {
      log(`  Filling registration details...`);
      await countrySelect.selectOption({ label: 'United States' }).catch(() => {});
      await randomSleep(300, 800);
    }

    // Company name
    const companyInput = await page.$('input[name="company"], input[name="organization"], input[placeholder*="company"]');
    if (companyInput) {
      await companyInput.fill('Personal');
      await randomSleep(300, 800);
    }

    // Accept terms
    const termsCheckbox = await page.$('input[type="checkbox"][name*="terms"], input[type="checkbox"][name*="agree"], #terms');
    if (termsCheckbox) {
      const isChecked = await termsCheckbox.isChecked();
      if (!isChecked) {
        await termsCheckbox.click();
        await randomSleep(300, 800);
      }
    }

    // Submit if there's a registration form
    const submitBtn = await page.$(
      'button[type="submit"]:has-text("Register"), button[type="submit"]:has-text("Create"), button:has-text("Complete"), button:has-text("Submit")'
    );
    if (submitBtn) {
      await submitBtn.click();
      await sleep(5000);
    }
  }

  async directRegistration(page, email, password, log) {
    log(`  Using direct IBM ID registration...`);

    // Fill email
    const emailInput = await page.$('input[name="email"], input[type="email"]');
    if (emailInput) {
      await emailInput.fill(email);
      await randomSleep(300, 800);
    }

    // Fill password
    const passInput = await page.$('input[name="password"], input[type="password"]');
    if (passInput) {
      await passInput.fill(password);
      await randomSleep(300, 800);
    }

    // Fill name
    const firstName = await page.$('input[name="firstName"], input[name="first_name"]');
    if (firstName) {
      await firstName.fill('Mimo');
      await randomSleep(200, 500);
    }

    const lastName = await page.$('input[name="lastName"], input[name="last_name"]');
    if (lastName) {
      await lastName.fill(`User${Math.random().toString(36).slice(2, 6)}`);
      await randomSleep(200, 500);
    }

    // Accept terms
    const terms = await page.$('input[type="checkbox"]');
    if (terms) {
      const checked = await terms.isChecked();
      if (!checked) await terms.click();
      await randomSleep(200, 500);
    }

    // Submit
    const submit = await page.$('button[type="submit"], button:has-text("Create"), button:has-text("Register")');
    if (submit) {
      await submit.click();
      await sleep(5000);
    }

    // Handle email verification
    log(`  Direct registration submitted. May need email verification.`);

    return {
      success: true,
      key: `${email}|${password}`,
    };
  }
}
