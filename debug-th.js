const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const CHROME_PATH = '/tmp/chrome-dir/chrome';
const EMAIL = 'josef1@bekri.site';
const PASSWORD = 'Daffa112233!';
const INVITE = 'TH-653T-4B6A';

const delay = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // ===== STEP 1: Register on TokenHarbor =====
  console.log('\n[STEP 1] Register on TokenHarbor...');
  await page.goto(`https://tokenharbor.ai/login?invite=${INVITE}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(3000);
  await page.screenshot({ path: 'debug-1-login.png' });

  // Click "Sign up" tab
  console.log('  Clicking Sign up tab...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, [role="tab"], a, span'));
    const signup = btns.find(b => b.textContent.trim().toLowerCase() === 'sign up');
    if (signup) { signup.click(); return 'clicked'; }
    return 'not found';
  });
  await delay(2000);
  await page.screenshot({ path: 'debug-2-signup.png' });

  // Check what form elements exist
  const formElements = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    return inputs.map(i => ({
      type: i.type,
      name: i.name,
      placeholder: i.placeholder,
      value: i.value.substring(0, 30)
    }));
  });
  console.log('  Form inputs:', JSON.stringify(formElements));

  // Fill email
  console.log('  Filling email...');
  const emailInput = await page.$('input[type="email"], input[name="email"]');
  if (emailInput) {
    await emailInput.click({ clickCount: 3 });
    await emailInput.type(EMAIL, { delay: 30 });
  } else {
    console.log('  ⚠️ No email input found!');
  }

  // Fill password
  console.log('  Filling password...');
  const passInputs = await page.$$('input[type="password"]');
  console.log(`  Found ${passInputs.length} password inputs`);
  for (const pi of passInputs) {
    await pi.click({ clickCount: 3 });
    await pi.type(PASSWORD, { delay: 30 });
  }

  // Check invite code
  const inviteVal = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    for (const i of inputs) {
      if (i.placeholder?.toLowerCase().includes('invite') || i.name?.toLowerCase().includes('invite') || i.value?.includes('TH-')) {
        return { name: i.name, value: i.value, placeholder: i.placeholder };
      }
    }
    return null;
  });
  console.log('  Invite input:', JSON.stringify(inviteVal));

  // Check for CAPTCHA
  const hasCaptcha = await page.evaluate(() => {
    return {
      turnstile: !!document.querySelector('iframe[src*="turnstile"], iframe[title*="Cloudflare"]'),
      captcha: !!document.querySelector('iframe[src*="captcha"], .g-recaptcha, #captcha'),
      hCaptcha: !!document.querySelector('iframe[src*="hcaptcha"]'),
      verifyHuman: document.body.innerText.includes('Verify you are human') || document.body.innerText.includes('robot')
    };
  });
  console.log('  CAPTCHA check:', JSON.stringify(hasCaptcha));
  await page.screenshot({ path: 'debug-3-filled.png' });

  // Submit
  console.log('  Clicking Create account...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[type="submit"], button'));
    const createBtn = btns.find(b => b.textContent.trim().toLowerCase().includes('create account'));
    if (createBtn) { createBtn.click(); return 'clicked create account'; }
    // Fallback: any submit button
    const submitBtn = btns.find(b => b.type === 'submit');
    if (submitBtn) { submitBtn.click(); return 'clicked submit'; }
    return 'no button found';
  });
  await delay(8000);
  await page.screenshot({ path: 'debug-4-result.png' });

  const afterUrl = page.url();
  const afterText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('  After submit URL:', afterUrl);
  console.log('  After submit text:', afterText.substring(0, 200));

  // ===== STEP 2: Check Gmail for verification =====
  console.log('\n[STEP 2] Check Gmail...');
  
  // Use a fresh page for Gmail
  const gmailPage = await browser.newPage();
  await gmailPage.setViewport({ width: 1280, height: 900 });
  await gmailPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  
  await gmailPage.goto('https://mail.google.com', { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(3000);
  
  let gmailUrl = gmailPage.url();
  console.log('  Gmail URL:', gmailUrl.substring(0, 60));

  if (gmailUrl.includes('accounts.google.com')) {
    console.log('  Logging into Gmail...');
    await gmailPage.waitForSelector('#identifierId', { timeout: 10000 });
    await gmailPage.type('#identifierId', EMAIL, { delay: 30 });
    await gmailPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
      if (btn) btn.click();
    });
    await delay(5000);

    // Check for error
    const errText = await gmailPage.evaluate(() => document.body.innerText);
    if (errText.includes("Couldn't sign you in") || errText.includes("update to the latest")) {
      console.log('  ❌ Google blocked sign-in');
      await gmailPage.screenshot({ path: 'debug-5-google-blocked.png' });
    } else {
      // Password
      const passField = await gmailPage.$('input[type="password"]');
      if (passField) {
        await passField.click();
        await passField.type('Daffa112233', { delay: 30 }); // Gmail pw without !
        await gmailPage.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next'));
          if (btn) btn.click();
        });
        await delay(5000);
      }

      // Consent
      await gmailPage.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent.trim() === 'Lanjutkan' || b.textContent.trim() === 'Continue'
        );
        if (btn) btn.click();
      });
      await delay(5000);

      gmailUrl = gmailPage.url();
      console.log('  After login URL:', gmailUrl.substring(0, 60));
      await gmailPage.screenshot({ path: 'debug-5-gmail.png' });

      if (gmailUrl.includes('mail.google.com')) {
        console.log('  ✅ In Gmail!');
        await delay(5000);
        
        // Get inbox text
        const inboxText = await gmailPage.evaluate(() => document.body.innerText.substring(0, 1000));
        console.log('  Inbox text (first 300):', inboxText.substring(0, 300));
      }
    }
  }

  // ===== STEP 3: Try to access TokenHarbor dashboard =====
  console.log('\n[STEP 3] TokenHarbor dashboard...');
  
  const dashPage = await browser.newPage();
  await dashPage.setViewport({ width: 1280, height: 900 });
  
  // Try direct login with email/password
  await dashPage.goto('https://tokenharbor.ai/login', { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(3000);
  
  // Fill login form
  const loginEmail = await dashPage.$('input[type="email"]');
  if (loginEmail) {
    await loginEmail.click();
    await loginEmail.type(EMAIL, { delay: 30 });
  }
  const loginPass = await dashPage.$('input[type="password"]');
  if (loginPass) {
    await loginPass.click();
    await loginPass.type(PASSWORD, { delay: 30 });
  }
  
  // Click Sign in
  await dashPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const signIn = btns.find(b => b.textContent.trim().toLowerCase().includes('sign in') || b.textContent.trim().toLowerCase().includes('log in'));
    if (signIn) signIn.click();
  });
  await delay(5000);
  await dashPage.screenshot({ path: 'debug-6-dashboard.png' });
  
  const dashUrl = dashPage.url();
  const dashText = await dashPage.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('  Dashboard URL:', dashUrl);
  console.log('  Dashboard text:', dashText.substring(0, 200));

  await browser.close();
  console.log('\n[DONE]');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
