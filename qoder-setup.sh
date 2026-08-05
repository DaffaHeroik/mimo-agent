#!/usr/bin/env bash
# ============================================================
# Qoder × Qwen3.8-Max — 800 Free Calls Auto-Setup Script
# Promo: 3 Aug – 3 Sep 2026 | Model: Qwen3.8-Max (2.4T params)
# ============================================================

set -euo pipefail

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# --- Helpers ---
info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; }
step()  { echo -e "\n${BOLD}━━━ Step $1: $2 ━━━${NC}"; }

QODER_BIN="$HOME/.local/bin/qodercli"

# ============================================================
step "1" "Checking Qoder CLI Installation"
# ============================================================

if command -v qodercli &>/dev/null; then
    CURRENT_VER=$(qodercli --version 2>/dev/null || echo "unknown")
    ok "Qoder CLI already installed: $CURRENT_VER"
else
    info "Qoder CLI not found. Installing..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        curl -fsSL https://qoder.com/install | bash
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -fsSL https://qoder.com/install | bash
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
        err "Windows detected. Please run in PowerShell:"
        echo '  irm https://qoder.com/install.ps1 | iex'
        exit 1
    else
        err "Unsupported OS: $OSTYPE"
        exit 1
    fi
    
    if command -v qodercli &>/dev/null; then
        ok "Qoder CLI installed successfully!"
    else
        # Try adding to PATH
        export PATH="$HOME/.local/bin:$HOME/.qoder/bin/qodercli:$PATH"
        if command -v qodercli &>/dev/null; then
            ok "Qoder CLI installed (PATH updated)"
        else
            err "Installation may have succeeded but qodercli not in PATH."
            warn "Try: export PATH=\"\$HOME/.local/bin:\$PATH\""
            warn "Or restart your terminal."
        fi
    fi
fi

# ============================================================
step "2" "Checking Login Status"
# ============================================================

export PATH="$HOME/.local/bin:$HOME/.qoder/bin/qodercli:$PATH"

LOGIN_STATUS=$(qodercli status 2>&1 || true)

if echo "$LOGIN_STATUS" | grep -qi "not logged in\|unauthorized\|not authenticated"; then
    warn "Not logged in to Qoder."
    echo ""
    echo -e "  ${BOLD}Please login:${NC}"
    echo -e "    1. Run: ${CYAN}qodercli login${NC}"
    echo -e "    2. Browser will open — sign in with your account"
    echo -e "    3. If no account yet, register at: ${CYAN}https://qoder.com/users/sign-up${NC}"
    echo ""
    
    read -p "$(echo -e "${YELLOW}Have you already logged in? (y/n): ${NC}")" LOGGED_IN
    
    if [[ "$LOGGED_IN" != "y" && "$LOGGED_IN" != "Y" ]]; then
        info "Opening login..."
        qodercli login &
        LOGIN_PID=$!
        
        echo ""
        info "Waiting for browser login (timeout: 120s)..."
        info "Complete the login in your browser, then press Enter here."
        read -p ""
        
        # Re-check
        LOGIN_STATUS=$(qodercli status 2>&1 || true)
        if echo "$LOGIN_STATUS" | grep -qi "not logged in\|unauthorized"; then
            err "Still not logged in. Please run 'qodercli login' manually."
            exit 1
        fi
    fi
fi

ok "Logged in to Qoder!"

# ============================================================
step "3" "Listing Available Models"
# ============================================================

info "Fetching available models..."
MODELS=$(qodercli --list-models 2>&1 || true)

echo ""
echo "$MODELS"
echo ""

if echo "$MODELS" | grep -qi "qwen.*3.8.*max\|qwen3.8-max\|Qwen3.8-Max"; then
    ok "Qwen3.8-Max is available in your account!"
else
    warn "Qwen3.8-Max not found in model list."
    warn "It may require claiming the free calls first (Step 4)."
    warn "Or the model may not be available in your region yet."
fi

# ============================================================
step "4" "Checking Event / Promo Status"
# ============================================================

info "Checking current date against promo window..."

