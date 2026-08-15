const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
const CHROME = '/home/work/.openclaw/workspace/.openclaw/tmp/chrome-dir/chrome';

const accounts = ['muni4@bekri.site','muni5@bekri.site','muni6@bekri.site','muni7@bekri.site','muni8@bekri.site','muni9@bekri.site','muni10@bekri.site'];
const results = [
  {email:'muni1@bekri.site',key:'thk_live_XXf1Dss3VEj3QjuB-9SSZ_Bc-waBhvSsKxbhdRPfVzXjvfVZPMlbEiaEsSTxWHxV'},
  {email:'muni2@bekri.site',key:'thk_live_8DFUzvnnQEN_N9E0Ott94LSiTZHOZaUDrrlU_WQp164SPPWIxjIhrosWiP6uXmBK'},
  {email:'muni3@bekri.site',key:'thk_live_3MKv4vTaCwk4IZnvylPeSF6YIgVp_9PAkw5uppuHG4W_LcOA8cWIc_ci9zqmGQCV'}
];

// Load proxies
const proxyLines = fs.readFileSync('/home/work/.openclaw/workspace/.openclaw/tmp/mimo-agent/proxies/all.txt', 'utf8').trim().split('\n');
const proxies = proxyLines.map(line => {
  const [ip, port, user, pass] = line.split(':');
  return { server: `http://${ip}:${port}`, user, pass };
});
console.log(`Loaded ${proxies.length} proxies`);

let proxyIdx = 0;
function nextProxy() {
  const p = proxies[proxyIdx % proxies.length];
  proxyIdx++;
  return p;
}

