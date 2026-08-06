#!/usr/bin/env node
// Auto-claim Qoder 800 free calls via Desktop app + DevTools
const puppeteer = require('./node_modules/puppeteer-core');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const HOME = process.env.HOME;
const QODER_BIN = '/tmp/qoder-desktop/usr/share/qoder/qoder';
const LD_PATH = '/tmp/gtk3/usr/lib/x86_64-linux-gnu:/tmp/deps/usr/lib/x86_64-linux-gnu:/tmp/qoder-desktop/usr/share/qoder';

async function main() {
  console.log('=== Qoder 800 Free Calls Auto-Claim ===\n');

  // 1. Start Xvfb if not running
  if (!execSync('pgrep Xvfb || echo ""', { encoding: 'utf-8' }).trim()) {
    console.log('Starting Xvfb...');
    spawn('Xvfb', [':99', '-screen', '0', '1920x1080x24'], { detached: true, stdio: 'ignore' }).unref();
    await sleep(2000);
  }

  // 2. Start Qoder Desktop
  console.log('Starting Qoder Desktop...');
  const env = { ...process.env, DISPLAY: ':99', LD_LIBRARY_PATH: LD_PATH };
  const qoder = spawn(QODER_BIN, ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'], {
    env, stdio: ['ignore', 'pipe', 'pipe']
  });

  let devToolsPort = null;

  // Capture stderr for DevTools URL
  qoder.stderr.on('data', (data) => {
    const text = data.toString();
    const match = text.match(/127\.0\.0\.1:(\d+)\/devtools/);
    if (match) devToolsPort = parseInt(match[1]);
  });

  // Wait for DevTools to be ready
  console.log('Waiting for DevTools...');
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    if (devToolsPort) {
      try {
        execSync(`curl -s http://127.0.0.1:${devToolsPort}/json`, { timeout: 3000 });
        console.log(`DevTools ready on port ${devToolsPort}\n`);
        break;
      } catch {}
    }
  }

  if (!devToolsPort) {
    console.error('Failed to get DevTools port');
    qoder.kill();
    process.exit(1);
  }

  // 3. Connect via Puppeteer
  let browser;
  try {
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${devToolsPort}` });
  } catch (e) {
    console.error('Failed to connect:', e.message);
    qoder.kill();
    process.exit(1);
  }

  const pages = await browser.pages();
  console.log(`Connected! ${pages.length} page(s) open`);

  const page = pages[0];
  await sleep(5000);

  // 4. Check current state
  const content = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
  console.log('Current view:', content.substring(0, 150));

  // 5. Screenshot for debugging
  await page.screenshot({ path: 'claim-step1.png' });

  // 6. Look for sign-in button
  const hasSignIn = content.toLowerCase().includes('sign in') || content.toLowerCase().includes('login');
  if (hasSignIn) {
    console.log('\nNeed to sign in. Clicking sign-in...');
    await page.evaluate(() => {
      const els = document.querySelectorAll('[role="tab"], [role="menuitem"], a, button, span, div');
      for (const el of els) {
        const t = (el.textContent || '').trim().toLowerCase();
        if (t.includes('sign in') || t.includes('login')) { el.click(); return; }
      }
    });
    await sleep(3000);
    await page.screenshot({ path: 'claim-step2-signin.png' });
    console.log('Sign-in clicked. Check screenshot.');
  }

  // 7. Look for Usage tab
  console.log('\nLooking for Usage tab...');
  const usageClicked = await page.evaluate(() => {
    const els = document.querySelectorAll('[role="tab"], [role="menuitem"], a, button, span');
    for (const el of els) {
      const t = (el.textContent || '').trim();
      if (t === 'Usage' || t === 'usage') { el.click(); return true; }
    }
    return false;
  });
  console.log('Usage clicked:', usageClicked);
  await sleep(3000);
  await page.screenshot({ path: 'claim-step3-usage.png' });

  // 8. Look for claim button
  console.log('\nLooking for claim button...');
  const claimInfo = await page.evaluate(() => {
    const els = document.querySelectorAll('button, a, [role="button"], div[class*="claim"], span[class*="claim"]');
    for (const el of els) {
      const t = (el.textContent || '').toLowerCase().trim();
      if (t.includes('claim') || t.includes('activate') || t.includes('redeem') || t.includes('get')) {
        return { text: t.substring(0, 50), tag: el.tagName, class: el.className?.substring(0, 50) };
      }
    }
    return null;
  });

  if (claimInfo) {
    console.log('Found claim button:', JSON.stringify(claimInfo));
    // Click it
    await page.evaluate(() => {
      const els = document.querySelectorAll('button, a, [role="button"]');
      for (const el of els) {
        const t = (el.textContent || '').toLowerCase().trim();
        if (t.includes('claim') || t.includes('activate') || t.includes('redeem')) { el.click(); return; }
      }
    });
    await sleep(5000);
    await page.screenshot({ path: 'claim-step4-claimed.png' });
    console.log('Claim button clicked! Check screenshot.');
  } else {
    console.log('No claim button found. Taking screenshot for inspection...');
    await page.screenshot({ path: 'claim-no-button.png' });
  }

  // 9. Get final page content
  const finalContent = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || '');
  console.log('\nFinal view:', finalContent.substring(0, 300));

  browser.disconnect();
  qoder.kill();
  console.log('\n=== DONE ===');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
