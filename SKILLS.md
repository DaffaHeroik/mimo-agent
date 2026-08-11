# SKILLS.md — MIMO Agent Skills Registry

Skills yang sudah include di repo ini. Setiap import mimo-agent otomatis dapat semua skill di bawah.

## 📋 Daftar Skills

### 1. 🛡️ Captcha Solver
- **Lokasi:** `captcha-solver/`
- **SKILL:** `captcha-solver/SKILL.md`
- **Apa:** Local captcha-solving HTTP sidecar (11 jenis captcha)
- **Supports:** Turnstile, reCAPTCHA, hCaptcha, Cloudflare, AWS WAF, BotGuard, DataDome, PerimeterX, Akamai, Aliyun, Arkose
- **Port:** `http://127.0.0.1:8877`
- **Docs:** `http://127.0.0.1:8877/docs` (Swagger UI)
- **Setup:** `pip3 install --user fastapi uvicorn pydantic cloakbrowser pillow onnxruntime opencv-python-headless numpy`
- **Run:** `cd captcha-solver && python3 server.py`
- **Via mimo:** `node mimo-setup.js captcha`

### 2. ⚡ Qoder CLI
- **Lokasi:** (external install)
- **Apa:** AI coding CLI dengan Qwen3.8-Max
- **Setup:** `curl -fsSL https://qoder.com/install | bash`
- **Via mimo:** `node mimo-setup.js qoder`

### 3. ☁️ Ollama Cloud API
- **Lokasi:** (external service)
- **Apa:** Free tier cloud LLM API (18 models)
- **Models:** gpt-oss:20b, gpt-oss:120b, gemma4:31b, dll
- **Via mimo:** `node mimo-setup.js ollama`

### 4. 🖥️ Qoder Desktop
- **Lokasi:** `/tmp/qoder-desktop/`
- **Apa:** Desktop app untuk claim 800 free calls
- **Via mimo:** `node mimo-setup.js full` (step 5)

### 5. ⚡ Cline CLI
- **Lokasi:** (npm install)
- **Apa:** AI coding CLI
- **Via mimo:** `node mimo-setup.js full` (step 4)

### 6. 📧 TempMail API
- **Lokasi:** `tempmail/`
- **SKILL:** `tempmail/SKILL.md`
- **Apa:** Disposable email API dari ikona-oni.com
- **API Base:** `https://tempmail-worker.hasildia1.workers.dev`
- **Key:** Inbox check PUBLIC (no auth), generate butuh auth
- **Domain:** `merapi92338.my.id` + dynamic dari Supabase
- **Use case:** Auto-registration, email verification, testing

### 7. 🤖 mimo-harvester
- **Lokasi:** `mimo-harvester/`
- **Apa:** CLI automation tool untuk token harvesting dari multiple platforms
- **Platforms:** Ollama, Qoder, IBM Bob, TokenHarbor, Novabox, CodeBuddy
- **Browser:** Puppeteer + stealth plugin (Google OAuth works)
- **Run:** `cd mimo-harvester && node test-all.js`
- **Config:** `.env` file (Chrome path, headless, etc.)

### 8. 🧪 Blackbox.ai Model Tester
- **Lokasi:** `blackbox-test.js`
- **Apa:** Test semua model di Blackbox.ai API
- **API:** OpenAI-compatible at `api.blackbox.ai/v1`
- **Run:** `node blackbox-test.js`
- **Output:** Working models report

### 9. 🦑 Grok Register
- **Lokasi:** `grok-register/`
- **Apa:** Python tool untuk xAI/Grok registration automation
- **Repo:** `https://github.com/AaronL725/grok-register`
- **Run:** `echo "start" | python3 grok_register_ttk.py cli`
- **Note:** Blocked by Cloudflare on datacenter IPs

### 10. 🏗️ TokenHarbor
- **Lokasi:** `mimo-harvester/src/automations/tokenharbor/`
- **Apa:** TokenHarbor.ai automation (email/password registration + API key)
- **Invite:** TH-653T-4B6A ($5 free credit per account)
- **API Base:** `https://tokenharbor.ai/v1/chat/completions` (OpenAI-compatible)
- **Models:** 21+ (deepseek-v4-flash/pro, claude-sonnet-5, gpt-5.6-*, grok-4.5, kimi-k3, mimo-v2.5-pro, etc.)
- **Free models:** deepseek-v4-flash:free, kimi-k3:free, mimo-v2.5:free (requires consent toggle)
- **Status:** ⚠️ 4 keys from Aug 10 session. Re-registration blocked by IP rate limit + emalupe.com domain block. Register from local machine with non-disposable email.
- **Key insight:** Google OAuth blocked from datacenter; use email/password registration instead
- **Key insight:** mail.tm account must be created BEFORE TokenHarbor registration

---

## 🔧 Cara Pakai

### mimo-harvester (Interactive)
```bash
cd mimo-harvester
node test-all.js
```

### mimo-harvester (Specific Platform)
```bash
node test-all.js  # Edit platforms array in test-all.js
```

### Blackbox.ai Model Test
```bash
node blackbox-test.js
```

### Grok Register
```bash
cd grok-register
echo "start" | python3 grok_register_ttk.py cli
```

### Captcha Solver
```bash
cd captcha-solver
python3 server.py &
```

### Tambah Skill Baru
1. Buat folder `skill-name/` di root project
2. Buat `skill-name/SKILL.md` dengan dokumentasi
3. Tambah entry di file ini (SKILLS.md)
4. Tambah worker di `mimo-harvester/src/automations/`
5. Tambah test case di `test-all.js`
6. Commit & push

---

## 📁 Struktur Repo

```
mimo-agent/
├── mimo-setup.js          ← Main script (TUI + CLI)
├── setup-all.js           ← Wrapper
├── blackbox-test.js       ← Model tester
├── providers.md           ← Provider config with API keys
├── harvester-fixes.md     ← Fix report
├── SKILLS.md              ← File ini (skills registry)
├── AGENTS.md              ← Agent rules
├── SOUL.md                ← Persona
├── MEMORY.md              ← Long-term memory (UPDATED)
├── HANDOVER.md            ← Import instructions (UPDATED)
├── TOOLS.md               ← Local notes
├── USER.md                ← User info
├── accounts.txt           ← Akun (gitignored)
├── memory/                ← Daily logs
│   ├── 2026-08-05.md
│   ├── 2026-08-06.md
│   ├── 2026-08-07.md
│   ├── 2026-08-08.md
│   └── 2026-08-09.md      ← NEW (full automation session)
├── captcha-solver/        ← Skill: Captcha Solver
├── mimo-harvester/        ← Skill: Token Harvester
│   ├── test-all.js        ← Test framework
│   ├── src/automations/   ← Platform workers
│   │   ├── ollama/
│   │   ├── qoder/
│   │   ├── ibmbob/
│   │   ├── tokenharbor/
│   │   ├── novabox/
│   │   └── codebuddy/
│   ├── src/browser/       ← Puppeteer + stealth
│   └── src/providers/     ← Google login, email
├── novabox-output/        ← Blackbox.ai farm scripts
├── grok-register/         ← xAI/Grok registration tool
└── tempmail/              ← Disposable email skill
```
