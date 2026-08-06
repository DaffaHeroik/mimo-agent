# Claim 800 Free Calls — Qwen3.8-Max

## Promo Info
- **800 free calls** for new/existing users
- **Valid:** Aug 3 - Sep 3, 2026
- **Model:** Qwen3.8-Max (2.4T parameters)
- **800 calls ≈ 80 tasks**

## How to Claim

### Option A: Qoder Desktop on Server (Xvfb)
```bash
# 1. Start Xvfb
Xvfb :99 -screen 0 1920x1080x24 &

# 2. Launch Qoder Desktop
export DISPLAY=:99
export LD_LIBRARY_PATH=/tmp/gtk3/usr/lib/x86_64-linux-gnu:/tmp/deps/usr/lib/x86_64-linux-gnu:/tmp/qoder-desktop/usr/share/qoder
/tmp/qoder-desktop/usr/share/qoder/qoder --no-sandbox --disable-gpu

# 3. In the app UI:
#    - Click "Sign in" → Google OAuth
#    - Login with respati1@bozztirex.us
#    - Open Usage panel (Ctrl+Shift+P → "usage")
#    - Click "Claim Now" button
```

### Option B: Local Machine (Recommended)
1. Download: https://qoder.com/download
2. Install Qoder Desktop
3. Login with `respati1@bozztirex.us`
4. Open **Usage** panel
5. Click **"Claim Now"**

### Option C: QoderWake
```bash
curl -fsSL https://download.qoder.com/qoderwake/install.sh | bash
qoderwake login
# Then use qoderwake UI to claim
```

## After Claiming
- Free calls work on **all platforms** (CLI, Desktop, JetBrains, Web)
- Use with CLI: `qodercli -m Qwen3.8-Max -p "your prompt"`
- Off-peak hours (10pm-8am): 50% discount

## Troubleshooting
- "Credit usage limit" → Claim not done yet
- "Account not eligible" → Already claimed or promo ended
- CLI shows 0 credits → Claim via Desktop app first
