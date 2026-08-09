import BaseWorker from '../base/BaseWorker.js';
import { sleep, randomSleep } from '../../utils/index.js';
import fetch from 'node-fetch';

const CODEBUDDY_API = 'https://www.codebuddy.ai';
const GITHUB_DEVICE_URL = 'https://github.com/login/device/code';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export default class CodebuddyWorker extends BaseWorker {
  get platformName() {
    return 'codebuddy';
  }

  async executeForAccount(account, page, log) {
    const { email, password } = account;

    // Step 1: Initiate device code flow via CodeBuddy API
    log(`  Initiating device code flow...`);
    const deviceData = await this.initiateDeviceCode();
    if (!deviceData.device_code) {
      throw new Error('Failed to get device code from CodeBuddy');
    }

    const { device_code, user_code, verification_uri, interval = 5 } = deviceData;
    log(`  Device code: ${user_code}`);
    log(`  Verification URI: ${verification_uri}`);

    // Step 2: Navigate to GitHub and authorize
    log(`  Navigating to GitHub device login...`);
    await page.goto(verification_uri, { waitUntil: 'networkidle', timeout: 60000 });

    // Enter the user code
    await page.waitForSelector('#user_code, input[name="user_code"]', { timeout: 15000 });
    await page.fill('#user_code, input[name="user_code"]', user_code);
    await randomSleep(500, 1500);
    await page.click('button[type="submit"], input[type="submit"]');

    // GitHub login if needed
    await sleep(2000);
    const needsLogin = await page.$('input[type="email"], input[name="login"]');
    if (needsLogin) {
      log(`  Logging into GitHub...`);
      await this.githubLogin(page, email, password);
    }

    // Authorize the app
    await sleep(2000);
    log(`  Authorizing CodeBuddy app...`);
    await this.authorizeApp(page);

    // Step 3: Poll for the token
    log(`  Waiting for GitHub to issue token...`);
    const oauthToken = await this.pollForToken(device_code, interval);
    if (!oauthToken) {
      throw new Error('Failed to get OAuth token');
    }

    log(`  OAuth token acquired: ${oauthToken.substring(0, 10)}...`);

    // Step 4: Exchange token with CodeBuddy
    log(`  Exchanging token with CodeBuddy...`);
    const codebuddyToken = await this.exchangeToken(oauthToken);

    return {
      success: true,
      key: `${email}|${codebuddyToken || oauthToken}`,
    };
  }

  async initiateDeviceCode() {
    const res = await fetch(`${CODEBUDDY_API}/auth/github/device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Device code initiation failed: ${text}`);
    }
    return await res.json();
  }

  async githubLogin(page, email, password) {
    // Enter email/username
    await page.waitForSelector('input[name="login"], input[type="email"]', { timeout: 10000 });
    await page.fill('input[name="login"], input[type="email"]', email);
    await randomSleep(300, 800);

    // Enter password
    await page.fill('input[name="password"], input[type="password"]', password);
    await randomSleep(300, 800);

    // Click sign in
    await page.click('input[type="submit"][value="Sign in"], button[type="submit"]');
    await sleep(3000);

    // Handle 2FA if present
    const has2FA = await page.$('input[name="otp"], input[id="otp"], .js-otp-input');
    if (has2FA) {
      throw new Error('GitHub 2FA required — cannot automate');
    }

    // Handle any "Verify your account" prompts
    const verifyBtn = await page.$('button:has-text("Verify"), button:has-text("Continue")');
    if (verifyBtn && (await verifyBtn.isVisible())) {
      await verifyBtn.click();
      await sleep(2000);
    }
  }

  async authorizeApp(page) {
    // Look for authorize button
    const selectors = [
      'button:has-text("Authorize")',
      'input[value="Authorize"]',
      '#js-oauth-authorize-btn',
      'button[type="submit"]',
    ];

    for (const sel of selectors) {
      try {
        const btn = await page.$(sel);
        if (btn && (await btn.isVisible())) {
          await btn.click();
          await sleep(3000);
          return;
        }
      } catch {
        continue;
      }
    }

    // Maybe already authorized
    await sleep(2000);
  }

  async pollForToken(deviceCode, interval = 5, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(interval * 1000);

      try {
        const res = await fetch(`${CODEBUDDY_API}/auth/github/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_code: deviceCode }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.access_token) return data.access_token;
          if (data.token) return data.token;
        }
      } catch {
        // Continue polling
      }
    }
    return null;
  }

  async exchangeToken(githubToken) {
    try {
      const res = await fetch(`${CODEBUDDY_API}/auth/github/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: githubToken }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.token || data.access_token || data.api_key || githubToken;
      }
    } catch {
      // Fallback to raw GitHub token
    }
    return githubToken;
  }
}
