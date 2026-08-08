/**
 * IBM Bob Registration via Google OAuth
 * Uses Puppeteer + Stealth to bypass bot detection
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const ACCOUNT = {
  email: 'uchita9@bozztirex.us',
  password: 'Daffa112233'
};

const CHROME_PATH = '/home/work/.cache/puppeteer/chrome/linux-151.0.7922.71/chrome-linux64/chrome';

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

async function waitForSelectorWithRetry(page, selector, timeout = 30000) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('=== IBM Bob Google OAuth Signup ===\n');
  
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

    // Navigate to IBM Bob trial page
    console.log('[1] Navigating to IBM Bob trial...');
    await page.goto('https://bob.ibm.com/trial', { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    await delay(3000);
    
    // Take screenshot
    await page.screenshot({ path: 'bob-step1.png', fullPage: false });
    console.log('[1] Screenshot saved: bob-step1.png');
    
    // Check page content
    const pageTitle = await page.title();
    const pageUrl = page.url();
    console.log(`[1] Page title: ${pageTitle}`);
    console.log(`[1] Page URL: ${pageUrl}`);
    
    // Look for Google Sign Up button
    const googleBtn = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
      for (const btn of buttons) {
        const text = btn.textContent.toLowerCase();
        if (text.includes('google') || text.includes('sign up with google')) {
          return { found: true, text: btn.textContent.trim(), tag: btn.tagName };
        }
      }
      // Also check for any signup form
      const inputs = Array.from(document.querySelectorAll('input'));
      const emailInput = inputs.find(i => i.type === 'email' || i.placeholder?.toLowerCase().includes('email'));
      return { 
        found: false, 
        hasEmailInput: !!emailInput,
        inputs: inputs.map(i => ({ type: i.type, placeholder: i.placeholder, name: i.name })),
        buttons: buttons.slice(0, 10).map(b => b.textContent.trim().substring(0, 50))
      };
    });
    
    console.log('\n[2] Page analysis:', JSON.stringify(googleBtn, null, 2));
    
    if (googleBtn.found) {
      console.log('\n[3] Found Google button, clicking...');
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
        const btn = buttons.find(b => b.textContent.toLowerCase().includes('google'));
        if (btn) btn.click();
      });
      await delay(5000);
      await page.screenshot({ path: 'bob-step2-google.png', fullPage: false });
      console.log('[3] After Google click screenshot saved');
      
      // Handle Google OAuth
      const currentUrl = page.url();
      console.log(`[3] Current URL: ${currentUrl}`);
      
      if (currentUrl.includes('accounts.google.com')) {
        console.log('[4] On Google login page, entering email...');
        
        // Enter email
        const emailSelector = 'input[type="email"], #identifierId';
        await page.waitForSelector(emailSelector, { timeout: 15000 });
        await page.type(emailSelector, ACCOUNT.email, { delay: 50 });
        await delay(1000);
        
        // Click Next
        await page.evaluate(() => {
          const btn = document.querySelector('#identifierNext, button[jsname="LgbsSe"]');
          if (btn) btn.click();
        });
        await delay(3000);
        
        // Enter password
        console.log('[5] Entering password...');
        const pwSelector = 'input[type="password"], input[name="Passwd"]';
        await page.waitForSelector(pwSelector, { timeout: 15000 });
        await page.type(pwSelector, ACCOUNT.password, { delay: 50 });
        await delay(1000);
        
        // Click Next
        await page.evaluate(() => {
          const btn = document.querySelector('#passwordNext, button[jsname="LgbsSe"]');
          if (btn) btn.click();
        });
        await delay(5000);
        
        await page.screenshot({ path: 'bob-step3-after-login.png', fullPage: false });
        console.log('[5] After login screenshot saved');
        
        // Check if there's a consent/speedbump
        const afterLoginUrl = page.url();
        console.log(`[5] URL after login: ${afterLoginUrl}`);
        
        // Handle potential consent page
        const hasConsent = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const continueBtn = buttons.find(b => 
            b.textContent.toLowerCase().includes('continue') || 
            b.textContent.toLowerCase().includes('allow') ||
            b.textContent.toLowerCase().includes('agree')
          );
          if (continueBtn) {
            continueBtn.click();
            return true;
          }
          return false;
        });
        
        if (hasConsent) {
          console.log('[6] Clicked consent button');
          await delay(5000);
        }
        
        // Wait for redirect back to IBM
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
        await delay(3000);
        
        await page.screenshot({ path: 'bob-step4-final.png', fullPage: false });
        const finalUrl = page.url();
        console.log(`\n[7] Final URL: ${finalUrl}`);
        console.log('[7] Final screenshot saved: bob-step4-final.png');
        
        // Check if we're on IBM Bob
        if (finalUrl.includes('bob.ibm.com')) {
          console.log('\n✅ Successfully redirected to IBM Bob!');
          
          // Check for any additional form fields
          const formFields = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
            return inputs.map(i => ({
              type: i.type,
              name: i.name,
              placeholder: i.placeholder,
              value: i.value,
              visible: i.offsetParent !== null
            })).filter(i => i.visible);
          });
          console.log('Form fields:', JSON.stringify(formFields, null, 2));
        } else {
          console.log('\n⚠️ Not on IBM Bob page yet');
          const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
          console.log('Page content:', bodyText);
        }
      }
    } else {
      console.log('\n[3] No Google button found. Trying direct form signup...');
      
      if (googleBtn.hasEmailInput) {
        console.log('[3] Found email input, filling form...');
        
        // Fill email
        await page.type('input[type="email"], input[name*="email"]', ACCOUNT.email, { delay: 50 });
        await delay(1000);
        
        // Look for password field
        const hasPassword = await page.$('input[type="password"]');
        if (hasPassword) {
          await page.type('input[type="password"]', ACCOUNT.password, { delay: 50 });
        }
        
        await page.screenshot({ path: 'bob-form-filled.png', fullPage: false });
        console.log('[3] Form filled, screenshot saved');
      }
      
      // Log all visible text for debugging
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
      console.log('\nPage content:\n', bodyText);
    }
    
  } catch (err) {
    console.error('Error:', err.message);
    await page?.screenshot({ path: 'bob-error.png', fullPage: false }).catch(() => {});
  } finally {
    await browser.close();
    console.log('\n=== Done ===');
  }
}

main().catch(console.error);
