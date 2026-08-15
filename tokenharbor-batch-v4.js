const { execSync } = require('child_process');
const fs = require('fs');

const CHROME = '/home/work/.openclaw/workspace/.openclaw/tmp/chrome-dir/chrome';
process.env.AGENT_BROWSER_EXECUTABLE_PATH = CHROME;

const PASSWORD = 'Daffa112233!';
const GOOGLE_PW = 'Daffa112233';
const INVITE = 'TH-653T-4B6A';

const accounts = [
  'muni2@bekri.site', 'muni3@bekri.site', 'muni4@bekri.site', 'muni5@bekri.site',
  'muni6@bekri.site', 'muni7@bekri.site', 'muni8@bekri.site', 'muni9@bekri.site', 'muni10@bekri.site'
];

const results = [{ email: 'muni1@bekri.site', key: 'thk_live_XXf1Dss3VEj3QjuB-9SSZ_Bc-waBhvSsKxbhdRPfVzXjvfVZPMlbEiaEsSTxWHxV' }];

function ab(cmd) {
  try {
    return execSync(`agent-browser ${cmd}`, { timeout: 60000, encoding: 'utf8', env: { ...process.env, AGENT_BROWSER_EXECUTABLE_PATH: CHROME } }).trim();
  } catch (e) {
    return (e.stdout || e.stderr || e.message || '').trim();
  }
}

function sleep(ms) { execSync(`sleep ${Math.ceil(ms / 1000)}`); }

function findRef(snapshot, text) {
  const lines = snapshot.split('\n');
  for (const line of lines) {
    if (line.toLowerCase().includes(text.toLowerCase())) {
      const match = line.match(/ref=(\S+)/);
      if (match) return match[1];
    }
  }
  return null;
}

