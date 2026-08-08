"""IBM Bob registration with proxy to bypass IP block."""
import asyncio, os, re, time, secrets, httpx

os.environ['PLAYWRIGHT_BROWSERS_PATH'] = os.path.expanduser('~/.cache/ms-playwright')

MAILTM_API = "https://api.mail.tm"
PROXY = {"server": "http://163.181.207.213:9999"}

def gen_email():
    return f"{secrets.token_hex(6)}@emalupe.com"

async def create_mailtm(email, pw):
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(f"{MAILTM_API}/accounts", json={"address": email, "password": pw})
        if r.status_code == 201:
            r2 = await c.post(f"{MAILTM_API}/token", json={"address": email, "password": pw})
            return r2.json().get("token")
        return None

async def poll_otp(token, timeout=120, interval=5):
    deadline = time.monotonic() + timeout
    pat = re.compile(r"\b(\d{6,7})\b")
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=15) as c:
        while time.monotonic() < deadline:
            try:
                r = await c.get(f"{MAILTM_API}/messages", headers=headers)
                for m in r.json().get("hydra:member", []):
                    r2 = await c.get(f"{MAILTM_API}/messages/{m['id']}", headers=headers)
                    body = r2.json().get("text", "") or ""
                    match = pat.search(body)
                    if match:
                        return match.group(1)
            except Exception as e:
                print(f"  poll err: {e}")
            await asyncio.sleep(interval)
    return None

async def main():
    from playwright.async_api import async_playwright

    email = gen_email()
    mail_pw = secrets.token_urlsafe(12)
    ibm_pw = "SuperSecure2026!@#"
    print(f"Email: {email}")
    print(f"IBM PW: {ibm_pw}")

    # Create mail.tm
    print("[1] Creating mail.tm account...")
    token = await create_mailtm(email, mail_pw)
    if not token:
        print("❌ mail.tm failed"); return False
    print("  ✅ mail.tm ready")

    pw = await async_playwright().start()
    browser = await pw.chromium.launch(
        headless=True,
        args=['--no-sandbox', '--disable-dev-shm-usage'],
        proxy=PROXY
    )
    page = await browser.new_page()
    await page.set_viewport_size({"width": 1280, "height": 900})

    try:
        print("[2] Opening IBM Bob trial (via proxy)...")
        await page.goto("https://bob.ibm.com/trial", wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(5)
        await page.screenshot(path="bob-proxy-step1.png")

        # Country
        print("[3] Selecting Malaysia...")
        await page.select_option('#country', value='MY')
        await page.locator('#country').evaluate('e => e.dispatchEvent(new Event("change",{bubbles:true}))')
        await asyncio.sleep(1)

        # Fill form
        print("[4] Filling form...")
        fields = [
            ('email', email),
            ('password', ibm_pw),
            ('firstName', 'Respati'),
            ('lastName', 'Iswahyudi'),
        ]
        company_count = await page.locator('#company').count()
        if company_count > 0:
            fields.append(('company', 'Bozztirex Corp'))

        for fid, val in fields:
            el = page.locator(f'#{fid}')
            await el.click(click_count=3)
            await el.fill(val)
            await el.evaluate('e => {e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));e.dispatchEvent(new Event("blur",{bubbles:true}))}')
            await asyncio.sleep(0.3)
        print("  ✅ All fields filled")

        vals = await page.evaluate('() => ({e: document.getElementById("email")?.value, c: document.querySelector("#country")?.value, co: document.querySelector("#company")?.value})')
        print(f"  Verify: {vals}")

        # Click Next
        print("[5] Clicking Next...")
        await page.locator('button:has-text("Next")').click()
        await asyncio.sleep(10)
        await page.screenshot(path="bob-proxy-step2.png")

        body = await page.inner_text("body")
        errors = await page.evaluate('() => Array.from(document.querySelectorAll(".cds--form-requirement")).map(e => e.textContent.trim()).filter(Boolean)')
        print(f"  Errors: {errors}")

        if "7 digit code" in body.lower() or "verify" in body.lower():
            print("  ✅ Code sent!")
            
            # Wait for OTP
            print("[6] Waiting for OTP...")
            otp = await poll_otp(token, timeout=120)
            if otp:
                print(f"  ✅ OTP: {otp}")

                # Enter code
                print("[7] Entering code...")
                code_input = page.locator('input[type="tel"], input[inputmode="numeric"], input[maxlength="7"], input[maxlength="6"]')
                if await code_input.count() == 0:
                    await page.locator('text=Verify email').click()
                    await asyncio.sleep(2)

                if await code_input.count() > 0:
                    await code_input.first.fill(otp)
                    print("  ✅ Code entered")

                    submit = page.locator('button:has-text("Submit")')
                    await asyncio.sleep(1)
                    disabled = await submit.evaluate('b => b.disabled')
                    if disabled:
                        await page.evaluate('() => { const b = document.querySelector("button[type=submit]:disabled"); if(b){b.disabled=false;} }')
                    
                    await submit.click()
                    await asyncio.sleep(10)
                    await page.screenshot(path="bob-proxy-step3.png")

                    final_url = page.url
                    final_body = await page.inner_text("body")
                    print(f"  URL: {final_url}")

                    if "trial" not in final_url and "bob.ibm.com" in final_url:
                        print("\n✅ IBM BOB REGISTERED!")
                        os.makedirs("output", exist_ok=True)
                        with open("output/ibm-bob.txt", "a") as f:
                            f.write(f"{email}|{ibm_pw}|IBM Bob 40 Bobcoins\n")
                        return True
                    elif "bobcoins" in final_body.lower() or "dashboard" in final_body.lower():
                        print("\n✅ IBM BOB TRIAL ACTIVATED!")
                        return True
                    else:
                        print(f"  Body: {final_body[:300]}")
                else:
                    print("  ❌ No code input found")
            else:
                print("  ❌ No OTP received")
                await page.screenshot(path="bob-proxy-no-otp.png")
        elif "unable to process" in body.lower():
            print("  ❌ IBM still blocking even with proxy")
        else:
            print(f"  Body: {body[:500]}")

        print(f"\n[Final] URL: {page.url}")
    except Exception as e:
        print(f"\n[Error]: {e}")
        await page.screenshot(path="bob-proxy-error.png")
    finally:
        await browser.close()
        await pw.stop()

    return False

if __name__ == "__main__":
    ok = asyncio.run(main())
    print(f"\nResult: {'SUCCESS' if ok else 'FAILED'}")