async function run(email) {
  console.log('\n' + '='.repeat(50));
  console.log(email);

  const proxy = nextProxy();
  console.log(`  Proxy: ${proxy.server}`);

  // Step 1: Register with proxy
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
      `--proxy-server=${proxy.server}`
    ]
  });

  try {
    const page = await browser.newPage();
    // Authenticate proxy
    await page.authenticate({ username: proxy.user, password: proxy.pass });

    console.log('[1] Registering...');
    await page.goto('https://tokenharbor.ai/login?invite=TH-653T-4B6A', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(2000);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Essential only')); if(b) b.click(); });
    await sleep(500);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Sign up'); if(b) b.click(); });
    await sleep(1000);
    let ei = await page.$('input[type="email"]'); if(ei){ await ei.click(); await ei.type(email, {delay:30}); }
    let pi = await page.$('input[type="password"]'); if(pi){ await pi.click(); await pi.type('Daffa112233!', {delay:30}); }
    await sleep(300);
    await page.keyboard.press('Enter');
    await sleep(8000);

    const url = page.url();
    const text = await page.evaluate(() => document.body.innerText.substring(0, 500));

    if (text.includes('Too many sign-ups') || text.includes('rate limit') || text.includes('free tier limit')) {
      console.log('  ❌ Rate limited on this proxy too');
      await browser.close();
      return {email, status:'rate_limited', key:null};
    }
    if (text.includes('already on board')) {
      console.log('  ✅ Already registered');
    } else if (url.includes('dashboard')) {
      console.log('  ✅ Newly registered');
    } else {
      console.log('  Reg URL:', url.substring(0, 60));
      // Check for error in page
      const errorMatch = text.match(/(?:error|couldn't|failed|too many|limit).{0,100}/i);
      if (errorMatch) console.log('  Error:', errorMatch[0]);
    }
    await browser.close();
  } catch(e) {
    console.log('  Registration error:', e.message.substring(0, 100));
    try{await browser.close();}catch{}
    return {email, status:'reg_error', key:null};
  }

  // Step 2: Gmail (no proxy needed, use direct)
  console.log('[2] Gmail...');
  const gBrowser = await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']});
  try {
    const gPage = await gBrowser.newPage();
    await gPage.goto('https://accounts.google.com/signin/v2/identifier?continue=https://mail.google.com/mail/', {waitUntil:'networkidle2',timeout:30000});
    await sleep(2000);
    let ge = await gPage.waitForSelector('input[type="email"],#identifierId',{timeout:10000});
    await ge.click({clickCount:3}); await ge.type(email,{delay:50});
    await sleep(1000);
    await gPage.evaluate(()=>{const b=document.querySelector('#identifierNext button')||document.querySelector('button[jsname="LgbsSe"]');if(b)b.click();});
    await sleep(5000);
    let gpd = await gPage.waitForSelector('input[type="password"]',{timeout:10000});
    await gpd.click({clickCount:3}); await gpd.type('Daffa112233',{delay:50});
    await sleep(1000);
    await gPage.evaluate(()=>{const b=document.querySelector('#passwordNext button')||document.querySelector('button[jsname="LgbsSe"]');if(b)b.click();});
    await sleep(8000);
    for(let i=0;i<3;i++){const c=await gPage.evaluate(()=>{const b=Array.from(document.querySelectorAll('button')).find(x=>{const t=x.textContent.toLowerCase();return t.includes('continue')||t.includes('accept')||t.includes('lanjutkan')});if(b){b.click();return true;}return false;});if(c)await sleep(2000);else break;}

    await gPage.goto('https://mail.google.com/mail/u/0/',{waitUntil:'networkidle2',timeout:30000});
    await sleep(5000);

    let clicked = await gPage.evaluate(() => {
      const rows = document.querySelectorAll('tr');
      for (const r of rows) { if (r.textContent.includes('Token Harbor') && r.textContent.includes('Verify')) { r.click(); return true; } }
      for (const r of rows) { if (r.textContent.includes('Token Harbor')) { r.click(); return true; } }
      return false;
    });
    if (!clicked) { await sleep(10000); await gPage.goto('https://mail.google.com/mail/u/0/',{waitUntil:'networkidle2',timeout:30000}); await sleep(5000); clicked = await gPage.evaluate(() => { const rows = document.querySelectorAll('tr'); for (const r of rows) { if (r.textContent.includes('Token Harbor')) { r.click(); return true; } } return false; }); }
    if (!clicked) { console.log('  ❌ Email not found'); await gBrowser.close(); return {email, status:'email_not_found', key:null}; }
    await sleep(3000);

    const vl = await gPage.evaluate(() => {
      for (const a of document.querySelectorAll('a')) { if ((a.href||'').includes('verify-email')) return a.href; }
      const m = document.body.innerText.match(/https:\/\/tokenharbor\.ai\/verify-email\?token=[a-zA-Z0-9_\-=]+/g)
      return m ? m[0] : '';
    });
    if (!vl) { console.log('  ❌ No verify link'); await gBrowser.close(); return {email, status:'no_verify_link', key:null}; }
    console.log('  ✅ Verify link found');

    // Verify
    console.log('[3] Verifying...');
    await gPage.goto(vl, {waitUntil:'networkidle2',timeout:30000});
    await sleep(5000);

    // Login & create key (with proxy)
    console.log('[4] Login & create key...');
    await gBrowser.close();

    const kBrowser = await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu',`--proxy-server=${proxy.server}`]});
    const kPage = await kBrowser.newPage();
    await kPage.authenticate({ username: proxy.user, password: proxy.pass });

    await kPage.goto('https://tokenharbor.ai/login', {waitUntil:'networkidle2',timeout:30000});
    await sleep(2000);
    await kPage.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Sign in'); if(b) b.click(); });
    await sleep(1000);
    ei = await kPage.$('input[type="email"]'); if(ei){ await ei.click(); await ei.type(email, {delay:30}); }
    pi = await kPage.$('input[type="password"]'); if(pi){ await pi.click(); await pi.type('Daffa112233!', {delay:30}); }
    await sleep(300);
    await kPage.keyboard.press('Enter');
    await sleep(8000);

    if (!kPage.url().includes('dashboard')) { console.log('  ❌ Login failed'); await kBrowser.close(); return {email, status:'login_failed', key:null}; }
    console.log('  ✅ Logged in');

    await kPage.goto('https://tokenharbor.ai/dashboard/api-keys', {waitUntil:'networkidle2',timeout:15000});
    await sleep(2000);
    await kPage.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('new key')); if(b) b.click(); });
    await sleep(2000);
    let li = await kPage.$('input[type="text"]'); if(li){ await li.click({clickCount:3}); await li.type(email.split('@')[0]+'-key', {delay:20}); await sleep(500); }
    await kPage.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('create key')); if(b) b.click(); });
    await sleep(3000);
    await kPage.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('show')); if(b) b.click(); });
    await sleep(2000);

    const key = await kPage.evaluate(() => {
      const m = document.body.innerText.match(/thk_live_[a-zA-Z0-9_\-]{20,}/);
      if (m) return m[0];
      for (const i of document.querySelectorAll('input')) { if (i.value.length > 20 && i.value.includes('_')) return i.value; }
      return '';
    });

    await kBrowser.close();
    if (key) { console.log('\n✅ KEY:', key); return {email, status:'success', key}; }
    console.log('  ⚠️ No key');
    return {email, status:'key_failed', key:null};

  } catch(e) {
    console.log('  Gmail error:', e.message.substring(0, 100));
    try{await gBrowser.close();}catch{}
    return {email, status:'error', key:null};
  }
}

(async () => {
  console.log('TokenHarbor with Proxy Rotation\n');
  for (const acc of accounts) {
    const r = await run(acc);
    results.push(r);
    fs.writeFileSync('tokenharbor-bekri-results.txt', results.map(x=>x.email+'|'+(x.key||x.status)).join('\n'));
    if (r.status === 'rate_limited') { console.log('\nAll proxies rate limited? Stopping.'); break; }
    await sleep(3000);
  }
  console.log('\n=== FINAL RESULTS ===');
  for (const r of results) console.log(r.email+': '+(r.key?'✅ '+r.key:'❌ '+r.status));
  fs.writeFileSync('tokenharbor-bekri-results.txt', results.map(x=>x.email+'|'+(x.key||x.status)).join('\n'));
})();
