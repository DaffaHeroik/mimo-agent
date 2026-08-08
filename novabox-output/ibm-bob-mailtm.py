"""IBM Bob registration with mail.tm (emalupe.com domain)."""
import asyncio, os, re, time, secrets, httpx, json

os.environ['PLAYWRIGHT_BROWSERS_PATH'] = os.path.expanduser('~/.cache/ms-playwright')

MAILTM_API = "https://api.mail.tm"
DOMAIN = "emalupe.com"
PASSWORD = "MailTm2026!@#"

def gen_email():
    prefix = secrets.token_hex(6)
    return f"{prefix}@{DOMAIN}"

async def create_mailtm_account(email):
    """Create a mail.tm account."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{MAILTM_API}/accounts", json={
            "address": email,
            "password": PASSWORD
        })
        data = resp.json()
        if resp.status_code == 201:
            print(f"  ✅ mail.tm account created: {email}")
            # Get auth token
            resp2 = await client.post(f"{MAILTM_API}/token", json={
                "address": email,
                "password": PASSWORD
            })
            token_data = resp2.json()
            return token_data.get("token")
        else:
            print(f"  ❌ mail.tm create failed: {data}")
            return None

async def check_mailtm_inbox(token, timeout=120, poll=5):
    """Poll mail.tm inbox for incoming emails."""
    deadline = time.monotonic() + timeout
    otp_pattern = re.compile(r"\b(\d{6,7})\b")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    while time.monotonic() < deadline:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(f"{MAILTM_API}/messages", headers=headers)
                data = resp.json()
                messages = data.get("hydra:member", [])
                
                if messages:
                    msg = messages[0]
                    msg_id = msg.get("id")
                    
                    # Get full message
                    resp2 = await client.get(f"{MAILTM_API}/messages/{msg_id}", headers=headers)
                    msg_data = resp2.json()
                    body = msg_data.get("text", "") or msg_data.get("html", [""])[0]
                    
                    # Extract OTP
                    match = otp_pattern.search(body)
                    if match:
                        return match.group(1)
                    
                    # Also check subject
                    subject = msg.get("subject", "")
                    match2 = otp_pattern.search(subject)
                    if match2:
                        return match2.group(1)
        except Exception as e:
            print(f"  Inbox error: {e}")
        
        await asyncio.sleep(poll)
    
    return None

async def register_ibm_bob():
    from playwright.async_api import async_playwright
    
    email = gen_email()
    ibm_password = "IbmBob2026!@#"
    print(f"[0] Email: {email}")
    
    # Create mail.tm account first
    print("[0.5] Creating mail.tm account...")
    token = await create_mailtm_account(email)
    if not token:
        print("  ❌ Failed to create mail.tm account")
        return False
    
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = await browser.new_page()
    await page.set_viewport_size({"width": 1280, "height": 900})
    
    try:
        print("[1] Opening trial page...")
        await page.goto("https://bob.ibm.com/trial", wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(5)
        
        # Select country
        print("[2] Selecting country...")
        await page.select_option('#country', value='MY')
        await page.locator('#country').evaluate('e => {e.dispatchEvent(new Event("change",{bubbles:true}))}')
        await asyncio.sleep(1)
        print("  ✅ Malaysia")
        
        # Fill fields
        print("[3] Filling form...")
        for fid, val in [('email', email), ('password', ibm_password), ('firstName', 'Respati'), ('lastName', 'Iswahyudi')]:
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
            print(f"  Body snippet: {body[:200]}")
            await page.screenshot(path="ibm-no-code.png")
        
        # Wait for OTP via mail.tm
        print("[5] Waiting for OTP via mail.tm...")
        code = await check_mailtm_inbox(token, timeout=120)
        
        if code:
            print(f"  ✅ OTP: {code}")
            
            # Enter code
            print("[6] Entering code...")
            code_input = page.locator('input[type="tel"], input[inputmode="numeric"], input[maxlength="7"], input[maxlength="6"]')
            
            if await code_input.count() == 0:
                await page.locator('text=Verify email').click()
                await asyncio.sleep(2)
            
            if await code_input.count() > 0:
                await code_input.first.fill(code)
                print("  ✅ Code entered")
                
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
                            f.write(f"{email}|{ibm_password}|IBM Bob 40 Bobcoins\n")
                        return True
                    elif "bobcoins" in body.lower() or "dashboard" in body.lower():
                        print("\n✅ IBM BOB TRIAL ACTIVATED!")
                        return True
                else:
                    await page.evaluate('()=>{const b=document.querySelector("button[type=submit]:disabled");if(b){b.disabled=false;b.classList.remove("cds--btn--disabled")}}')
                    await submit.click()
                    await asyncio.sleep(10)
                    print(f"  URL: {page.url}")
            else:
                print("  ❌ No code input found")
                inputs = await page.evaluate('()=>Array.from(document.querySelectorAll("input")).map(i=>({t:i.type,id:i.id,v:i.offsetParent!==null}))')
                print(f"  Inputs: {inputs}")
        else:
            print("  ❌ No OTP received via mail.tm")
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
