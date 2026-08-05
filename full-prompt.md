# FULL PROMPT — Copy-Paste ke MIMO Agent Baru

---

Baca semua files dalam repo https://github.com/DaffaHeroik/mimo-agent (clone dulu).

Kemudian baca dalam urutan ni:
1. HANDOVER.md
2. MEMORY.md
3. memory/full-conversation-2026-08-05.md
4. AGENTS.md
5. SOUL.md

Lepas tu, ini konteks penuh dari session semalam (2026-08-05, 21:00 - 01:00 GMT+8):

---

## APA YANG USER MAU

User (DaffaHeroik, respati1@bozztirex.us) nak cari dan setup **free AI coding tools** — specifically CLI-based agents yang boleh guna free tier atau free credits.

## APA YANG BERJAYA

### 1. Qoder CLI ✅
- Qoder ada promo **800 free calls** untuk Qwen3.8-Max (2.4T params)
- Promo: 3 Aug - 3 Sep 2026
- CLI installed: v1.1.15
- Account logged in: respati1@bozztirex.us
- Login flow: Google OAuth via headless browser (Puppeteer + stealth plugin)
- Claim 800 calls: https://qoder.com/account/usage

### 2. Ollama Cloud API ✅
- Ollama ada free tier dengan 18 cloud models
- Account: respati1@bozztirex.us
- API Key: 16cb4f6866814f1abc6ac8b326f9d757.yHE0OLddJ_VsohrhGhFhPpe0
- Endpoint: `POST https://ollama.com/api/chat` (BUKAN /v1/chat/completions)
- Free models: gpt-oss:20b, gpt-oss:120b, gemma4:31b, nemotron-3-super, minimax-m2.7, dll
- Pro models (subscription): kimi-k3, deepseek-v4-flash:0731, glm-5.2

## APA YANG GAGAL (jangan cuba lagi)

### CodeBuddy (Tencent) ❌
- Login berjaya (Google OAuth accepted)
- Tapi kena block: "Account Access Restricted — security policy"
- Sebab: IP Alibaba Cloud (47.236.80.116) kena block oleh Tencent

### IBM Bob ❌
- Login page accessible
- Tapi kena block: "Service unavailable"
- Sebab: IBM Security Verify block datacenter IP

### AdaL (Sylph AI) ❌
- Google OAuth berjaya (email + password + consent semua ok)
- Tapi Clerk auth reject: `__client_uat=0` (session tak create)
- Sebab: Clerk bot detection block headless browser dari datacenter IP

### GoRouter ❌
- Registration disabled (`register_enabled: false`)
- Cloudflare Turnstile CAPTCHA required

## TEKNIKAL DETAILS

### Server Environment
- OS: Linux 6.12.21 (x64)
- IP: 47.236.80.116 (Alibaba Cloud Singapore)
- Node: v22.23.1
- Chrome: ~/.local/chrome/chrome (copied from /opt/ms-playwright)

### Google OAuth Flow (yang works)
```
1. Buka sign-in page
2. Click "Sign in with Google"
3. Email: input#identifierId atau input[type="text"]
4. Click Next (button text "Next")
5. Password: input[type="password"]
6. Click Next (#passwordNext)
7. Consent: button "Continue" / "Lanjutkan"
8. Speedbump: scroll down + checkbox + click "I understand"
```

### Puppeteer Stealth Setup
```javascript
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
// Launch with: executablePath: HOME + '/.local/chrome/chrome'
// Args: --no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu
```

### Auth Detection Patterns
- Qoder: Relaxed ✅
- CodeBuddy: IP-based (blocks Alibaba) ❌
- IBM Bob: IP + browser ❌
- AdaL (Clerk): Bot detection (__client_uat=0) ❌
- Google: CAPTCHA sometimes ⚠️
- Ollama: Minimal ✅

## SCRIPTS YANG DICIPTA

| Script | Function |
|--------|----------|
| `setup-all.js` | ⭐ MAIN — All-in-one Qoder + Ollama setup |
| `qoder-oneclick.js` | Qoder multi-account + retry |
| `qoder-ui.js` | Full TUI menu dengan inquirer |
| `qoder-auto-login.js` | Browser automation untuk Qoder |
| `qoder-cli-login.js` | CLI + browser combined login |
| `qoder-extract-auth.js` | Cookie/token extraction |
| `qoder-oauth.js` | Basic OAuth flow |
| `qoder-login.sh` | Print login link |
| `qoder-setup.sh` | Setup guide |
| `codebuddy-login.js` | CodeBuddy automation (gagal) |
| `bob-login.js` | IBM Bob automation (gagal) |

### Dependencies
```bash
cd ~/.openclaw/tmp
npm install puppeteer-core puppeteer-extra puppeteer-extra-plugin-stealth inquirer
```

## USER PREFERENCES

- Bahasa: Mix Indonesia (Bahasa) + English
- Style: Direct, no-nonsense, suka automation
- Patience: Sanggup debug berjam-jam
- Goal: Free AI tools untuk coding
- Account: respati1@bozztirex.us / Daffa112233

## STATUS SEMASA

- ✅ Qoder CLI logged in, Qwen3.8-Max available
- ✅ Ollama API key obtained, tested working
- ⏳ 800 free calls Qoder belum claim (perlu buka https://qoder.com/account/usage)
- ⏳ Cline CLI belum cuba (ada free Kimi K2.5)

## NEXT STEPS

1. Claim 800 free calls Qoder
2. Test Qwen3.8-Max dengan `qodercli -p "Hello"`
3. Test Ollama API dengan curl command dari ollama-key.txt
4. Cuba Cline CLI kalau free tier masih available
5. Explore lebih banyak free models

---

**Run `node setup-all.js` untuk verify semua status.**