NOW_EPOCH=$(date +%s)
PROMO_START=$(date -d "2026-08-03 10:00:00 +0800" +%s 2>/dev/null || date -j -f "%Y-%m-%d %H:%M:%S" "2026-08-03 10:00:00" +%s 2>/dev/null || echo "0")
PROMO_END=$(date -d "2026-09-03 23:59:59 +0800" +%s 2>/dev/null || date -j -f "%Y-%m-%d %H:%M:%S" "2026-09-03 23:59:59" +%s 2>/dev/null || echo "9999999999")

if [[ "$NOW_EPOCH" -ge "$PROMO_START" && "$NOW_EPOCH" -le "$PROMO_END" ]]; then
    DAYS_LEFT=$(( (PROMO_END - NOW_EPOCH) / 86400 ))
    ok "Promo is ACTIVE! ${DAYS_LEFT} days remaining."
else
    if [[ "$NOW_EPOCH" -lt "$PROMO_START" ]]; then
        warn "Promo hasn't started yet. Starts: 3 Aug 2026 10:00 UTC+8"
    else
        err "Promo has ended. Ended: 3 Sep 2026 23:59 UTC+8"
    fi
fi

# ============================================================
step "5" "Claiming 800 Free Calls"
# ============================================================

echo ""
echo -e "${BOLD}To claim your 800 free calls:${NC}"
echo ""
echo -e "  ${CYAN}Option A — Qoder Desktop:${NC}"
echo "    1. Open Qoder Desktop app"
echo "    2. Go to Settings → Usage (or sidebar)"
echo "    3. Find 'Event Claims' / 'Anniversary Promotion'"
echo "    4. Click 'Claim' on the 800 calls offer"
echo ""
echo -e "  ${CYAN}Option B — Qoder CLI:${NC}"
echo "    1. Run: qodercli"
echo "    2. In interactive mode, check Usage/Status panel"
echo "    3. Look for claim option"
echo ""
echo -e "  ${CYAN}Option C — JetBrains Plugin:${NC}"
echo "    1. Open IDE with Qoder plugin"
echo "    2. Find Usage panel in plugin settings"
echo "    3. Claim from there"
echo ""

read -p "$(echo -e "${YELLOW}Press Enter after you've claimed (or 's' to skip): ${NC}")" CLAIMED

if [[ "$CLAIMED" != "s" && "$CLAIMED" != "S" ]]; then
    ok "Great! Hopefully claimed successfully."
else
    info "Skipped. Don't forget to claim before 3 Sep 2026!"
fi

# ============================================================
step "6" "Quick Test — Qwen3.8-Max"
# ============================================================

echo ""
read -p "$(echo -e "${YELLOW}Want to test Qwen3.8-Max now? (y/n): ${NC}")" DO_TEST

if [[ "$DO_TEST" == "y" || "$DO_TEST" == "Y" ]]; then
    info "Sending test prompt to Qwen3.8-Max..."
    echo ""
    echo -e "${CYAN}--- Qwen3.8-Max Response ---${NC}"
    
    qodercli -p -m "qwen3.8-max" "Hello! Reply with just: Qwen3.8-Max is working! 🎉" 2>&1 || {
        warn "Test failed. Possible reasons:"
        echo "  - Model name might be different (check --list-models)"
        echo "  - Free calls not yet claimed"
        echo "  - Network issue"
    }
    
    echo -e "${CYAN}--- End ---${NC}"
else
    info "Skipping test."
fi

# ============================================================
# Summary
# ============================================================

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  Setup Complete! 🎉${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BOLD}What you got:${NC}"
echo -e "    🎁 800 free calls to Qwen3.8-Max"
echo -e "    📅 Valid until: 30 September 2026"
echo -e "    💡 Off-peak (10pm-8am): 50% off Credits"
echo ""
echo -e "  ${BOLD}Want more?${NC}"
echo -e "    💰 Buy a plan (Pro/Pro+/Ultra) during event"
echo -e "    🎁 Get extra 2,000 calls (stackable!)"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo -e "    ${CYAN}qodercli${NC}                       Start interactive mode"
echo -e "    ${CYAN}qodercli -m qwen3.8-max${NC}       Use Qwen3.8-Max"
echo -e "    ${CYAN}qodercli --list-models${NC}         List all models"
echo -e "    ${CYAN}qodercli status${NC}                Check account status"
echo ""
echo -e "  ${BOLD}Docs:${NC} https://docs.qoder.com/events/qwen-max"
echo -e "  ${BOLD}Download:${NC} https://qoder.com/download"
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
