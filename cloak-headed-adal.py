"""
AdaL Sign-up using CloakBrowser in HEADED mode (via Xvfb)
The Turnstile checkbox needs a real display to render and be clickable
"""
from cloakbrowser import launch
import time, os

os.environ['DISPLAY'] = ':99'

def main():
    print("[1] Launching CloakBrowser HEADED (Xvfb :99)...")
    browser = launch(headless=False)  # HEADED mode!
    
    page = browser.new_page()
    page.set_viewport_size({"width": 1280, "height": 900})
    
    try:
        print("[2] Opening adal.sylph.ai/sign-up...")
        page.goto("https://adal.sylph.ai/sign-up", wait_until="domcontentloaded", timeout=30000)
        time.sleep(5)
        
        print(f"  URL: {page.url}")
        body = page.inner_text("body")
        print(f"  Body: {body[:200]}")
        
        # Enter email
        email_input = page.query_selector("#identifier-field") or page.query_selector('input[name="identifier"]') or page.query_selector('input[type="text"]')
        if email_input:
            print("\n[3] Entering email...")
            email_input.click(click_count=3)
            email_input.type("respati1@bozztirex.us", delay=80)
            time.sleep(1)
            print("  ✅ Email entered")
        
        # Find and click Turnstile checkbox
        print("\n[4] Looking for Turnstile iframe...")
        iframes = page.query_selector_all("iframe")
        print(f"  Found {len(iframes)} iframes")
        
        turnstile_iframe = None
        for iframe in iframes:
            src = iframe.get_attribute("src") or ""
            if "turnstile" in src or "challenges.cloudflare" in src:
                turnstile_iframe = iframe
                print(f"  ✅ Turnstile iframe: {src[:80]}")
        
        if turnstile_iframe:
            box = turnstile_iframe.bounding_box()
            print(f"  Box: {box}")
            
            # Click the checkbox (left side)
            click_x = box["x"] + 30
            click_y = box["y"] + box["height"] / 2
            print(f"  Clicking at ({click_x}, {click_y})...")
            page.mouse.click(click_x, click_y)
            print("  Clicked!")
            
            # Wait for verification
            print("\n[5] Waiting for Turnstile verification...")
            for i in range(30):
                time.sleep(2)
                token = page.evaluate('() => { const inp = document.querySelector(\'input[name="cf-turnstile-response"]\'); return inp ? inp.value : ""; }')
                if token and len(token) > 10:
                    print(f"  ✅ Token after {i*2}s! ({token[:50]}...)")
                    break
                
                body_text = page.inner_text("body")
                if "complete the verification" not in body_text.lower() and "verify you are human" not in body_text.lower():
                    print(f"  ✅ Verification passed after {i*2}s!")
                    break
                
                # Try clicking again if still showing checkbox
                if i % 5 == 4:
                    print(f"  Retrying click at ({click_x}, {click_y})...")
                    page.mouse.click(click_x, click_y)
                
                print(f"  Waiting... ({i*2}s)")
        
        page.screenshot(path="cloak-headed-step1.png")
        
        # Click Continue
        print("\n[6] Clicking Continue...")
        continue_btn = page.query_selector('button:has-text("Continue")')
        if continue_btn:
            continue_btn.click()
            time.sleep(5)
            print(f"  URL: {page.url}")
            body = page.inner_text("body")
            print(f"  Body: {body[:300]}")
            
            # Password
            pwd = page.query_selector('input[type="password"]')
            if pwd:
                print("\n[7] Password field!")
                pwd.click(click_count=3)
                pwd.type("Daffa112233", delay=80)
                time.sleep(0.5)
                pwd_fields = page.query_selector_all('input[type="password"]')
                if len(pwd_fields) > 1:
                    pwd_fields[1].click(click_count=3)
                    pwd_fields[1].type("Daffa112233", delay=80)
                
                btn = page.query_selector('button:has-text("Continue")') or page.query_selector('button:has-text("Sign")')
                if btn:
                    btn.click()
                    time.sleep(8)
                    print(f"  URL: {page.url}")
            
            code = page.query_selector('input[type="tel"]') or page.query_selector('input[inputmode="numeric"]')
            if code:
                print("\n[7] ⚠️ Email verification code required!")
        
        page.screenshot(path="cloak-headed-final.png")
        print(f"\n[Final URL]: {page.url}")
        
        cookies = page.context.cookies()
        auth_cookies = [c for c in cookies if any(d in c.get('domain', '') for d in ['adal', 'clerk', 'sylph'])]
        print(f"[Cookies]: {len(auth_cookies)}")
        for c in auth_cookies:
            print(f"  {c['domain']} | {c['name']} = {c['value'][:50]}")
        
    except Exception as e:
        print(f"[Error]: {e}")
        page.screenshot(path="cloak-headed-error.png")
    
    browser.close()
    print("\n[DONE]")

main()
