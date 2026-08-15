#!/bin/bash
# TokenHarbor batch registration using agent-browser
set -e

export AGENT_BROWSER_EXECUTABLE_PATH=/home/work/.openclaw/workspace/.openclaw/tmp/chrome-dir/chrome

EMAILS=(
  "muni2@bekri.site"
  "muni3@bekri.site"
  "muni4@bekri.site"
  "muni5@bekri.site"
  "muni6@bekri.site"
  "muni7@bekri.site"
  "muni8@bekri.site"
  "muni9@bekri.site"
  "muni10@bekri.site"
)
PASSWORD="Daffa112233!"
GOOGLE_PW="Daffa112233"
INVITE="TH-653T-4B6A"
RESULTS_FILE="tokenharbor-bekri-results.txt"

# muni1 already done
echo "muni1@bekri.site|thk_live_XXf1Dss3VEj3QjuB-9SSZ_Bc-waBhvSsKxbhdRPfVzXjvfVZPMlbEiaEsSTxWHxV" > "$RESULTS_FILE"

for EMAIL in "${EMAILS[@]}"; do
  echo ""
  echo "============================================================"
  echo "Processing: $EMAIL"
  echo "============================================================"

  # Step 1: Register on TokenHarbor
  echo "[1/6] Registering on TokenHarbor..."
  agent-browser open "https://tokenharbor.ai/login?invite=$INVITE" 2>&1
  sleep 2

  # Accept cookies
  agent-browser click "Essential only" 2>/dev/null || true
  sleep 1

  # Click Sign up tab
  agent-browser click "Sign up" 2>&1
  sleep 1

  # Get refs
  REFS=$(agent-browser snapshot -i 2>&1)
  EMAIL_REF=$(echo "$REFS" | grep 'textbox "EMAIL"' | grep -oP 'ref=\K\S+' | tr -d ']')
  PWD_REF=$(echo "$REFS" | grep 'textbox "PASSWORD"' | grep -oP 'ref=\K\S+' | tr -d ']')

  echo "  Email ref: $EMAIL_REF, Pwd ref: $PWD_REF"

  # Fill email
  agent-browser click "@$EMAIL_REF" 2>&1
  agent-browser type "@$EMAIL_REF" "$EMAIL" 2>&1
  sleep 0.5

  # Fill password
  agent-browser click "@$PWD_REF" 2>&1
  agent-browser type "@$PWD_REF" "$PASSWORD" 2>&1
  sleep 0.5

  # Submit
  agent-browser press Enter 2>&1
  sleep 8

  # Check result
  PAGE_TEXT=$(agent-browser snapshot 2>&1)
  if echo "$PAGE_TEXT" | grep -qi "free tier limit\|rate limit"; then
    echo "❌ RATE LIMITED"
    echo "$EMAIL|rate_limited" >> "$RESULTS_FILE"
    break
  fi

  if echo "$PAGE_TEXT" | grep -qi "couldn't create"; then
    echo "❌ Registration error"
    echo "$EMAIL|reg_error" >> "$RESULTS_FILE"
    continue
  fi

  echo "  ✅ Registered"

  # Step 2: Check Gmail
  echo "[2/6] Checking Gmail..."
  agent-browser open "https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin&continue=https://mail.google.com/mail/" 2>&1
  sleep 3

  # Fill Google email
  GREFS=$(agent-browser snapshot -i 2>&1)
  GEMAIL_REF=$(echo "$GREFS" | grep -i 'email\|phone' | grep 'textbox' | grep -oP 'ref=\K\S+' | head -1 | tr -d ']')

  agent-browser click "@$GEMAIL_REF" 2>&1
  agent-browser type "@$GEMAIL_REF" "$EMAIL" 2>&1
  sleep 1
  agent-browser click "Next" 2>&1
  sleep 5

  # Fill Google password
  GPREFS=$(agent-browser snapshot -i 2>&1)
  GPWD_REF=$(echo "$GPREFS" | grep -i 'password' | grep 'textbox' | grep -oP 'ref=\K\S+' | head -1 | tr -d ']')

  agent-browser click "@$GPWD_REF" 2>&1
  agent-browser keyboard type "$GOOGLE_PW" 2>&1
  sleep 1
  agent-browser click "Next" 2>&1
  sleep 8

  # Handle consent
  agent-browser click "Continue" 2>/dev/null || true
  sleep 1
  agent-browser click "Lanjutkan" 2>/dev/null || true
  sleep 1

  # Open Gmail
  agent-browser open "https://mail.google.com/mail/u/0/" 2>&1
  sleep 5

  # Find and click TokenHarbor email
  EMAIL_FOUND=$(agent-browser snapshot 2>&1 | grep -c "Token Harbor" || true)
  if [ "$EMAIL_FOUND" -eq 0 ]; then
    echo "  Waiting for email..."
    sleep 10
    agent-browser open "https://mail.google.com/mail/u/0/" 2>&1
    sleep 5
    EMAIL_FOUND=$(agent-browser snapshot 2>&1 | grep -c "Token Harbor" || true)
  fi

  if [ "$EMAIL_FOUND" -eq 0 ]; then
    echo "  ❌ Verification email not found"
    echo "$EMAIL|email_not_found" >> "$RESULTS_FILE"
    continue
  fi

  # Click the email
  agent-browser snapshot -i 2>&1 | grep -i "token harbor" | head -1
  # Use JavaScript to click
  agent-browser snapshot -i 2>&1 > /dev/null

  # Get all refs and click the email row
  SNAPSHOT=$(agent-browser snapshot -i 2>&1)
  # Find the link or row for Token Harbor email
  TH_REF=$(echo "$SNAPSHOT" | grep -i "verify your email\|token harbor" | grep -oP 'ref=\K\S+' | head -1 | tr -d ']')

  if [ -n "$TH_REF" ]; then
    agent-browser click "@$TH_REF" 2>&1
  else
    # Try clicking by text
    agent-browser click "Verify your email" 2>/dev/null || agent-browser click "Token Harbor" 2>/dev/null || true
  fi
  sleep 3

  # Extract verification link
  VERIFY_LINK=$(agent-browser snapshot 2>&1 | grep -oP 'https://tokenharbor\.ai/verify-email\?token=[^\s]+' | head -1)

  if [ -z "$VERIFY_LINK" ]; then
    # Try from page source
    VERIFY_LINK=$(agent-browser snapshot 2>&1 | grep -oP 'https://tokenharbor[^\s]*verify[^\s]*' | head -1)
  fi

  if [ -z "$VERIFY_LINK" ]; then
    echo "  ❌ Verification link not found"
    echo "$EMAIL|verify_link_not_found" >> "$RESULTS_FILE"
    continue
  fi

  echo "  ✅ Got verification link"

  # Step 3: Verify email
  echo "[3/6] Verifying email..."
  agent-browser open "$VERIFY_LINK" 2>&1
  sleep 5
  echo "  ✅ Email verified"

  # Step 4: Login to TokenHarbor
  echo "[4/6] Logging into TokenHarbor..."
  agent-browser open "https://tokenharbor.ai/login" 2>&1
  sleep 2

  # Click Sign in tab
  agent-browser click "Sign in" 2>&1
  sleep 1

  # Get refs for login form
  LREFS=$(agent-browser snapshot -i 2>&1)
  LEMAIL_REF=$(echo "$LREFS" | grep 'textbox "EMAIL"' | grep -oP 'ref=\K\S+' | tr -d ']')
  LPWD_REF=$(echo "$LREFS" | grep 'textbox "PASSWORD"' | grep -oP 'ref=\K\S+' | tr -d ']')

  agent-browser click "@$LEMAIL_REF" 2>&1
  agent-browser type "@$LEMAIL_REF" "$EMAIL" 2>&1
  sleep 0.5
  agent-browser click "@$LPWD_REF" 2>&1
  agent-browser type "@$LPWD_REF" "$PASSWORD" 2>&1
  sleep 0.5
  agent-browser press Enter 2>&1
  sleep 8

  # Check if on dashboard
  DASH_CHECK=$(agent-browser snapshot 2>&1 | grep -c "BALANCE\|dashboard\|API Key" || true)
  if [ "$DASH_CHECK" -eq 0 ]; then
    echo "  ❌ Login failed"
    echo "$EMAIL|login_failed" >> "$RESULTS_FILE"
    continue
  fi
  echo "  ✅ Logged in"

  # Step 5: Enable free models
  echo "[5/6] Enabling free models..."
  agent-browser open "https://tokenharbor.ai/dashboard" 2>&1
  sleep 3
  # Click the switch
  agent-browser snapshot -i 2>&1 | grep -i "free model" | grep -oP 'ref=\K\S+' | head -1 | tr -d ']' | while read ref; do
    agent-browser click "@$ref" 2>/dev/null || true
  done
  sleep 2

  # Step 6: Create API key
  echo "[6/6] Creating API key..."
  agent-browser open "https://tokenharbor.ai/dashboard/api-keys" 2>&1
  sleep 2

  agent-browser click "New key" 2>/dev/null || agent-browser click "+ New key" 2>/dev/null || true
  sleep 2

  # Get refs for key form
  KREFS=$(agent-browser snapshot -i 2>&1)
  LABEL_REF=$(echo "$KREFS" | grep 'textbox' | grep -v 'EMAIL\|PASSWORD' | grep -oP 'ref=\K\S+' | head -1 | tr -d ']')

  if [ -n "$LABEL_REF" ]; then
    agent-browser click "@$LABEL_REF" 2>&1
    agent-browser type "@$LABEL_REF" "${EMAIL%%@*}-key" 2>&1
    sleep 0.5
  fi

  agent-browser click "Create key" 2>&1
  sleep 3

  agent-browser click "Show" 2>/dev/null || agent-browser click "Show plaintext" 2>/dev/null || true
  sleep 2

  # Extract API key
  API_KEY=$(agent-browser snapshot 2>&1 | grep -oP 'thk_live_[a-zA-Z0-9_\-]{20,}' | head -1)

  if [ -n "$API_KEY" ]; then
    echo ""
    echo "✅ API KEY: $API_KEY"
    echo "$EMAIL|$API_KEY" >> "$RESULTS_FILE"
  else
    echo "  ⚠️ Could not extract API key"
    echo "$EMAIL|key_failed" >> "$RESULTS_FILE"
  fi

  sleep 3
done

echo ""
echo "============================================================"
echo "FINAL RESULTS"
echo "============================================================"
cat "$RESULTS_FILE"
echo ""
echo "Results saved to $RESULTS_FILE"
