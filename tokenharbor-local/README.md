# TokenHarbor Auto-Register

Tinggal isi `accounts.txt`, jalankan, selesai. Dapat API key + $5 free credit per akun.

## Cara Pakai

```bash
# 1. Install
npm install

# 2. Edit accounts.txt (sudah ada template)

# 3. Jalankan
node start.js
```

## Format accounts.txt

```
email@domain.com|google_password
```

- Password TokenHarbor sudah di-hardcode di script (`Daffa112233!`)
- **google_password** → password Gmail/Google Workspace
- Kalau google password sama semua, cukup: `email` aja
- Baris `#` di-skip

### Contoh:

```
user@gmail.com|MyGmailPass123
user2@domain.com|MyGmailPass123
# atau kalau sama:
user3@gmail.com
```

## Apa yang Dilakukan

Setiap akun (otomatis):

1. **Register** di TokenHarbor (email + password + invite code)
2. **Buka Gmail** → cari email verifikasi dari TokenHarbor
3. **Klik verify link** dari email
4. **Login** ke TokenHarbor
5. **Buat API key** + enable free models

## Output

### Console

```
[14:32:01] Accounts: 7 | Already done: 0 | Sisa: 7
──────────────────────────────────────────────────
[14:32:01] ▶ muni4@bekri.site
[14:32:05]   [1/5] Register...
[14:32:13]   ✅ Registered
[14:32:14]   [2/5] Gmail...
[14:32:35]   ✅ Verify link ditemukan
[14:32:36]   [3/5] Verify...
[14:32:41]   ✅ Verified
[14:32:42]   [4/5] Login...
[14:32:50]   ✅ Logged in
[14:32:51]   [5/5] API Key...
[14:33:05]   ✅ KEY: thk_live_XXX...

══════════════════════════════════════════════════
  SELESAI
══════════════════════════════════════════════════
  ✅ Berhasil: 7
  ❌ Gagal: 0
  📄 Hasil: results.txt
```

### results.txt

```
muni4@bekri.site|thk_live_XXX...
muni5@bekri.site|thk_live_XXX...
```

## Resume / Re-run

Script otomatis skip akun yang sudah ada di `results.txt`. Kalau gagal di tengah, jalankan lagi — lanjut dari akun terakhir.

## Pakai API Key

```bash
# Test
curl https://tokenharbor.ai/v1/chat/completions \
  -H "Authorization: Bearer thk_live_XXX..." \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"Hello"}]}'

# Free models (perlu enable di dashboard dulu):
# - deepseek-v4-flash:free
# - kimi-k3:free
# - mimo-v2.5:free
```

## Troubleshooting

| Error | Solusi |
|-------|--------|
| "Too many sign-ups" | Tunggu 1 jam atau ganti jaringan (VPN/mobile hotspot) |
| "Email not found" | Tunggu lebih lama, atau cek spam folder |
| "Chrome not found" | Puppeteer auto-download Chrome. Kalau gagal: `npx puppeteer install chrome` |
| Login gagal | Cek password di accounts.txt |

## Kenapa Harus Lokal?

Server/VPS IP (datacenter) kena rate limit TokenHarbor:
> "Too many sign-ups from this network"

Proxy juga gak bisa — TokenHarbor block semua IP datacenter.

Dari IP rumah/ISP (IndiTel, Telkomsel, dll) harusnya aman.
