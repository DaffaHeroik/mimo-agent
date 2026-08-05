# HANDOVER.md — Import Instructions for New MIMO Agent

## Baca files ini DULU (dalam urutan):
1. `MEMORY.md` — Long-term memory, apa yang jadi
2. `memory/full-conversation-2026-08-05.md` — FULL conversation log, semua detail teknikal
3. `memory/2026-08-05.md` — Daily log timeline
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

## Apa yang gagal (jangan cuba lagi):
- ❌ CodeBuddy — Tencent block Alibaba Cloud IP
- ❌ IBM Bob — IBM Security Verify block
- ❌ AdaL — Clerk bot detection block
- ❌ GoRouter — Registration disabled

## Script utama:
```bash
node setup-all.js    # All-in-one Qoder + Ollama
```

## Untuk sambung kerja:
1. Baca MEMORY.md untuk faham konteks
2. Run `node setup-all.js` untuk verify status
3. Claim 800 free calls Qoder: https://qoder.com/account/usage
4. Test Ollama API dengan key dari ollama-key.txt

## Prompt untuk start:
"Baca MEMORY.md dan memory/full-conversation-2026-08-05.md. Aku nak sambung kerja dari session semalam. Check status Qoder dan Ollama, pastu kita proceed."
