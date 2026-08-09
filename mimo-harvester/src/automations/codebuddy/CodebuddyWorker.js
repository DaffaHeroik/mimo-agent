import BaseWorker from '../base/BaseWorker.js';
import { sleep, randomSleep } from '../../utils/index.js';
import { googleLogin } from '../../providers/google/login.js';

const CODEBUDDY_API = 'https://www.codebuddy.ai';

export default class CodebuddyWorker extends BaseWorker {
  get platformName() { return 'codebuddy'; }

  async executeForAccount(account, page, log) {
    const { email, password } = account;

    // Step 1: Navigate to CodeBuddy LOGIN page (has Keycloak iframe)
    log(`  Navigating to CodeBuddy login...`);
    await page.goto(`${CODEBUDDY_API}/login`, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(3000);

    // Step 2: Find the Keycloak iframe and click "Sign up with Google" inside it
    log(`  Looking for Google signup in Keycloak iframe...`);
    
    const kcFrame = page.frames().find(f => 
      f.url().includes('keycloak') || f.url().includes('openid-connect')
    );

    if (!kcFrame) {
      throw new Error('Keycloak iframe not found on CodeBuddy login page');
    }

    log(`  Found Keycloak iframe: ${kcFrame.url().substring(0, 80)}...`);

    // Find and click "Sign up with Google" link inside the iframe
    const googleLinkHref = await kcFrame.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const google = links.find(l => {
        const text = (l.textContent || '').toLowerCase();
        return text.includes('sign up with google') || text.includes('log in with google');
      });
      return google ? google.href : '';
    });

    if (googleLinkHref) {
      log(`  Found Google link, navigating...`);
      await page.goto(googleLinkHref, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(3000);
    } else {
      throw new Error('Google link not found in CodeBuddy Keycloak iframe');
    }

    // Step 3: Google OAuth login
    log(`  Completing Google OAuth...`);
    const isGoogleLogin = await page.$('input[type="email"]');
    if (isGoogleLogin) {
      await googleLogin(page, email, password);
    }

    await sleep(5000);

    // Step 4: Handle consent
    try {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => {
          const t = (b.textContent || '').toLowerCase();
          return t.includes('allow') || t.includes('authorize') || t.includes('accept') || t.includes('continue');
        });
        if (btn) btn.click();
      });
      await sleep(3000);
    } catch {}

    // Step 5: Check result
    await sleep(3000);
    const finalUrl = page.url();
    log(`  Final URL: ${finalUrl}`);

    if (finalUrl.includes('restricted') || finalUrl.includes('unavailable')) {
      const text = await page.evaluate(() => document.body.innerText).catch(() => '');
      if (text.includes('Access Restricted') || text.includes('unavailable')) {
        throw new Error('CodeBuddy: Account Access Restricted (Tencent security)');
      }
    }

    // Must be on actual CodeBuddy domain, not still on Google
    const onCodeBuddy = finalUrl.includes('codebuddy.ai') && !finalUrl.includes('accounts.google.com');
    if (onCodeBuddy && (finalUrl.includes('dashboard') || finalUrl.includes('app') || finalUrl.includes('workspace') || finalUrl.includes('/login/select') || finalUrl.includes('/register'))) {
      log(`  ✅ CodeBuddy login successful!`);
      const token = await this.extractToken(page);
      return { success: true, key: `${email}|${token || 'no-token'}` };
    }

    const errorMsg = await page.evaluate(() => {
      const el = document.querySelector('.error, .alert, [class*="error"], [class*="alert"]');
      return el ? el.textContent.trim() : '';
    }).catch(() => '');

    throw new Error(errorMsg || `CodeBuddy: Unexpected state. URL: ${finalUrl}`);
  }

  async extractToken(page) {
    try {
      const token = await page.evaluate(() => {
        for (const k of ['token','access_token','auth_token','jwt']) {
          const v = localStorage.getItem(k);
          if (v && v.length > 10) return v;
        }
        return '';
      });
      if (token) return token;
      const cookies = await page.cookies();
      const c = cookies.find(c => c.name.includes('token') || c.name.includes('auth'));
      if (c) return c.value;
    } catch {}
    return '';
  }
}
