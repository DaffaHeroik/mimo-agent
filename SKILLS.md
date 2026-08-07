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

---

## 🔧 Cara Pakai

### Interactive (TUI)
```bash
node mimo-setup.js
```

### CLI (non-interactive)
```bash
node mimo-setup.js qoder     # Flow Qoder semua akun
node mimo-setup.js ollama    # Flow Ollama semua akun
node mimo-setup.js captcha   # Setup captcha solver
node mimo-setup.js full      # Semua
node mimo-setup.js status    # Dashboard
node mimo-setup.js help      # Bantuan
```

### Tambah Skill Baru
1. Buat folder `skill-name/` di root project
2. Buat `skill-name/SKILL.md` dengan dokumentasi
3. Tambah entry di file ini (SKILLS.md)
4. Tambah flow/menu di `mimo-setup.js` jika perlu
5. Commit & push

---

## 📁 Struktur Repo

```
mimo-agent/
├── mimo-setup.js          ← Main script (TUI + CLI)
├── setup-all.js           ← Wrapper
├── SKILLS.md              ← File ini (skills registry)
├── AGENTS.md              ← Agent rules
├── SOUL.md                ← Persona
├── MEMORY.md              ← Long-term memory
├── HANDOVER.md            ← Import instructions
├── TOOLS.md               ← Local notes
├── USER.md                ← User info
├── accounts.txt           ← Akun (gitignored)
├── ollama-keys.json       ← API keys (gitignored)
├── memory/                ← Daily logs
│   ├── 2026-08-05.md
│   ├── 2026-08-06.md
│   └── 2026-08-07.md
└── captcha-solver/        ← Skill: Captcha Solver
    ├── SKILL.md
    ├── server.py
    ├── turnstile/
    ├── recaptcha/
    ├── hcaptcha/
    ├── cloudflare/
    ├── awswaf/
    ├── botguard/
    ├── datadome/
    ├── perimeterx/
    ├── akamai/
    ├── aliyun/
    ├── arkose/
    └── common/
```
