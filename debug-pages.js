#!/usr/bin/env node
/**
 * Debug script - dump page HTML for each platform to find correct selectors
 */
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const CHROME = '/home/work/.cache/puppeteer/chrome/linux-151.0.7922.71/chrome-linux64/chrome';

async function debugPage(url, name) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Debugging: ${name} → ${url}`);
  console.log('='.repeat(60));
  
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    
    const finalUrl = page.url();
    console.log(`Final URL: ${finalUrl}`);
    
    // Get all buttons and links with their text
    const elements = await page.evaluate(() => {
      const result = { buttons: [], links: [], inputs: [] };
      
      document.querySelectorAll('button, [role="button"]').forEach(el => {
        result.buttons.push({
          text: el.textContent.trim().substring(0, 100),
          id: el.id,
          class: el.className.toString().substring(0, 100),
          type: el.type,
          'data-provider': el.getAttribute('data-provider'),
          href: el.href || el.getAttribute('onclick') || '',
        });
      });
      
      document.querySelectorAll('a').forEach(el => {
        const text = el.textContent.trim();
        const href = el.href || '';
        if (text.length > 0 || href.includes('google') || href.includes('oauth') || href.includes('signup') || href.includes('login')) {
          result.links.push({
            text: text.substring(0, 100),
            href: href.substring(0, 200),
            id: el.id,
            class: el.className.toString().substring(0, 100),
          });
        }
      });
      
      document.querySelectorAll('input').forEach(el => {
        result.inputs.push({
          type: el.type,
          name: el.name,
          id: el.id,
          placeholder: el.placeholder,
          'aria-label': el.getAttribute('aria-label'),
        });
      });
      
      return result;
    });
    
    console.log('\nButtons:');
    for (const btn of elements.buttons) {
      console.log(`  [${btn.id || btn.class || 'no-id'}] "${btn.text}" data-provider=${btn['data-provider'] || 'none'}`);
    }
    
    console.log('\nLinks (with google/oauth/signup/login):');
    for (const link of elements.links) {
      console.log(`  "${link.text}" → ${link.href}`);
    }
    
    console.log('\nInputs:');
    for (const inp of elements.inputs) {
      console.log(`  type=${inp.type} name=${inp.name} id=${inp.id} placeholder=${inp.placeholder}`);
    }
    
    // Screenshot
    await page.screenshot({ path: `/home/work/.openclaw/workspace/debug-${name}.png`, fullPage: false });
    console.log(`\nScreenshot saved: debug-${name}.png`);
    
  } catch (err) {
    console.log(`Error: ${err.message}`);
  } finally {
    await browser.close();
  }
}

async function main() {
  await debugPage('https://qoder.com/login', 'qoder');
  await debugPage('https://www.codebuddy.ai', 'codebuddy');
  await debugPage('https://www.codebuddy.ai/signup', 'codebuddy-signup');
  await debugPage('https://cloud.ibm.com/registration', 'ibm');
  await debugPage('https://www.blackbox.ai', 'blackbox');
}

main().catch(console.error);
