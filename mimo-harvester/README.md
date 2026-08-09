# 🌾 MIMO Harvester

CLI automation tool for token harvesting from multiple platforms. Built with Playwright + stealth.

## Supported Platforms

| Platform | Method | Output |
|----------|--------|--------|
| **CodeBuddy** | GitHub OAuth device flow | OAuth token |
| **Qoder** | Google OAuth + claim 800 calls | Auth token |
| **Ollama Cloud** | Google OAuth + API key generation | API key |
| **Novabox (Blackbox.ai)** | Temp email registration | API key |
| **IBM Bob** | Google OAuth / direct registration | Account credentials |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browsers
npx playwright install chromium

# 3. Configure
cp .env.example .env
# Edit .env with your settings

# 4. Add accounts
# Edit accounts.txt: email|password|proxy

# 5. Run
node index.js
```

## Configuration (.env)

```env
CHROME_EXECUTABLE_PATH=        # Leave empty for auto-detect
BROWSER_COUNT=2                # Parallel browser instances
BROWSER_SLOW_MO=2              # Slow down actions (ms)
PW_HEADLESS=1                  # 1=headless, 0=visible browser
ACCOUNT_FILE=accounts.txt
PROXY_POOL_FILE=proxies.txt
TEMP_EMAIL_PROVIDER=mail.tm    # mail.tm or 1secmail
MAIL_TM_API_KEY=               # Optional for mail.tm
DELAY_BETWEEN_ACCOUNTS_MS=5000
```

## Account Format (accounts.txt)

```
email@example.com|password|http://proxy:port
user2@gmail.com|pass123|
```

## Proxy Format (proxies.txt)

```
ip:port:user:pass
192.168.1.1:8080:admin:secret
```

## Output

```
output/
├── keys/
│   ├── codebuddy_keys.txt    # email|oauthToken
│   ├── qoder_keys.txt        # email|authToken|claimed
│   ├── ollama_keys.txt       # email|apiKey
│   ├── novabox_keys.txt      # email|apiKey
│   └── ibmbob_keys.txt       # email|password
└── errors/
    └── errorAccounts.txt     # email|password|Platform|timestamp|error
```

## Features

- **CLI Menu** — Interactive inquirer-based menu system
- **Parallel Workers** — Multiple browser instances per platform
- **Proxy Pool** — Automatic proxy rotation with 30-min cooldown
- **Account Locking** — Prevents duplicate processing
- **Stealth Mode** — Anti-detection via playwright-extra + stealth plugin
- **Progress Bars** — Real-time progress tracking per platform
- **Error Tracking** — Failed accounts logged with timestamps
- **Auto-cleanup** — Successful accounts removed from accounts.txt

## Architecture

```
index.js                    → CLI menu (inquirer)
src/
├── config/                 → Environment config
├── utils/                  → Shared utilities
├── browser/                → Playwright + stealth
├── cli/                    → Progress bars + reporter
├── automations/
│   ├── base/BaseWorker.js  → Abstract worker pattern
│   ├── codebuddy/          → GitHub OAuth flow
│   ├── qoder/              → Google OAuth + claims
│   ├── ollama/             → Google OAuth + API key
│   ├── novabox/            → Temp email + registration
│   └── ibmbob/             → Google OAuth / direct reg
└── providers/
    ├── email/              → Temp email (mail.tm, 1secmail)
    └── google/             → Google OAuth helper
```

## Disclaimer

This tool is for educational purposes only. Use responsibly and in compliance with each platform's Terms of Service.
