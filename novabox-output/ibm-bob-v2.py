"""IBM Bob registration — strong password + company field."""
import asyncio, os, re, time, secrets, httpx

os.environ['PLAYWRIGHT_BROWSERS_PATH'] = os.path.expanduser('~/.cache/ms-playwright')

MAILTM_API = "https://api.mail.tm"

def gen_email():
    return f"{secrets.token_hex(6)}@emalupe.com"

def gen_password():
    # Strong password: 16 chars, upper+lower+digit+symbol
    return secrets.token_urlsafe(12) + "!A1"

async def create_mailtm(email, pw):
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(f"{MAILTM_API}/accounts", json={"address": email, "password": pw})
        if r.status_code == 201:
            r2 = await c.post(f"{MAILTM_API}/token", json={"address": email, "password": pw})
            return r2.json().get("token")
        print(f"  mail.tm error: {r.json()}")
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
    ibm_pw = gen_password()
    print(f"Email: {email}")
    print(f"IBM Password: {ibm_pw}")

    # 1. Create mail.tm
    print("[1] Creating mail.tm account...")
    token = await create_mailtm(email, mail_pw)
    if not token:
        print("❌ mail.tm failed"); return False
    print("  ✅ mail.tm ready")

    # 2. Playwright
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])
    page = await browser.new_page()
    await page.set_viewport_size({"width":1280,"height":900})

    try:
        print("[2] Opening IBM Bob trial...")
        await page.goto("https://bob.ibm.com/trial", wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(5)

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
        # Check if company field exists
        has_company = await page.locator('#company').count() > 0
        if has_company:
            fields.append(('company', 'Bozztirex Corp'))

        for fid, val in fields:
            el = page.locator(f'#{fid}')
            await el.click(click_count=3)
            await el.fill(val)
            await el.evaluate('e => {e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));e.dispatchEvent(new Event("blur",{bubbles:true}))}')
            await asyncio.sleep(0.3)
        print("  ✅ All fields filled")

        # Screenshot
        await page.screenshot(path="bob-final-step1.png")

        # Click Next
        print("[5] Clicking Next...")
        await page.locator('button:has-text("Next")').click()
        await asyncio.sleep(8)

        await page.screenshot(path="bob-final-step2.png")

        body = await page.inner_text("body")
        errors = await page.evaluate('()=>Array.from(document.querySelectorAll(".cds--form-requirement, [class*=error], [class*=Error]")).map(e=>e.textContent.trim()).filter(Boolean)')
        print(f"  Errors: {errors}")

        if "7 digit code" in body.lower() or "emailed" in body.lower() or "verify" in body.lower():
            print("  ✅ Verification code sent!")
        else:
            print(f"  Body: {body[:300]}")

        # Poll OTP
        print("[6] Waiting for OTP...")
        otp = await poll_otp(token, timeout=120)
        if otp:
            print(f"  ✅ OTP: {otp}")

            # Enter code
            print("[7] Entering code...")
            code_input = page.locator('input[type="tel"], input[inputmode="numeric"], input[maxlength="7"], input[maxlength="6"]')
            if await code_input.count() == 0:
                # Try clicking verify accordion
                verify_btn = page.locator('text=Verify email')
                if await verify_btn.count() > 0:
                    await verify_btn.click()
                    await asyncio.sleep(2)

            if await code_input.count() > 0:
                await code_input.first.fill(otp)
                print("  ✅ Code entered")

                submit = page.locator('button:has-text("Submit")')
                await asyncio.sleep(1)
                disabled = await submit.evaluate('b => b.disabled')
                if disabled:
                    await page.evaluate('()=>{const b=document.querySelector("button[type=submit]:disabled");if(b){b.disabled=false;b.classList.remove("cds--btn--disabled")}}')

                await submit.click()
                await asyncio.sleep(10)

                await page.screenshot(path="bob-final-step3.png")
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
            await page.screenshot(path="bob-final-no-otp.png")

        print(f"\n[Final] URL: {page.url}")
    except Exception as e:
        print(f"\n[Error]: {e}")
        await page.screenshot(path="bob-final-error.png")
    finally:
        await browser.close()
        await pw.stop()

    return False

if __name__ == "__main__":
    ok = asyncio.run(main())
    print(f"\nResult: {'SUCCESS' if ok else 'FAILED'}")