async function processAccount(email) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${email}`);
  console.log('='.repeat(60));

  try {
    // === STEP 1: Register on TokenHarbor ===
    console.log('[1/6] Registering on TokenHarbor...');
    ab(`open "https://tokenharbor.ai/login?invite=${INVITE}"`);
    sleep(2000);

    // Accept cookies
    ab('click "Essential only"');
    sleep(500);

    // Click Sign up tab
    ab('click "Sign up"');
    sleep(1000);

    // Get refs
    let snap = ab('snapshot -i');
    let emailRef = findRef(snap, 'EMAIL');
    let pwdRef = findRef(snap, 'PASSWORD');

    if (emailRef) {
      ab(`click @${emailRef}`);
      ab(`type @${emailRef} "${email}"`);
    }
    sleep(300);

    if (pwdRef) {
      ab(`click @${pwdRef}`);
      ab(`type @${pwdRef} "${PASSWORD}"`);
    }
    sleep(300);

    ab('press Enter');
    sleep(8000);

    // Check for rate limit
    snap = ab('snapshot');
    if (snap.includes('free tier limit') || snap.includes('rate limit')) {
      console.log('❌ RATE LIMITED');
      return { email, status: 'rate_limited', key: null };
    }
    if (snap.includes("couldn't create")) {
      console.log('❌ Registration error');
      return { email, status: 'reg_error', key: null };
    }
    console.log('  ✅ Registered');

    // === STEP 2: Check Gmail ===
    console.log('[2/6] Checking Gmail...');
    ab('open "https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin&continue=https://mail.google.com/mail/"');
    sleep(3000);

    snap = ab('snapshot -i');
    let gEmailRef = findRef(snap, 'Email or phone') || findRef(snap, 'email');
    if (gEmailRef) {
      ab(`click @${gEmailRef}`);
      ab(`type @${gEmailRef} "${email}"`);
    }
    sleep(1000);
    ab('click "Next"');
    sleep(5000);

    snap = ab('snapshot -i');
    let gPwdRef = findRef(snap, 'password') || findRef(snap, 'Enter your password');
    if (gPwdRef) {
      ab(`click @${gPwdRef}`);
      ab(`keyboard type "${GOOGLE_PW}"`);
    }
    sleep(1000);
    ab('click "Next"');
    sleep(8000);

    // Handle consent
    ab('click "Continue"');
    sleep(1000);
    ab('click "Lanjutkan"');
    sleep(1000);

    // Open Gmail
    ab('open "https://mail.google.com/mail/u/0/"');
    sleep(5000);

    // Check for Token Harbor email
    snap = ab('snapshot');
    if (!snap.includes('Token Harbor')) {
      console.log('  Waiting for email...');
      sleep(10000);
      ab('open "https://mail.google.com/mail/u/0/"');
      sleep(5000);
      snap = ab('snapshot');
    }

    if (!snap.includes('Token Harbor')) {
      console.log('  ❌ Verification email not found');
      return { email, status: 'email_not_found', key: null };
    }

    // Click the email
    ab('click "Verify your email"');
    sleep(3000);

    // Extract verification link
    snap = ab('snapshot');
    const verifyMatch = snap.match(/https:\/\/tokenharbor\.ai\/verify-email\?token=[^\s]+/);
    if (!verifyMatch) {
      console.log('  ❌ Verification link not found');
      return { email, status: 'verify_link_not_found', key: null };
    }
    const verifyLink = verifyMatch[0];
    console.log('  ✅ Got verification link');

    // === STEP 3: Verify email ===
    console.log('[3/6] Verifying email...');
    ab(`open "${verifyLink}"`);
    sleep(5000);
    console.log('  ✅ Email verified');

    // === STEP 4: Login to TokenHarbor ===
    console.log('[4/6] Logging into TokenHarbor...');
    ab('open "https://tokenharbor.ai/login"');
    sleep(2000);

    ab('click "Sign in"');
    sleep(1000);

    snap = ab('snapshot -i');
    let lEmailRef = findRef(snap, 'EMAIL');
    let lPwdRef = findRef(snap, 'PASSWORD');

    if (lEmailRef) {
      ab(`click @${lEmailRef}`);
      ab(`type @${lEmailRef} "${email}"`);
    }
    sleep(300);
    if (lPwdRef) {
      ab(`click @${lPwdRef}`);
      ab(`type @${lPwdRef} "${PASSWORD}"`);
    }
    sleep(300);
    ab('press Enter');
    sleep(8000);

    snap = ab('snapshot');
    if (!snap.includes('BALANCE') && !snap.includes('API Key')) {
      console.log('  ❌ Login failed');
      return { email, status: 'login_failed', key: null };
    }
    console.log('  ✅ Logged in');

    // === STEP 5: Enable free models ===
    console.log('[5/6] Enabling free models...');
    ab('open "https://tokenharbor.ai/dashboard"');
    sleep(3000);
    snap = ab('snapshot -i');
    const switchRef = findRef(snap, 'free model');
    if (switchRef) ab(`click @${switchRef}`);
    sleep(2000);

    // === STEP 6: Create API key ===
    console.log('[6/6] Creating API key...');
    ab('open "https://tokenharbor.ai/dashboard/api-keys"');
    sleep(2000);

    ab('click "New key"');
    sleep(2000);

    snap = ab('snapshot -i');
    // Find a textbox that's not EMAIL or PASSWORD
    const textboxes = snap.split('\n').filter(l => l.includes('textbox') && !l.includes('EMAIL') && !l.includes('PASSWORD'));
    if (textboxes.length > 0) {
      const refMatch = textboxes[0].match(/ref=(\S+)/);
      if (refMatch) {
        ab(`click @${refMatch[1]}`);
        ab(`type @${refMatch[1]} "${email.split('@')[0]}-key"`);
      }
    }
    sleep(500);

    ab('click "Create key"');
    sleep(3000);

    ab('click "Show"');
    sleep(2000);

    snap = ab('snapshot');
    const keyMatch = snap.match(/thk_live_[a-zA-Z0-9_\-]{20,}/);
    if (keyMatch) {
      console.log(`\n✅ API KEY: ${keyMatch[0]}`);
      return { email, status: 'success', key: keyMatch[0] };
    }

    console.log('  ⚠️ Could not extract API key');
    return { email, status: 'key_failed', key: null };

  } catch (err) {
    console.log(`❌ ERROR: ${err.message}`);
    return { email, status: 'error', key: null, error: err.message };
  }
}

(async () => {
  console.log('TokenHarbor Batch v4 (agent-browser)');
  console.log(`Accounts: ${accounts.length}\n`);

  for (const account of accounts) {
    const result = await processAccount(account);
    results.push(result);
    fs.writeFileSync('tokenharbor-bekri-results.txt', results.map(r => `${r.email}|${r.key || r.status}`).join('\n'));
    if (result.status === 'rate_limited') break;
    sleep(3000);
  }

  console.log('\n' + '='.repeat(60));
  console.log('FINAL RESULTS');
  console.log('='.repeat(60));
  for (const r of results) {
    console.log(`${r.email}: ${r.key ? '✅ ' + r.key : '❌ ' + r.status}`);
  }
  fs.writeFileSync('tokenharbor-bekri-results.txt', results.map(r => `${r.email}|${r.key || r.status}`).join('\n'));
})();
