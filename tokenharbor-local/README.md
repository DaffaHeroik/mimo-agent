# TokenHarbor Batch Registration — Local

Register 7 akun TokenHarbor (muni4-muni10) dari komputer lokal.

## Kenapa Lokal?

Server kena rate limit "Too many sign-ups from this network". Dari IP rumah/ISP, harusnya aman.

## Cara Pakai

```bash
# 1. Install dependencies
npm install

# 2. Jalankan
node register.js

# 3. Tunggu (sekitar 2-3 menit per akun)
# 4. Hasil di: results.txt
```

## Yang Dilakukan Script

Setiap akun:
1. Register di TokenHarbor (email/password)
2. Buka Gmail → ambil verification email
3. Klik verify link
4. Login ke TokenHarbor
5. Buat API key

## Konfigurasi

Edit bagian atas `register.js`:

```javascript
const ACCOUNTS = ['muni4@bekri.site', ...];  // Email yang mau di-register
const PASSWORD = 'Daffa112233!';              // Password TokenHarbor (min 12 char)
const GOOGLE_PASSWORD = 'Daffa112233';        // Password Google/Gmail
const INVITE_CODE = 'TH-653T-4B6A';           // Invite code ($5 free credit)
```

## Output

```
results.txt:
muni1@bekri.site|thk_live_XXX...
muni2@bekri.site|thk_live_XXX...
...
```

## Troubleshooting

- **"Too many sign-ups"** → Ganti jaringan (VPN/mobile hotspot) atau tunggu 1 jam
- **Email not found** → Cek spam folder, atau tunggu lebih lama
- **Chrome not found** → Install Chrome/Chromium, atau edit path di script

## API Usage

```bash
curl https://tokenharbor.ai/v1/chat/completions \
  -H "Authorization: Bearer thk_live_XXX" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"Hello"}]}'
```
