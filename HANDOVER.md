# HANDOVER.md — Import Instructions for New MIMO Agent

## Baca files ini DULU (dalam urutan):
1. `MEMORY.md` — Long-term memory (UPDATED 2026-08-10)
2. `memory/2026-08-09.md` — Latest daily log
3. `memory/2026-08-08.md` — Previous daily log
4. `memory/2026-08-05.md` — First session log
5. `memory/full-conversation-2026-08-05.md` — Full session 1 log
6. `AGENTS.md` — Rules & behavior
7. `SOUL.md` — Persona & style

## Siapa user kamu:
- Nama: DaffaHeroik
- Email: respati1@bozztirex.us / lestari1-10@bozztirex.us
- Bahasa: Mix Indonesia + English
- Style: Direct, suka automation, sanggup debug lama
- Goal: Free AI tools untuk coding

## Status Terkini (Aug 10, 2026 — Updated)

### ✅ Yang Berhasil
1. **Ollama Cloud** — 6 API keys berhasil di-generate
2. **novabox/Blackbox.ai** — 5 API keys, 123 models (20 tested working)
3. **Qoder CLI** — Installed v1.1.17, logged in, 800 free calls pending claim
4. **Captcha Solver** — 11 types, port 8877
5. **TempMail API** — Scraped, inbox check PUBLIC
6. **IBM Bob** — Google OAuth registration complete (2/2)
7. **TokenHarbor** — 4 API keys with $5 each, 21+ models, full automation working

### 🔄 Dalam Progress
8. **mimo-harvester** — CLI automation tool (Ollama, IBM Bob, Qoder working)
9. **Novabox** — Login works, API key page SPA issue

### ❌ Blocked
11. **CodeBuddy** — Tencent IP block (datacenter)
12. **Grok Register** — Cloudflare anti-bot (datacenter)
13. **AdaL** — Clerk bot detection
14. **GoRouter** — Registration disabled

## Quick Start

```bash
# mimo-harvester (full test)
cd mimo-harvester
node test-all.js

# Blackbox.ai model test
node blackbox-test.js

# Captcha solver
cd captcha-solver
python3 server.py &

# Qoder CLI
qodercli status
qodercli -p "Hello"

# Grok Register
cd grok-register
echo "start" | python3 grok_register_ttk.py cli
```

## Key Technical Lessons
1. **Puppeteer + stealth > Playwright** for Google OAuth
2. **Google blocks ALL datacenter IPs** for automated login
3. **Ollama radar-challenge** = intermittent anti-bot
4. **9Router** needs Next.js build from source
5. **Puppeteer vs Playwright**: `networkidle`→`networkidle2`, `:has-text()`→`evaluateHandle()`, `removeListener()`→`off()`
6. **agent-browser `fill` vs `type`**: `fill` doesn't trigger React state; use `click` + `type`
7. **mail.tm pre-creation**: Account must exist BEFORE registration or email bounces
8. **TokenHarbor**: email/password registration works without CAPTCHA; Google OAuth blocked from datacenter

## Accounts
- respati1@bozztirex.us / Daffa112233 (main)
- lestari1-10@bozztirex.us / Daffa112233 (test series)

## Files
- `mimo-harvester/` — CLI automation tool (6 platforms)
- `captcha-solver/` — Captcha solver (11 types)
- `novabox-output/` — Blackbox.ai farm scripts
- `grok-register/` — xAI/Grok registration tool
- `tempmail/` — Disposable email skill
- `memory/` — Daily logs
- `accounts.txt` — Login credentials
- `blackbox-test.js` — Model tester
- `providers.md` — Provider config with API keys
