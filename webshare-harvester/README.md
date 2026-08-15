# Webshare Proxy Harvester

Register Webshare akun via Google OAuth, extract 10 free proxies per akun.

## Cara Pakai

```bash
npm install
node start.js
```

## Format accounts.txt

```
email|google_password
```

- Google OAuth signup (gak perlu captcha)
- Password Webshare di-hardcode (`Daffa112233!`)
- Baris `#` di-skip

## Flow

1. **Register** via Google OAuth (no captcha!)
2. **Auto-login** ke dashboard
3. **Extract** 10 proxies dari proxy list page
4. **Simpan** ke `proxies.txt`

## Output proxies.txt

```
# muni4@bekri.site
31.59.20.176:6754:username:password
45.38.107.97:6014:username:password
...

# muni5@bekri.site
...
```

## Resume

Akun yang sudah ada di `proxies.txt` di-skip. Jalankan lagi kalau gagal.

## Proxy Format

```
ip:port:username:password
```

Bisa langsung dipake di:
- Puppeteer: `--proxy-server=http://ip:port`
- curl: `--proxy http://username:password@ip:port`
- Python requests: `proxies={'http': 'http://user:pass@ip:port'}`
