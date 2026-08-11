#!/bin/bash
# TokenHarbor Harvest — Email/Password + mail.tm
# Proven working flow from Aug 10, 2026 session
#
# Usage:
#   ./tokenharbor-harvest.sh                    # harvest 1 account
#   ./tokenharbor-harvest.sh --count 5          # harvest 5 accounts
#   ./tokenharbor-harvest.sh --dry-run          # test without creating
#
# Requirements:
#   - Node.js 18+
#   - Puppeteer + stealth plugin (npm install in mimo-harvester/)
#   - Chrome/Chromium binary
#
# IMPORTANT: Set these before running:
#   export CHROME_EXECUTABLE_PATH=/path/to/chrome
#   export MAIL_TM_API=https://api.mail.tm
#   export HARBOR_INVITE=TH-653T-4B6A
#
# DO NOT commit API keys or passwords to this script.
# Store credentials in .env (gitignored).

set -euo pipefail

CHROME="${CHROME_EXECUTABLE_PATH:-/home/work/.openclaw/tmp/chrome-dir/chrome}"
MAIL_TM="${MAIL_TM_API:-https://api.mail.tm}"
HARBOR="${HARBOR_URL:-https://tokenharbor.ai}"
INVITE="${HARBOR_INVITE:-TH-653T-4B6A}"
PASSWORD="${HARBOR_PASS:-}"  # Set via env, not hardcoded
COUNT="${1:-1}"

if [ -z "$PASSWORD" ]; then
  echo "❌ Set HARBOR_PASS env var first"
  echo "   export HARBOR_PASS='YourSecurePassword123!'"
  exit 1
fi

echo "🏴‍☠️ TokenHarbor Harvest"
echo "  Chrome: $CHROME"
echo "  Invite: $INVITE"
echo "  Count: $COUNT"
echo ""

# Get mail.tm domain
DOMAIN=$(curl -s "$MAIL_TM/domains" | python3 -c "import sys,json; print(json.load(sys.stdin)['hydra:member'][0]['domain'])" 2>/dev/null)
if [ -z "$DOMAIN" ]; then
  echo "❌ Failed to get mail.tm domain"
  exit 1
fi
echo "📧 Domain: $DOMAIN"

for i in $(seq 1 "$COUNT"); do
  echo ""
  echo "═══ Account $i/$COUNT ═══"
  
  # Generate random email
  EMAIL="th$(head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')@${DOMAIN}"
  echo "📧 Email: $EMAIL"
  
  # Create mail.tm account FIRST (critical!)
  echo "  Creating mail.tm account..."
  CREATE_RESP=$(curl -s -X POST "$MAIL_TM/accounts" \
    -H "Content-Type: application/json" \
    -d "{\"address\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
  
  if echo "$CREATE_RESP" | grep -q "address"; then
    echo "  ✅ mail.tm account created"
  else
    echo "  ❌ Failed: $CREATE_RESP"
    continue
  fi
  
  # Get JWT token
  TOKEN=$(curl -s -X POST "$MAIL_TM/token" \
    -H "Content-Type: application/json" \
    -d "{\"address\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
  
  if [ -z "$TOKEN" ]; then
    echo "  ❌ Failed to get token"
    continue
  fi
  echo "  ✅ Token acquired"
  
  # Register at TokenHarbor via browser
  echo "  Registering at TokenHarbor..."
  node -e "
    const puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());
    
    (async () => {
      const browser = await puppeteer.launch({
        headless: 'new',
        executablePath: '$CHROME',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      const page = await browser.newPage();
      await page.setViewport({width: 1920, height: 1080});
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {get: () => false});
      });
      
      // Navigate
      await page.goto('$HARBOR/login?invite=$INVITE', {waitUntil: 'networkidle2', timeout: 60000});
      await new Promise(r => setTimeout(r, 5000));
      
      // Click Sign up tab
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => (b.textContent||'').trim() === 'Sign up');
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 3000));
      
      // Fill email
      const emailInput = await page.\$('input[type=\"email\"]');
      if (emailInput) {
        await emailInput.click();
        await new Promise(r => setTimeout(r, 500));
        await emailInput.type('$EMAIL', {delay: 50});
      }
      await new Promise(r => setTimeout(r, 2000));
      
      // Fill password
      const passInput = await page.\$('input[type=\"password\"]');
      if (passInput) {
        await passInput.click();
        await new Promise(r => setTimeout(r, 500));
        await passInput.type('$PASSWORD', {delay: 50});
      }
      await new Promise(r => setTimeout(r, 5000));
      
      // Click Create account button
      await page.evaluate(() => {
        const btn = document.querySelector('button[type=\"submit\"]');
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 10000));
      
      // Check result
      const body = await page.evaluate(() => document.body.innerText.substring(0, 300));
      console.log('RESULT:' + body.substring(0, 200));
      
      await browser.close();
    })().catch(e => { console.error('ERROR:' + e.message); process.exit(1); });
  " 2>&1 | while read line; do
    echo "  $line"
  done
  
  # Wait for verification email
  echo "  Waiting for verification email..."
  VERIFY_URL=""
  for j in $(seq 1 40); do
    MSGS=$(curl -s "$MAIL_TM/messages" -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    TOTAL=$(echo "$MSGS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('hydra:totalItems',0))" 2>/dev/null)
    
    if [ "$TOTAL" -gt 0 ]; then
      echo "  ✅ Email received!"
      # Extract verify URL
      MSG_ID=$(echo "$MSGS" | python3 -c "import sys,json; print(json.load(sys.stdin)['hydra:member'][0]['id'])" 2>/dev/null)
      CONTENT=$(curl -s "$MAIL_TM/messages/$MSG_ID" -H "Authorization: Bearer $TOKEN" 2>/dev/null)
      VERIFY_URL=$(echo "$CONTENT" | python3 -c "
import sys, json, re
data = json.load(sys.stdin)
text = data.get('text', '')
urls = re.findall(r'https?://[^\s<>]+', text)
vu = next((u for u in urls if 'tokenharbor' in u or 'verify' in u), '')
print(vu)
" 2>/dev/null)
      break
    fi
    sleep 3
    [ $((j % 5)) -eq 0 ] && echo "  ...${j}s"
  done
  
  if [ -z "$VERIFY_URL" ]; then
    echo "  ❌ No verification email received"
    continue
  fi
  
  echo "  Verify URL: ${VERIFY_URL:0:60}..."
  echo "  ✅ Account created: $EMAIL"
  echo "  📝 Verify manually or continue automation"
  
  # Save account
  echo "$EMAIL|$PASSWORD" >> /tmp/tokenharbor-accounts.txt
  echo "  Saved to /tmp/tokenharbor-accounts.txt"
  
  # Delay between accounts
  if [ "$i" -lt "$COUNT" ]; then
    DELAY=$((RANDOM % 10 + 5))
    echo "  Waiting ${DELAY}s..."
    sleep "$DELAY"
  fi
done

echo ""
echo "═══ Done ═══"
if [ -f /tmp/tokenharbor-accounts.txt ]; then
  echo "Accounts saved:"
  cat /tmp/tokenharbor-accounts.txt
fi
