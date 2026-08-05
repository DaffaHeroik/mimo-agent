#!/usr/bin/env bash
# ============================================================
# Qoder Auto-Login + Claim Script
# Prints login link, waits for auth, then checks promo status
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

export PATH="$HOME/.local/bin:$HOME/.qoder/bin/qodercli:$PATH"

# --- Check CLI installed ---
if ! command -v qodercli &>/dev/null; then
    echo -e "${RED}[✗]${NC} Qoder CLI not found. Installing..."
    curl -fsSL https://qoder.com/install | bash
    export PATH="$HOME/.local/bin:$HOME/.qoder/bin/qodercli:$PATH"
fi

echo -e "${GREEN}[✓]${NC} Qoder CLI found: $(qodercli --version 2>/dev/null)"

# --- Check if already logged in ---
STATUS=$(qodercli status 2>&1 || true)
if ! echo "$STATUS" | grep -qi "not logged in\|unauthorized"; then
    echo -e "${GREEN}[✓]${NC} Already logged in!"
    echo ""
    echo "$STATUS"
    echo ""
    exit 0
fi

# --- Start login in background, capture output ---
echo -e "${CYAN}[INFO]${NC} Starting login flow..."
echo ""

TMPFILE=$(mktemp)
qodercli login > "$TMPFILE" 2>&1 &
LOGIN_PID=$!

# Wait for URL to appear
for i in $(seq 1 20); do
    sleep 0.5
    if grep -q "https://qoder.com" "$TMPFILE" 2>/dev/null; then
        break
    fi
done

# Extract URL
LOGIN_URL=$(grep -oP 'https://qoder\.com/[^\s]+' "$TMPFILE" 2>/dev/null | head -1)

if [[ -z "$LOGIN_URL" ]]; then
    echo -e "${RED}[✗]${NC} Failed to get login URL. Output:"
    cat "$TMPFILE"
    kill $LOGIN_PID 2>/dev/null || true
    rm -f "$TMPFILE"
    exit 1
fi

# --- Print login link nicely ---
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  🔐 Qoder Login — Buka Link Ni!${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${CYAN}${LOGIN_URL}${NC}"
echo ""
echo -e "  ${DIM}Buka link atas dalam browser, sign in,${NC}"
echo -e "  ${DIM}then script ni akan detect automatik.${NC}"
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# --- Wait for login to complete ---
echo -ne "${YELLOW}[⏳]${NC} Waiting for authorization"
SPIN='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
while kill -0 $LOGIN_PID 2>/dev/null; do
    for char in $(echo $SPIN | fold -w1); do
        echo -ne "\r${YELLOW}[${char}]${NC} Waiting for authorization... "
        sleep 0.1
        if ! kill -0 $LOGIN_PID 2>/dev/null; then
            break 2
        fi
    done
done

wait $LOGIN_PID 2>/dev/null
EXIT_CODE=$?

echo -e "\r"

rm -f "$TMPFILE"

# --- Check result ---
if [[ $EXIT_CODE -eq 0 ]]; then
    echo -e "${GREEN}${BOLD}  ✅ Login Successful!${NC}"
    echo ""
    
    # Show account info
    echo -e "${CYAN}[INFO]${NC} Account status:"
    qodercli status 2>&1 || true
    echo ""
    
    # Check promo
    echo -e "${CYAN}[INFO]${NC} Checking promo..."
    NOW=$(date +%s)
    END=$(date -d "2026-09-03 23:59:59 +0800" +%s 2>/dev/null || echo 9999999999)
    DAYS_LEFT=$(( (END - NOW) / 86400 ))
    echo -e "${GREEN}[✓]${NC} Qwen3.8-Max promo: ${BOLD}${DAYS_LEFT} days left${NC}"
    echo ""
    
    # List models
    echo -e "${CYAN}[INFO]${NC} Available models:"
    qodercli --list-models 2>&1 | head -20 || true
    echo ""
    
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}  🎉 Next: Claim 800 Free Calls!${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  Buka Qoder Desktop / CLI / Plugin"
    echo -e "  Pergi ${CYAN}Usage${NC} panel → ${CYAN}Claim${NC} 800 calls"
    echo ""
    echo -e "  ${DIM}Docs: https://docs.qoder.com/events/qwen-max${NC}"
    echo ""
else
    echo -e "${RED}${BOLD}  ✗ Login Failed${NC}"
    echo -e "  Cuba manual: ${CYAN}qodercli login${NC}"
    exit 1
fi
