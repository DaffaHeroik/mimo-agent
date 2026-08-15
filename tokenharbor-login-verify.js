const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
const CHROME = '/home/work/.openclaw/workspace/.openclaw/tmp/chrome-dir/chrome';

const accounts = ['muni3@bekri.site','muni4@bekri.site','muni5@bekri.site','muni6@bekri.site','muni7@bekri.site','muni8@bekri.site','muni9@bekri.site','muni10@bekri.site'];
const results = [
  {email:'muni1@bekri.site',key:'thk_live_XXf1Dss3VEj3QjuB-9SSZ_Bc-waBhvSsKxbhdRPfVzXjvfVZPMlbEiaEsSTxWHxV'},
  {email:'muni2@bekri.site',key:'thk_live_8DFUzvnnQEN_N9E0Ott94LSiTZHOZaUDrrlU_WQp164SPPWIxjIhrosWiP6uXmBK'}
];

async function run(email) {
  console.log('\n' + '='.repeat(50));
  console.log(email);
  console.log('='.repeat(50));

  const browser = await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']});

  try {
    // Step 1: Register on TokenHarbor (might already exist)
    console.log('[1/5] Register/Login...');
    const regCtx = await browser.createBrowserContext();
    const rp = await regCtx.newPage();
    await rp.goto('https://tokenharbor.ai/login?invite=TH-653T-4B6A', {waitUntil:'networkidle2',timeout:60000});
    await sleep(2000);
    await rp.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Essential only')); if(b) b.click(); });
    await sleep(500);
    await rp.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Sign up'); if(b) b.click(); });
    await sleep(1000);
    let ei = await rp.$('input[type="email"]'); if(ei){ await ei.click(); await ei.type(email, {delay:30}); }
    let pi = await rp.$('input[type="password"]'); if(pi){ await pi.click(); await pi.type('Daffa112233!', {delay:30}); }
    await sleep(300);
    await rp.keyboard.press('Enter');
    await sleep(8000);

    let regUrl = rp.url();
    let regText = await rp.evaluate(() => document.body.innerText.substring(0, 300));

    if (regText.includes('already on board')) {
      console.log('  Already registered');
    } else if (regUrl.includes('dashboard')) {
      console.log('  ✅ Newly registered');
    } else if (regText.includes('free tier limit') || regText.includes('rate limit')) {
      console.log('  ❌ RATE LIMITED');
      await regCtx.close(); await browser.close();
      return {email, status:'rate_limited', key:null};
    } else {
      console.log('  Reg URL:', regUrl.substring(0,60));
    }
    await regCtx.close();

    // Step 2: Gmail - get verification email
    console.log('[2/5] Gmail...');
    const gCtx = await browser.createBrowserContext();
    const gp = await gCtx.newPage();
    await gp.goto('https://accounts.google.com/signin/v2/identifier?continue=https://mail.google.com/mail/', {waitUntil:'networkidle2',timeout:30000});
    await sleep(2000);
    let ge = await gp.waitForSelector('input[type="email"],#identifierId',{timeout:10000});
    await ge.click({clickCount:3}); await ge.type(email,{delay:50});
    await sleep(1000);
    await gp.evaluate(()=>{const b=document.querySelector('#identifierNext button')||document.querySelector('button[jsname="LgbsSe"]');if(b)b.click();});
    await sleep(5000);
    let gpd = await gp.waitForSelector('input[type="password"]',{timeout:10000});
    await gpd.click({clickCount:3}); await gpd.type('Daffa112233',{delay:50});
    await sleep(1000);
    await gp.evaluate(()=>{const b=document.querySelector('#passwordNext button')||document.querySelector('button[jsname="LgbsSe"]');if(b)b.click();});
    await sleep(8000);
    for(let i=0;i<3;i++){const c=await gp.evaluate(()=>{const b=Array.from(document.querySelectorAll('button')).find(x=>{const t=x.textContent.toLowerCase();return t.includes('continue')||t.includes('accept')||t.includes('lanjutkan')});if(b){b.click();return true;}return false;});if(c)await sleep(2000);else break;}

    await gp.goto('https://mail.google.com/mail/u/0/',{waitUntil:'networkidle2',timeout:30000});
    await sleep(5000);

    // Check for verification email
    let clicked = await gp.evaluate(() => {
      const rows = document.querySelectorAll('tr');
      for (const r of rows) { if (r.textContent.includes('Token Harbor') && r.textContent.includes('Verify')) { r.click(); return true; } }
      for (const r of rows) { if (r.textContent.includes('Token Harbor')) { r.click(); return true; } }
      return false;
    });

    if (!clicked) {
      // Check spam
      console.log('  Checking spam...');
      await gp.goto('https://mail.google.com/mail/u/0/#spam', {waitUntil:'networkidle2',timeout:30000});
      await sleep(3000);
      clicked = await gp.evaluate(() => {
        const rows = document.querySelectorAll('tr');
        for (const r of rows) { if (r.textContent.includes('Token Harbor')) { r.click(); return true; } }
        return false;
      });
    }

    if (!clicked) {
      // Try all mail
      console.log('  Checking all mail...');
      await gp.goto('https://mail.google.com/mail/u/0/#all', {waitUntil:'networkidle2',timeout:30000});
      await sleep(3000);
      clicked = await gp.evaluate(() => {
        const rows = document.querySelectorAll('tr');
        for (const r of rows) { if (r.textContent.includes('Token Harbor')) { r.click(); return true; } }
        return false;
      });
    }

    if (!clicked) {
      // Wait more and retry inbox
      console.log('  Waiting 15s for email...');
      await sleep(15000);
      await gp.goto('https://mail.google.com/mail/u/0/',{waitUntil:'networkidle2',timeout:30000});
      await sleep(5000);
      clicked = await gp.evaluate(() => {
        const rows = document.querySelectorAll('tr');
        for (const r of rows) { if (r.textContent.includes('Token Harbor')) { r.click(); return true; } }
        return false;
      });
    }

    if (!clicked) {
      console.log('  ❌ Verification email not found');
      // Try to continue anyway - maybe email already verified
      console.log('  Trying to login directly...');
      await gCtx.close();

      const lCtx = await browser.createBrowserContext();
      const lp = await lCtx.newPage();
      await lp.goto('https://tokenharbor.ai/login', {waitUntil:'networkidle2',timeout:30000});
      await sleep(2000);
      await lp.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Sign in'); if(b) b.click(); });
      await sleep(1000);
      ei = await lp.$('input[type="email"]'); if(ei){ await ei.click(); await ei.type(email, {delay:30}); }
      pi = await lp.$('input[type="password"]'); if(pi){ await pi.click(); await pi.type('Daffa112233!', {delay:30}); }
      await sleep(300);
      await lp.keyboard.press('Enter');
      await sleep(8000);

      if (!lp.url().includes('dashboard')) {
        console.log('  ❌ Login failed');
        await lCtx.close(); await browser.close();
        return {email, status:'email_not_found', key:null};
      }

      // Check if email is verified
      const dashText = await lp.evaluate(() => document.body.innerText);
      if (dashText.includes('Verify your email')) {
        console.log('  ❌ Email not verified, need verification link');
        await lCtx.close(); await browser.close();
        return {email, status:'not_verified', key:null};
      }

      // Email verified, create API key
      console.log('[5/5] Creating API key...');
      await lp.goto('https://tokenharbor.ai/dashboard/api-keys', {waitUntil:'networkidle2',timeout:15000});
      await sleep(2000);
      await lp.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('new key')); if(b) b.click(); });
      await sleep(2000);
      let li = await lp.$('input[type="text"]'); if(li){ await li.click({clickCount:3}); await li.type(email.split('@')[0]+'-key', {delay:20}); await sleep(500); }
      await lp.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('create key')); if(b) b.click(); });
      await sleep(3000);
      await lp.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('show')); if(b) b.click(); });
      await sleep(2000);
      const key = await lp.evaluate(() => {
        const m = document.body.innerText.match(/thk_live_[a-zA-Z0-9_\-]{20,}/);
        if (m) return m[0];
        for (const i of document.querySelectorAll('input')) { if (i.value.length > 20 && i.value.includes('_')) return i.value; }
        return '';
      });
      await lCtx.close(); await browser.close();
      if (key) { console.log('\n✅ KEY:', key); return {email, status:'success', key}; }
      return {email, status:'key_failed', key:null};
    }

    await sleep(3000);

    // Extract verify link
    const vl = await gp.evaluate(() => {
      for (const a of document.querySelectorAll('a')) { if ((a.href||'').includes('verify-email')) return a.href; }
      const m = document.body.innerText.match(/https:\/\/tokenharbor\.ai\/verify-email\?token=[^\s]+/);
      return m ? m[0] : '';
    });
    if (!vl) { console.log('  ❌ No verify link'); await gCtx.close(); await browser.close(); return {email, status:'no_verify_link', key:null}; }
    console.log('  ✅ Got verify link');

    // Verify
    console.log('[3/5] Verifying...');
    await gp.goto(vl, {waitUntil:'networkidle2',timeout:30000});
    await sleep(5000);

    // Login
    console.log('[4/5] Logging in...');
    await gp.goto('https://tokenharbor.ai/login', {waitUntil:'networkidle2',timeout:30000});
    await sleep(2000);
    await gp.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Sign in'); if(b) b.click(); });
    await sleep(1000);
    ei = await gp.$('input[type="email"]'); if(ei){ await ei.click(); await ei.type(email, {delay:30}); }
    pi = await gp.$('input[type="password"]'); if(pi){ await pi.click(); await pi.type('Daffa112233!', {delay:30}); }
    await sleep(300);
    await gp.keyboard.press('Enter');
    await sleep(8000);

    if (!gp.url().includes('dashboard')) { console.log('  ❌ Login failed'); await gCtx.close(); await browser.close(); return {email, status:'login_failed', key:null}; }
    console.log('  ✅ Logged in');

    // Create API key
    console.log('[5/5] Creating API key...');
    await gp.goto('https://tokenharbor.ai/dashboard/api-keys', {waitUntil:'networkidle2',timeout:15000});
    await sleep(2000);
    await gp.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('new key')); if(b) b.click(); });
    await sleep(2000);
    let li = await gp.$('input[type="text"]'); if(li){ await li.click({clickCount:3}); await li.type(email.split('@')[0]+'-key', {delay:20}); await sleep(500); }
    await gp.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('create key')); if(b) b.click(); });
    await sleep(3000);
    await gp.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('show')); if(b) b.click(); });
    await sleep(2000);

    const key = await gp.evaluate(() => {
      const m = document.body.innerText.match(/thk_live_[a-zA-Z0-9_\-]{20,}/);
      if (m) return m[0];
      for (const i of document.querySelectorAll('input')) { if (i.value.length > 20 && i.value.includes('_')) return i.value; }
      return '';
    });

    await gCtx.close(); await browser.close();
    if (key) { console.log('\n✅ KEY:', key); return {email, status:'success', key}; }
    console.log('⚠️ No key found');
    return {email, status:'key_failed', key:null};

  } catch(e) {
    console.log('❌ ERROR:', e.message);
    try{await browser.close();}catch{}
    return {email, status:'error', key:null};
  }
}

(async () => {
  console.log('TokenHarbor - Login + Verify + Create Key');
  for (const acc of accounts) {
    const r = await run(acc);
    results.push(r);
    fs.writeFileSync('tokenharbor-bekri-results.txt', results.map(x=>x.email+'|'+(x.key||x.status)).join('\n'));
    if (r.status === 'rate_limited') break;
    await sleep(3000);
  }
  console.log('\n=== RESULTS ===');
  for (const r of results) console.log(r.email+': '+(r.key?'✅ '+r.key:'❌ '+r.status));
  fs.writeFileSync('tokenharbor-bekri-results.txt', results.map(x=>x.email+'|'+(x.key||x.status)).join('\n'));
})();
