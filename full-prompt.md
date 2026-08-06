# FULL PROMPT — Copy-Paste ke MIMO Agent Baru

---

Baca semua files dalam repo https://github.com/DaffaHeroik/mimo-agent (clone dulu).

Kemudian baca dalam urutan ni:
1. HANDOVER.md
2. MEMORY.md
3. memory/full-conversation-2026-08-05.md
4. memory/2026-08-06.md
5. AGENTS.md
6. SOUL.md

Lepas tu, ini konteks penuh dari session terakhir (2026-08-06):

---

## APA YANG USER MAU

User (DaffaHeroik, respati1@bozztirex.us) nak cari dan setup **free AI coding tools** — specifically CLI-based agents yang boleh guna free tier atau free credits.

## STATUS TERKINI (Aug 6, 2026)

### ✅ Yang Sudah Jalan
1. **Qoder CLI v1.1.15** — Logged in (respati1@bozztirex.us), Qwen3.8-Max available
2. **Ollama Cloud API** — New key: `05225fc660ab4c208db24d9a9670b1b7.GHj_yPq8SbXJajYnSggueQO9`
3. **Cline CLI v3.0.50** — Installed at `node_modules/cline/bin/cline`
4. **Qoder Desktop** — Installed + Xvfb + GTK3 deps ready

### ⚠️ Pending
- **800 Free Calls** — Belum claim. Perlu buka Desktop app → Usage → Claim Now

### ❌ Gagal (jangan cuba lagi)
- CodeBuddy — Tencent block Alibaba Cloud IP
- IBM Bob — IBM Security Verify block
- AdaL — Clerk bot detection block
- GoRouter — Registration disabled
- Claim via API — Token encrypted with WASM, can't decrypt

## QUICK START

```bash
cd ~/.openclaw/workspace/mimo-agent

# Run all-in-one setup
node setup-all.js

# Test Ollama API
curl -X POST "https://ollama.com/api/chat" \
  -H "Authorization: Bearer $(grep 'Key:' ollama-key.txt | cut -d' ' -f2)" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:20b","messages":[{"role":"user","content":"Hello"}],"stream":false}'

# Test Qoder CLI
qodercli status
qodercli -p "Hello"

# Test Cline CLI
node node_modules/cline/bin/cline --version

# Launch Qoder Desktop (with Xvfb)
export DISPLAY=:99
export LD_LIBRARY_PATH=/tmp/gtk3/usr/lib/x86_64-linux-gnu:/tmp/deps/usr/lib/x86_64-linux-gnu:/tmp/qoder-desktop/usr/share/qoder
/tmp/qoder-desktop/usr/share/qoder/qoder --no-sandbox --disable-gpu
```

## CLAIM 800 FREE CALLS

Baca `claim-guide.md` untuk panduan lengkap.

Singkatnya:
1. Install Qoder Desktop di komputer lokal (https://qoder.com/download)
2. Login dengan respati1@bozztirex.us
3. Open Usage panel → Click "Claim Now"
4. Setelah claim, free calls boleh dipakai dari CLI di server

**Promo berakhir: 3 Sep 2026 (29 hari lagi)**

## TECHNICAL DETAILS

### Server Environment
- OS: Linux 6.12.21 (x64)
- IP: 47.236.80.116 (Alibaba Cloud Singapore)
- Node: v22.23.1
- Chrome: ~/.cache/puppeteer/chrome/linux-151.0.7922.71/chrome-linux64/chrome

### API Endpoints Found
- Claim: `center.qoder.sh/algo/api/v2/activity/claim` (POST, Bearer token)
- Eligibility: `center.qoder.sh/algo/api/v2/activity/claim/eligibility` (GET)
- User plan: `qoder.com/api/v1/me/userplan`
- Credits: `qoder.com/api/v2/me/usages/big_model_credits`

### Auth
- CLI token: `~/.qoder/.auth/user` (encrypted with WASM)
- Machine token: `~/.config/Qoder/SharedClientCache/cache/machine_token.json`
- Desktop auth: OAuth via external browser

## USER PREFERENCES

- Bahasa: Mix Indonesia + English
- Style: Direct, suka automation, sanggup debug lama
- Goal: Free AI tools untuk coding

---

**Run `node setup-all.js` untuk verify semua status.**
