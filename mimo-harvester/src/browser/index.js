import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import config from '../config/index.js';
import { randomUA } from '../utils/index.js';

puppeteer.use(StealthPlugin());

/**
 * Launch Puppeteer with stealth plugin (same setup that worked before).
 */
export async function launchBrowser(proxyStr = '', opts = {}) {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--window-size=1920,1080',
  ];

  if (proxyStr) {
    // Extract proxy URL for Puppeteer
    const proxyUrl = formatProxyForPuppeteer(proxyStr);
    if (proxyUrl) {
      args.push(`--proxy-server=${proxyUrl}`);
    }
  }

  const launchOpts = {
    headless: config.PW_HEADLESS ? 'new' : false,
    args,
    slowMo: config.BROWSER_SLOW_MO || 0,
    ignoreDefaultArgs: ['--enable-automation'],
  };

  // Use custom Chrome path
  if (config.CHROME_EXECUTABLE_PATH) {
    launchOpts.executablePath = config.CHROME_EXECUTABLE_PATH;
  }

  const browser = await puppeteer.launch(launchOpts);
  return browser;
}

/**
 * Create a new page with anti-detection patches.
 */
export async function createContext(browser, opts = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Anti-detection patches
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    window.chrome = { runtime: {} };
  });

  return page;
}

/**
 * Format proxy string for Puppeteer (--proxy-server arg)
 */
function formatProxyForPuppeteer(proxyStr) {
  if (!proxyStr) return null;
  
  // Already a URL
  if (proxyStr.startsWith('http://') || proxyStr.startsWith('socks5://')) {
    return proxyStr;
  }
  
  // Parse ip:port:user:pass format
  const parts = proxyStr.split(':');
  if (parts.length >= 2) {
    const [ip, port, user, pass] = parts;
    if (user && pass) {
      return `http://${user}:${pass}@${ip}:${port}`;
    }
    return `http://${ip}:${port}`;
  }
  
  return proxyStr;
}

/**
 * Convenience: launch browser + page together.
 */
export async function launchWithSession(proxyStr = '', opts = {}) {
  const browser = await launchBrowser(proxyStr, opts);
  const page = await createContext(browser, opts);
  return { browser, page };
}
