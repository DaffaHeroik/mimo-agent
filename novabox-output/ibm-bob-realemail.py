"""IBM Bob registration with user's actual email."""
import asyncio, os, re, time, httpx

os.environ['PLAYWRIGHT_BROWSERS_PATH'] = os.path.expanduser('~/.cache/ms-playwright')

API_BASE = "https://tempmail-worker.hasildia1.workers.dev"

EMAIL = "uchita9@bozztirex.us"
PASSWORD = "IbmBob2026!@#"

async def check_inbox_ikona(email, timeout=120, poll=5):
    """Poll ikona-oni TempMail for incoming emails."""
    deadline = time.monotonic() + timeout
    otp_pattern = re.compile(r"\b(\d{6,7})\b")
    
    while time.monotonic() < deadline:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(f"{API_BASE}/inbox/{email}")
                data = resp.json()
                emails = data.get("data", {}).get("emails", [])
                
                for em in emails:
                    em_id = em.get("id") or em.get("_id")
                    if not em_id:
                        continue
                    
                    resp2 = await client.get(f"{API_BASE}/view/{em_id}")
                    body = resp2.text
                    
                    match = otp_pattern.search(body)
                    if match:
                        return match.group(1)
        except Exception as e:
            print(f"  Inbox error: {e}")
        
        await asyncio.sleep(poll)
    
    return None

async def register_ibm_bob():
    from playwright.async_api import async_playwright
    
    print(f"[0] Email: {EMAIL}")
    
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = await browser.new_page()
    await page.set_viewport_size({"width": 1280, "height": 900})
    
    try:
        print("[1] Opening trial page...")
        await page.goto("https://bob.ibm.com/trial", wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(5)
        
        # Take initial screenshot
        await page.screenshot(path="bob-real-step1.png")
        
        # Select country
        print("[2] Selecting country...")
        await page.select_option('#country', value='MY')
        await page.locator('#country').evaluate('e => {e.dispatchEvent(new Event("change",{bubbles:true}))}')
        await asyncio.sleep(1)
        print("  ✅ Malaysia")
        
        # Fill fields
        print("[3] Filling form...")
        for fid, val in [('email', EMAIL), ('password', PASSWORD), ('firstName', 'Respati'), ('lastName', 'Iswahyudi')]:
            el = page.locator(f'#{fid}')
            await el.click(click_count=3)
            await el.fill(val)
            await el.evaluate('e => {e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));e.dispatchEvent(new Event("blur",{bubbles:true}))}')
            await asyncio.sleep(0.3)
        print("  ✅ All fields")
        
        # Screenshot before submit
        await page.screenshot(path="bob-real-step2.png")
        
        # Verify
        vals = await page.evaluate('()=>({e:document.getElementById("email")?.value,c:document.querySelector("#country")?.value})')
        print(f"  Verify: {vals}")
        
        # Click Next
        print("[4] Clicking Next...")
        await page.locator('button:has-text("Next")').click()
        await asyncio.sleep(8)
        
        # Screenshot after Next
        await page.screenshot(path="bob-real-step3.png")
        
        # Check if code was sent
        body = await page.inner_text("body")
        if "7 digit code" in body.lower() or "emailed" in body.lower():
            print("  ✅ Code sent!")
        elif "already" in body.lower() or "exists" in body.lower():
            print(f"  ⚠️ Account might already exist: {body[:200]}")
            await page.screenshot(path="bob-real-exists.png")
        else:
            print(f"  Body snippet: {body[:300]}")
        
        # Note: We can't check inbox for this email since it's not a temp email
        # User needs to manually check their email for the OTP
        print("\n[5] ⚠️ OTP sent to real email - user needs to check manually")
        print(f"    Email: {EMAIL}")
        print("    Check inbox and provide the 7-digit code")
        
        # Save screenshot for user to see
        print(f"\n[Final] URL: {page.url}")
        print("[DONE] Waiting for user to provide OTP...")
        
    except Exception as e:
        print(f"\n[Error]: {e}")
        await page.screenshot(path="bob-real-error.png")
    finally:
        await browser.close()
        await pw.stop()

if __name__ == "__main__":
    asyncio.run(register_ibm_bob())
