const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
const CHROME = '/home/work/.openclaw/workspace/.openclaw/tmp/chrome-dir/chrome';

// Get one proxy per unique IP
const allLines = fs.readFileSync('/home/work/.openclaw/workspace/.openclaw/tmp/mimo-agent/proxies/all.txt','utf8').trim().split('\n');
const seen = new Set();
const proxies = [];
for (const line of allLines) {
  const [ip,port,user,pass] = line.split(':');
  const key = ip+':'+port;
  if (!seen.has(key)) { seen.add(key); proxies.push({server:`http://${ip}:${port}`, user, pass}); }
}
console.log(`Unique proxies: ${proxies.length}`);

(async () => {
  for (const proxy of proxies) {
    console.log(`\nProxy: ${proxy.server}`);
    const browser = await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu',`--proxy-server=${proxy.server}`]});
    try {
      const page = await browser.newPage();
      await page.authenticate({username:proxy.user, password:proxy.pass});
      await page.goto('https://tokenharbor.ai/login?invite=TH-653T-4B6A', {waitUntil:'networkidle2',timeout:30000});
      await sleep(2000);
      await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Essential only')); if(b) b.click(); });
      await sleep(500);
      await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Sign up'); if(b) b.click(); });
      await sleep(1000);
      const ei = await page.$('input[type="email"]'); if(ei){ await ei.click(); await ei.type('muni4@bekri.site', {delay:30}); }
      const pi = await page.$('input[type="password"]'); if(pi){ await pi.click(); await pi.type('Daffa112233!', {delay:30}); }
      await sleep(300);
      await page.keyboard.press('Enter');
      await sleep(8000);
      const text = await page.evaluate(() => document.body.innerText.substring(0, 500));
      const url = page.url();
      if (text.includes('Too many sign-ups')) console.log('  RESULT: rate_limited');
      else if (text.includes("couldn't create")) console.log('  RESULT: creation_error');
      else if (text.includes('already on board')) console.log('  RESULT: already_exists');
      else if (url.includes('dashboard')) console.log('  RESULT: SUCCESS!');
      else console.log('  RESULT: unknown |', text.substring(0, 100));
    } catch(e) {
      console.log('  RESULT: error |', e.message.substring(0, 80));
    }
    await browser.close();
  }
})();
