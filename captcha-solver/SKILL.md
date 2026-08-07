# SKILL.md — Captcha Solver

## Apa Ini?
Local captcha-solving HTTP sidecar. Solve captcha secara lokal tanpa bayar provider eksternal.

## Supported Types (11)
- **Turnstile** — Cloudflare widget
- **reCAPTCHA** — v2 / v3 / invisible / Enterprise
- **hCaptcha** — checkbox / invisible / real-page
- **Cloudflare** — `cf_clearance` cookie
- **AWS WAF** — `aws-waf-token`
- **BotGuard** — Google OAuth `bgRequest`
- **DataDome** — `datadome` clearance cookie
- **PerimeterX** — `_px3` cookie
- **Akamai** — `_abck` cookie
- **Aliyun** — slide puzzle → `{certifyId, deviceToken, data}`
- **Arkose** — FunCaptcha visual puzzle → `fc_token`

## Setup

```bash
# Install dependencies
pip3 install --user fastapi uvicorn pydantic cloakbrowser pillow onnxruntime opencv-python-headless numpy

# Start server (port 8877)
cd captcha-solver
python3 server.py

# Atau via mimo-setup.js
node mimo-setup.js captcha
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| POST | `/solve` | Solve captcha |
| GET | `/status` | Service status |
| GET | `/docs` | Swagger UI |
| GET | `/logs` | Recent solve events |

## Usage (POST /solve)

```json
{
  "type": "turnstile",
  "sitekey": "0x4AAA...",
  "url": "https://target.com",
  "timeout_s": 60,
  "proxy": "http://user:pass@ip:port"
}
```

## Contoh Solve

```bash
# Turnstile
curl -X POST http://127.0.0.1:8877/solve \
  -H "Content-Type: application/json" \
  -d '{"type":"turnstile","sitekey":"0x4AAAAAAABnp1QeF6Mg","url":"https://example.com"}'

# reCAPTCHA v2
curl -X POST http://127.0.0.1:8877/solve \
  -H "Content-Type: application/json" \
  -d '{"type":"recaptcha","version":"v2","sitekey":"6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-","url":"https://example.com"}'

# hCaptcha
curl -X POST http://127.0.0.1:8877/solve \
  -H "Content-Type: application/json" \
  -d '{"type":"hcaptcha","sitekey":"10000000-ffff-ffff-ffff-000000000001","url":"https://example.com"}'
```

## Environment Variables

| Variable | Default | Effect |
|----------|---------|--------|
| `PORT` | `8877` | Listen port |
| `BROWSER_HEADLESS` | per-solver | `0` = headed (recommended under Xvfb) |
| `TURNSTILE_GEOIP` | unset | `1` = align browser to proxy exit IP |
| `SOLVER_ALLOW_PRIVATE` | unset | `1` = allow private/loopback targets |

## Troubleshooting

- **Server won't start**: Check `pip3 install` deps, make sure Xvfb running
- **Solve timeout**: Try with proxy, increase `timeout_s`
- **Detection**: Use `BROWSER_HEADLESS=0` (headed mode under Xvfb)
- **Port conflict**: Change `PORT` env var

## Architecture

```
client → HTTP → server.py (FastAPI, :8877)
                  │ dispatch by `type`
                  ├── turnstile/solve.py
                  ├── recaptcha/solve.py
                  ├── hcaptcha/solve.py
                  ├── cloudflare/solve.py
                  ├── awswaf/solve.py
                  ├── botguard/solve.py
                  ├── datadome/solve.py
                  ├── perimeterx/solve.py
                  ├── akamai/solve.py
                  ├── aliyun/solve.py
                  └── arkose/solve.py
```

Each solver uses **CloakBrowser** (anti-detect Chromium) to solve natively in a real browser.
