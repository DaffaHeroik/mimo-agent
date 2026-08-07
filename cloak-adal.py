"""
AdaL Sign-up using CloakBrowser (anti-detect Chromium)
Uses sync API since CloakBrowser wraps Playwright sync
"""
from cloakbrowser import launch
import time

def main():
    print("[1] Launching CloakBrowser (anti-detect mode)...")
    browser = launch(headless=True)
    
    page = browser.new_page()
    page.set_viewport_size({"width": 1280, "height": 900})
    
    try:
        print("[2] Opening adal.sylph.ai/sign-up...")
        page.goto("https://adal.sylph.ai/sign-up", wait_until="domcontentloaded", timeout=30000)
        time.sleep(3)
        
        print(f"  URL: {page.url}")
        body = page.inner_text("body")
        print(f"  Body: {body[:200]}")
        
        # Check for Turnstile
        turnstile = page.query_selector(".turnstile-container")
        print(f"  Turnstile: {'Found' if turnstile else 'Not found'}")
        
        # Enter email
        email_input = page.query_selector("#identifier-field") or page.query_selector('input[name="identifier"]') or page.query_selector('input[type="text"]')
        if email_input:
            print("\n[3] Entering email...")
            email_input.click(click_count=3)
            email_input.type("respati1@bozztirex.us", delay=80)
            time.sleep(1)
            print("  ✅ Email entered")
        
        # Wait for Turnstile to auto-solve
        print("\n[4] Waiting for Turnstile auto-verification...")
        for i in range(20):
            time.sleep(2)
            token = page.evaluate('() => { const inp = document.querySelector(\'input[name="cf-turnstile-response"]\'); return inp ? inp.value : ""; }')
            if token and len(token) > 10:
                print(f"  ✅ Token after {i*2}s! ({token[:50]}...)")
                break
            body_text = page.inner_text("body")
            if "complete the verification" not in body_text.lower():
                print(f"  ✅ Verification passed after {i*2}s!")
                break
            print(f"  Waiting... ({i*2}s)")
        
        page.screenshot(path="cloak-adal-step1.png")
        
        # Click Continue
        print("\n[5] Clicking Continue...")
        continue_btn = page.query_selector('button:has-text("Continue")')
        if continue_btn:
            continue_btn.click()
            time.sleep(5)
            print(f"  URL: {page.url}")
            body = page.inner_text("body")
            print(f"  Body: {body[:300]}")
            
            # Password field
            pwd = page.query_selector('input[type="password"]')
            if pwd:
                print("\n[6] Password field found!")
                pwd.click(click_count=3)
                pwd.type("Daffa112233", delay=80)
                time.sleep(0.5)
                pwd_fields = page.query_selector_all('input[type="password"]')
                if len(pwd_fields) > 1:
                    pwd_fields[1].click(click_count=3)
                    pwd_fields[1].type("Daffa112233", delay=80)
                
                signup_btn = page.query_selector('button:has-text("Continue")') or page.query_selector('button:has-text("Sign")')
                if signup_btn:
                    signup_btn.click()
                    time.sleep(8)
                    print(f"  URL: {page.url}")
            
            code_input = page.query_selector('input[type="tel"]') or page.query_selector('input[inputmode="numeric"]')
            if code_input:
                print("\n[6] ⚠️ Email verification code required!")
        
        page.screenshot(path="cloak-adal-final.png")
        print(f"\n[Final URL]: {page.url}")
        
        cookies = page.context.cookies()
        auth_cookies = [c for c in cookies if 'adal' in c.get('domain', '') or 'clerk' in c.get('domain', '') or 'sylph' in c.get('domain', '')]
        print(f"[Cookies]: {len(auth_cookies)}")
        for c in auth_cookies:
            print(f"  {c['domain']} | {c['name']} = {c['value'][:50]}")
        
    except Exception as e:
        print(f"[Error]: {e}")
        page.screenshot(path="cloak-adal-error.png")
    
    browser.close()
    print("\n[DONE]")

main()
