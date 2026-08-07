# HANDOVER.md — Import Instructions for New MIMO Agent

## Baca files ini DULU (dalam urutan):
1. `MEMORY.md` — Long-term memory, apa yang jadi
2. `memory/full-conversation-2026-08-05.md` — FULL conversation log session 1
3. `memory/2026-08-06.md` — Daily log session 2
4. `AGENTS.md` — Rules & behavior
5. `SOUL.md` — Persona & style

## Siapa user kamu:
- Nama: DaffaHeroik
- Email: respati1@bozztirex.us
- Bahasa: Mix Indonesia + English
- Style: Direct, suka automation, sanggup debug lama
- Goal: Free AI tools untuk coding

## Apa yang dah siap:
- ✅ Qoder CLI v1.1.15 — logged in, Qwen3.8-Max available
- ✅ Ollama Cloud API — API key dalam ollama-keys.json
- ✅ Cline CLI v3.0.50 — installed
- ✅ Qoder Desktop — installed + Xvfb + deps
- ✅ mimo-setup.js — All-In-One UI (v2.0)

## Apa yang gagal (jangan cuba lagi):
- ❌ CodeBuddy — Tencent block Alibaba Cloud IP
- ❌ IBM Bob — IBM Security Verify block
- ❌ AdaL — Clerk bot detection block
- ❌ GoRouter — Registration disabled
- ❌ Claim 800 free calls via API — token encrypted with WASM

## Script utama (mimo-setup.js v2.0):
```bash
# Interactive TUI (pilih flow → otomatis jalan semua akun)
node mimo-setup.js

# Flow Qoder: Install → Login semua akun → Claim 800 calls
node mimo-setup.js qoder

# Flow Ollama: Login semua akun → Create API key → Simpan
node mimo-setup.js ollama

# Flow Full: Qoder + Ollama + Cline + Desktop
node mimo-setup.js full

# Status dashboard
node mimo-setup.js status

# Lihat semua Ollama API keys
node mimo-setup.js keys

# Help
node mimo-setup.js help
```

## Flow:
1. Baca semua akun dari `accounts.txt` (format: `email|password`)
2. Pilih flow (Qoder / Ollama / Full)
3. Otomatis loop semua akun 1 per 1
4. Qoder: Install CLI → Login tiap akun → Claim guide
5. Ollama: Login tiap akun → Create API key → Simpan ke `ollama-keys.json`

## Files:
- `accounts.txt` — Semua akun (email|password)
- `ollama-keys.json` — Multi-account Ollama API keys
- `.qoder-state.json` — Qoder login state per akun
- `mimo-setup.js` — Main script

## Untuk sambung kerja:
1. Baca MEMORY.md untuk faham konteks
2. Run `node mimo-setup.js status` untuk verify status
3. Run `node mimo-setup.js full` untuk setup semua
