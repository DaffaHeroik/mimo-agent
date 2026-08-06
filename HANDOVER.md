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
- ✅ Ollama Cloud API — API key dalam ollama-key.txt
- ✅ Cline CLI v3.0.50 — installed
- ✅ Qoder Desktop — installed + Xvfb + deps

## Apa yang gagal (jangan cuba lagi):
- ❌ CodeBuddy — Tencent block Alibaba Cloud IP
- ❌ IBM Bob — IBM Security Verify block
- ❌ AdaL — Clerk bot detection block
- ❌ GoRouter — Registration disabled
- ❌ Claim 800 free calls via API — token encrypted with WASM

## Script utama:
```bash
node setup-all.js    # All-in-one: CLI + Ollama + Cline + Desktop
```

## Claim 800 free calls:
Baca `claim-guide.md` — perlu Desktop app di komputer lokal

## Untuk sambung kerja:
1. Baca MEMORY.md untuk faham konteks
2. Run `node setup-all.js` untuk verify status
3. Claim 800 free calls dari Desktop app lokal
4. Explore lebih banyak free models

## Prompt untuk start:
"Baca MEMORY.md dan memory/2026-08-06.md. Aku nak sambung kerja dari session semalam. Check status semua tools, pastu kita proceed."
