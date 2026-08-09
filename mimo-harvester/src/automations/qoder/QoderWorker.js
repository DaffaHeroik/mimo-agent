import BaseWorker from '../base/BaseWorker.js';
import { sleep, randomSleep } from '../../utils/index.js';
import { googleLogin } from '../../providers/google/login.js';
import fetch from 'node-fetch';

const QODER_BASE = 'https://qoder.com';
const QODER_API = 'https://center.qoder.sh';

export default class QoderWorker extends BaseWorker {
  get platformName() {
    return 'qoder';
  }

  async executeForAccount(account, page, log) {
    const { email, password } = account;

    // Step 1: Navigate to Qoder login
    log(`  Navigating to Qoder...`);
    await page.goto(`${QODER_BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });

    // Step 2: Click Google OAuth login
    log(`  Initiating Google OAuth...`);
    const googleBtn = await page.$(
      'button:has-text("Google"), a:has-text("Google"), [data-provider="google"], .google-btn, #google-login'
    );

    if (googleBtn) {
      await googleBtn.click();
      await sleep(3000);
    } else {
      // Try navigating directly to Google OAuth URL
      const oauthLink = await page.$eval('a[href*="google"], a[href*="oauth"]', (el) => el.href).catch(() => null);
      if (oauthLink) {
        await page.goto(oauthLink, { waitUntil: 'networkidle', timeout: 60000 });
      } else {
        throw new Error('Cannot find Google login button on Qoder');
      }
    }

    // Step 3: Google login
    log(`  Logging in with Google...`);
    await sleep(2000);

    // Check if we're on Google login page
    const isGoogleLogin = await page.$('input[type="email"]');
    if (isGoogleLogin) {
      await googleLogin(page, email, password);
    }

    // Step 4: Handle consent / redirect back to Qoder
    log(`  Waiting for redirect to Qoder...`);
    await sleep(3000);

    // Handle any consent screens
    try {
      const consentBtn = await page.$(
        'button:has-text("Allow"), button:has-text("Continue"), #submit_approve_access'
      );
      if (consentBtn && (await consentBtn.isVisible())) {
        await consentBtn.click();
        await sleep(3000);
      }
    } catch {
      // No consent needed
    }

    // Wait for Qoder dashboard
    try {
      await page.waitForURL(/qoder\.ai/, { timeout: 30000 });
    } catch {
      // Might already be on Qoder
    }

    await sleep(3000);

    // Step 5: Extract auth token from cookies/localStorage
    log(`  Extracting auth token...`);
    let authToken = '';

    try {
      authToken = await page.evaluate(() => {
        // Try localStorage
        const keys = ['token', 'auth_token', 'access_token', 'jwt', 'session'];
        for (const key of keys) {
          const val = localStorage.getItem(key);
          if (val && val.length > 10) return val;
        }
        // Try sessionStorage
        for (const key of keys) {
          const val = sessionStorage.getItem(key);
          if (val && val.length > 10) return val;
        }
        return '';
      });
    } catch {
      // ignore
    }

    // Try cookies
    if (!authToken) {
      const cookies = await context.cookies();
      const authCookie = cookies.find(
        (c) => c.name.includes('token') || c.name.includes('auth') || c.name.includes('session')
      );
      if (authCookie) authToken = authCookie.value;
    }

    // Try intercepting API calls
    if (!authToken) {
      authToken = await this.extractTokenFromNetwork(page);
    }

    if (!authToken) {
      throw new Error('Could not extract auth token from Qoder');
    }

    log(`  Token acquired: ${authToken.substring(0, 15)}...`);

    // Step 6: Claim 800 free API calls
    log(`  Claiming 800 free calls...`);
    const claimResult = await this.claimFreeCalls(authToken);

    return {
      success: true,
      key: `${email}|${authToken}|${claimResult}`,
    };
  }

  async extractTokenFromNetwork(page) {
    return new Promise((resolve) => {
      let token = '';
      const handler = (response) => {
        try {
          const authHeader = response.request().headers()['authorization'];
          if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.replace('Bearer ', '');
          }
        } catch {
          // ignore
        }
      };

      page.on('response', handler);

      // Give it a few seconds to capture a request
      setTimeout(() => {
        page.removeListener('response', handler);
        resolve(token);
      }, 5000);
    });
  }

  async claimFreeCalls(token) {
    try {
      const res = await fetch(`${QODER_API}/v1/credits/claim`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan: 'free', amount: 800 }),
      });

      if (res.ok) {
        const data = await res.json();
        return `claimed-${data.credits || 800}`;
      }

      // Try alternative endpoint
      const res2 = await fetch(`${QODER_API}/v1/user/claim-free`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res2.ok) {
        return 'claimed-800';
      }

      return 'claim-failed';
    } catch {
      return 'claim-error';
    }
  }
}
