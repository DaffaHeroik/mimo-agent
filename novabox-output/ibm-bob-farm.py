"""IBM Bob registration with ikona-oni.com TempMail (.my.id domains)."""
import asyncio, os, re, time, secrets, httpx

os.environ['PLAYWRIGHT_BROWSERS_PATH'] = os.path.expanduser('~/.cache/ms-playwright')

API_BASE = "https://tempmail-worker.hasildia1.workers.dev"

DOMAINS = [
    "merapi92338.my.id", "merbabu2771.my.id", "andong32784.my.id",
    "telomoyo74712.my.id", "rinjani93929.my.id", "ranukumbolo238.my.id",
    "ungaran12342.my.id", "segaraank23342.my.id", "tumpukan42765.my.id",
    "sembarang236.my.id", "damaikan.my.id", "sujokin.my.id", "sukijon.my.id",
    "sutmo.my.id",
]

def gen_email():
    prefix = secrets.token_hex(6)
    domain = secrets.choice(DOMAINS)
    return f"{prefix}@{domain}"

async def check_inbox(email, timeout=120, poll=3):
    """Poll TempMail API for incoming emails."""
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
                    
                    # Get full email
                    resp2 = await client.get(f"{API_BASE}/view/{em_id}")
                    body = resp2.text
                    
                    # Extract OTP
                    match = otp_pattern.search(body)
                    if match:
                        return match.group(1)
        except Exception as e:
            print(f"  Inbox error: {e}")
        
        await asyncio.sleep(poll)
    
    return None

async def register_ibm_bob():
    from playwright.async_api import async_playwright
    
    email = gen_email()
    password = "IbmBob2026!@#"
    print(f"[0] Email: {email}")
    
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = await browser.new_page()
    await page.set_viewport_size({"width": 1280, "height": 900})
    
    try:
        print("[1] Opening trial page...")
        await page.goto("https://bob.ibm.com/trial", wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(5)
        
        # Select country FIRST
        print("[2] Selecting country...")
        await page.select_option('#country', value='MY')
        await page.locator('#country').evaluate('e => {e.dispatchEvent(new Event("change",{bubbles:true}))}')
        await asyncio.sleep(1)
        print("  ✅ Malaysia")
        
        # Fill fields with Playwright fill + React events
        print("[3] Filling form...")
        for fid, val in [('email', email), ('password', password), ('firstName', 'Respati'), ('lastName', 'Iswahyudi')]:
            el = page.locator(f'#{fid}')
            await el.click(click_count=3)
            await el.fill(val)
            await el.evaluate('e => {e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));e.dispatchEvent(new Event("blur",{bubbles:true}))}')
            await asyncio.sleep(0.3)
        print("  ✅ All fields")
        
        # Verify
        vals = await page.evaluate('()=>({e:document.getElementById("email")?.value,c:document.querySelector("#country")?.value})')
        print(f"  Verify: {vals}")
        
        # Click Next
        print("[4] Clicking Next...")
        await page.locator('button:has-text("Next")').click()
        await asyncio.sleep(8)
        
        # Check if code was sent
        body = await page.inner_text("body")
        if "7 digit code" in body.lower() or "emailed" in body.lower():
            print("  ✅ Code sent!")
        else:
            print(f"  Body: {body[:200]}")
            await page.screenshot(path="ibm-no-code.png")
        
        # Wait for OTP via TempMail
        print("[5] Waiting for OTP...")
        code = await check_inbox(email, timeout=120)
        
        if code:
            print(f"  ✅ OTP: {code}")
            
            # Enter code
            print("[6] Entering code...")
            # Find the code input (might be in accordion)
            code_input = page.locator('input[type="tel"], input[inputmode="numeric"], input[maxlength="7"], input[maxlength="6"]')
            
            if await code_input.count() == 0:
                # Try to open accordion
                await page.locator('text=Verify email').click()
                await asyncio.sleep(2)
            
            if await code_input.count() > 0:
                await code_input.first.fill(code)
                print("  ✅ Code entered")
                
                # Click Submit
                submit = page.locator('button:has-text("Submit")')
                await asyncio.sleep(1)
                disabled = await submit.evaluate('b => b.disabled')
                print(f"  Submit disabled: {disabled}")
                
                if not disabled:
                    await submit.click()
                    await asyncio.sleep(10)
                    print(f"  URL: {page.url}")
                    body = await page.inner_text("body")
                    print(f"  Body: {body[:300]}")
                    await page.screenshot(path="ibm-success.png")
                    
                    if "bob.ibm.com" in page.url and "trial" not in page.url:
                        print("\n✅ IBM BOB REGISTERED!")
                        os.makedirs("output", exist_ok=True)
                        with open("output/ibm-bob.txt", "a") as f:
                            f.write(f"{email}|{password}|IBM Bob 40 Bobcoins\n")
                        print(f"  Saved!")
                        return True
                    elif "bobcoins" in body.lower() or "dashboard" in body.lower():
                        print("\n✅ IBM BOB TRIAL ACTIVATED!")
                        return True
                else:
                    # Force enable
                    await page.evaluate('()=>{const b=document.querySelector("button[type=submit]:disabled");if(b){b.disabled=false;b.classList.remove("cds--btn--disabled")}}')
                    await submit.click()
                    await asyncio.sleep(10)
                    print(f"  URL: {page.url}")
            else:
                print("  ❌ No code input found")
                # List all inputs
                inputs = await page.evaluate('()=>Array.from(document.querySelectorAll("input")).map(i=>({t:i.type,id:i.id,v:i.offsetParent!==null}))')
                print(f"  Inputs: {inputs}")
        else:
            print("  ❌ No OTP received")
            await page.screenshot(path="ibm-no-otp.png")
        
        print(f"\n[Final] URL: {page.url}")
        
    except Exception as e:
        print(f"\n[Error]: {e}")
        await page.screenshot(path="ibm-error.png")
    finally:
        await browser.close()
        await pw.stop()
    
    print("[DONE]")
    return False

if __name__ == "__main__":
    success = asyncio.run(register_ibm_bob())
    print(f"\nResult: {'SUCCESS' if success else 'FAILED'}")
