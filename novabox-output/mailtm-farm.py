"""Blackbox.ai registration with mail.tm (real domain, not blocked)."""
import asyncio, os, sys, time, re, secrets

os.environ['PLAYWRIGHT_BROWSERS_PATH'] = os.path.expanduser('~/.cache/ms-playwright')

from config import Config
from providers.blackbox import BlackboxClient
from providers.mailtm import create_account, wait_for_otp

async def register_with_mailtm():
    cfg = Config(headless=True, max_workers=1, verify_poll_timeout=120, request_timeout=30)
    
    # Create mail.tm account first
    print("[0] Creating mail.tm account...")
    mail_account = await create_account()
    email = mail_account["email"]
    password = "BlackboxFarm2026!@#"
    
    print(f"  Email: {email}")
    print(f"  Password: {password}")
    print(f"  Token: {mail_account['token'][:30]}...")
    
    client = BlackboxClient(cfg)
    await client.start()
    page = client.page
    
    try:
        # Step 1: Signup
        print("\n[1] Opening signup page...")
        await page.goto(f"{cfg.blackbox_url}/signup", wait_until="domcontentloaded")
        await asyncio.sleep(3)
        print(f"  URL: {page.url}")
        
        # Fill form
        print("\n[2] Filling signup form...")
        email_input = page.locator('input[type="email"], input[name="email"]').first
        await email_input.wait_for(state="visible", timeout=15000)
        await email_input.fill(email)
        print(f"  ✅ Email")
        
        pass_input = page.locator('input[type="password"], input[name="password"]').first
        await pass_input.wait_for(state="visible", timeout=5000)
        await pass_input.fill(password)
        print(f"  ✅ Password")
        
        # Submit
        print("\n[3] Submitting...")
        submit = page.locator('button[type="submit"]').first
        await submit.click()
        
        # Wait for OTP screen
        await asyncio.sleep(5)
        print(f"  URL: {page.url}")
        body = await page.inner_text("body")
        print(f"  Body: {body[:200]}")
        
        # Check for OTP input
        otp_input = page.locator('input[maxlength="6"], input[placeholder*="code" i], input[name="code"], input[inputmode="numeric"]')
        otp_count = await otp_input.count()
        print(f"  OTP inputs: {otp_count}")
        
        if otp_count > 0:
            # Wait for OTP
            print("\n[4] Waiting for OTP via mail.tm...")
            try:
                code = await wait_for_otp(mail_account["token"], timeout=120)
                print(f"  ✅ OTP: {code}")
                
                # Enter OTP
                await otp_input.first.fill(code)
                print(f"  ✅ OTP entered")
                
                # Click Verify
                verify_btn = page.locator('button:has-text("Verify")').first
                await verify_btn.click()
                print(f"  ✅ Verify clicked")
                
                # Wait for redirect
                for i in range(20):
                    await asyncio.sleep(2)
                    url = page.url
                    print(f"  [{i}] {url}")
                    if '/activity' in url or '/dashboard' in url:
                        print(f"  ✅ LOGGED IN!")
                        break
                
                await page.screenshot(path="mailtm-logged-in.png")
                
                # Create API key
                print("\n[5] Creating API key...")
                await page.goto(f"{cfg.blackbox_url}/keys", wait_until="domcontentloaded")
                await asyncio.sleep(3)
                
                create_btn = page.locator('button:has-text("CREATE KEY")').first
                if await create_btn.count() > 0:
                    await create_btn.click()
                    await asyncio.sleep(3)
                    
                    name_input = page.locator('input[placeholder*="Production"], input[placeholder*="Key name"], input[placeholder*="e.g."]').first
                    if await name_input.count() > 0:
                        await name_input.fill("auto-farm-key")
                        
                        await page.wait_for_function(
                            """() => {
                                const btns = [...document.querySelectorAll('button')];
                                return btns.some(b => /create api key/i.test(b.textContent || '') && !b.disabled);
                            }""",
                            timeout=10000,
                        )
                        confirm = page.locator('button:has-text("CREATE API KEY"), button:has-text("Create API Key")').first
                        await confirm.click()
                        print("  ✅ Key creation confirmed")
                        await asyncio.sleep(5)
                        
                        body = await page.inner_text("body")
                        match = re.search(r"sk-[A-Za-z0-9_-]{12,}", body)
                        if match:
                            api_key = match.group(0)
                            print(f"\n{'='*60}")
                            print(f"  ✅ API KEY: {api_key}")
                            print(f"{'='*60}")
                            
                            # Save
                            os.makedirs("output", exist_ok=True)
                            with open("output/keys.txt", "a") as f:
                                f.write(f"{email}|{password}|{api_key}\n")
                            print(f"  Saved to output/keys.txt")
                        else:
                            print("  ⚠️ No sk- key found")
                            await page.screenshot(path="mailtm-key-result.png")
                            print(f"  Page text: {body[:500]}")
                
            except Exception as e:
                print(f"  ❌ Error: {e}")
                await page.screenshot(path="mailtm-error.png")
        else:
            print("  ❌ No OTP input — signup failed")
            await page.screenshot(path="mailtm-signup-failed.png")
    
    finally:
        await client.stop()
    
    print("\n[DONE]")

asyncio.run(register_with_mailtm())
