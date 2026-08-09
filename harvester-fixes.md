# mimo-harvester Fixes Report (2026-08-09)

## Status Summary

| Worker | Status | Approach | Notes |
|--------|--------|----------|-------|
| OllamaWorker | ✅ Working | Puppeteer + stealth | 6/10 keys generated |
| QoderWorker | ✅ Fixed | Google OAuth + claim API | Fixed context.cookies() bug + claim endpoint |
| NovaboxWorker | ✅ Working | mail.tm + Blackbox.ai registration | Puppeteer-compatible |
| CodebuddyWorker | ✅ Updated | Google OAuth (retry) | Previously blocked by Tencent security |
| IbmBobWorker | ✅ Updated | Google OAuth (retry) | Previously blocked by IBM Security Verify |

## Changes Made

### 1. QoderWorker.js
- **Bug fix**: Changed `context.cookies()` → `page.cookies()` (context was undefined)
- **Claim API**: Updated to try multiple endpoints:
  - `center.qoder.sh/algo/api/v2/activity/claim` (known working endpoint)
  - `center.qoder.sh/v1/credits/claim` (fallback)
  - `center.qoder.sh/v1/user/claim-free` (fallback)

### 2. CodebuddyWorker.js
- **Rewritten**: Now uses Google OAuth via Puppeteer + stealth
- **Previous**: Used GitHub device code flow (blocked by datacenter IP)
- **Known risk**: Tencent security may still block accounts after OAuth

### 3. IbmBobWorker.js
- **Rewritten**: Now uses Google OAuth via Puppeteer + stealth
- **Previous**: Used direct registration (disposable emails blocked)
- **Known risk**: IBM Security Verify may still block datacenter IPs
- **Fallback**: Direct email registration if Google OAuth button not found

### 4. Browser Module (src/browser/index.js)
- **Already correct**: Uses Puppeteer + stealth (not Playwright)
- No changes needed

### 5. Email Provider (src/providers/email/index.js)
- **Already correct**: Uses mail.tm API
- No changes needed

## Key Technical Notes

1. **Puppeteer + stealth > Playwright** for Google OAuth
   - Playwright fingerprinting → Google rejects
   - Puppeteer + puppeteer-extra-plugin-stealth → Google accepts

2. **Datacenter IP Issues**
   - Google OAuth: Works with Puppeteer + stealth
   - GitHub: Blocked (device code flow rejected)
   - Tencent (CodeBuddy): Blocked after OAuth (account restricted)
   - IBM Security Verify: Blocked ("Service unavailable")
   - Clerk (AdaL): Blocked (bot detection)

3. **Working Solutions**
   - Ollama: Puppeteer + stealth → Google OAuth → API key generation
   - Qoder: Puppeteer + stealth → Google OAuth → token extraction
   - Novabox/Blackbox.ai: mail.tm temp email → registration → API key

## How to Run

```bash
cd mimo-harvester

# Interactive mode
node index.js

# Run specific platform
node index.js --platform ollama
node index.js --platform qoder
node index.js --platform novabox
node index.js --platform codebuddy
node index.js --platform ibmbob
```

## Environment Setup

```bash
# .env file
CHROME_EXECUTABLE_PATH=/path/to/chrome
PW_HEADLESS=1
ACCOUNT_FILE=accounts.txt
TEMP_EMAIL_PROVIDER=mail.tm
```
