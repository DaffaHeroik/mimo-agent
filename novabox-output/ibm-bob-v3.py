"""IBM Bob — stealth mode + longer delays."""
import asyncio, os, re, time, secrets, httpx, random

os.environ['PLAYWRIGHT_BROWSERS_PATH'] = os.path.expanduser('~/.cache/ms-playwright')

MAILTM_API = "https://api.mail.tm"

def gen_email():
    return f"{secrets.token_hex(6)}@emalupe.com"

def gen_password():
    return secrets.token_urlsafe(12) + "!A1"

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

async def human_type(page, selector, text, min_delay=50, max_delay=150):
    """Type like a human with random delays."""
    el = page.locator(selector)
    await el.click()
    await asyncio.sleep(0.3)
    for char in text:
        await el.type(char, delay=random.randint(min_delay, max_delay))
        if random.random() < 0.1:  # occasional longer pause
            await asyncio.sleep(random.uniform(0.2, 0.5))

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

    # 2. Playwright with stealth
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(
        headless=True,
        args=[
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-web-security',
        ]
    )
    context = await browser.new_context(
        viewport={'width': 1366, 'height': 768},
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        locale='en-US',
        timezone_id='America/New_York',
    )
    page = await context.new_page()

    # Remove webdriver flag
    await page.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
        Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3,4,5]});
        Object.defineProperty(navigator, 'languages', {get: () => ['en-US','en']});
        window.chrome = {runtime: {}};
    """)

    try:
        print("[2] Opening IBM Bob trial...")
        await page.goto("https://bob.ibm.com/trial", wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(random.uniform(3, 6))

        # Scroll a bit like human
        await page.mouse.move(400, 300)
        await asyncio.sleep(0.5)
        await page.mouse.wheel(0, 200)
        await asyncio.sleep(1)

        # Country
        print("[3] Selecting Malaysia...")
        await page.select_option('#country', value='MY')
        await page.locator('#country').evaluate('e => e.dispatchEvent(new Event("change",{bubbles:true}))')
        await asyncio.sleep(random.uniform(1, 2))

        # Fill with human-like typing
        print("[4] Filling form (human-like)...")
        
        # Email
        await human_type(page, '#email', email)
        await asyncio.sleep(random.uniform(0.5, 1))

        # Password
        await human_type(page, '#password', ibm_pw)
        await asyncio.sleep(random.uniform(0.5, 1))

        # First name
        await human_type(page, '#firstName', 'Respati')
        await asyncio.sleep(random.uniform(0.3, 0.7))

        # Last name
        await human_type(page, '#lastName', 'Iswahyudi')
        await asyncio.sleep(random.uniform(0.5, 1))

        # Company if exists
        has_company = await page.locator('#company').count() > 0
        if has_company:
            await human_type(page, '#company', 'Bozztirex Corp')
            await asyncio.sleep(0.5)

        print("  ✅ All fields filled")
        await page.screenshot(path="bob-stealth-step1.png")

        # Wait before clicking
        await asyncio.sleep(random.uniform(2, 4))

        # Click Next
        print("[5] Clicking Next...")
        next_btn = page.locator('button:has-text("Next")')
        await next_btn.hover()
        await asyncio.sleep(0.3)
        await next_btn.click()
        await asyncio.sleep(random.uniform(8, 12))

        await page.screenshot(path="bob-stealth-step2.png")

        body = await page.inner_text("body")
        errors = await page.evaluate('()=>Array.from(document.querySelectorAll(".cds--form-requirement, [class*=error], [class*=Error]")).map(e=>e.textContent.trim()).filter(Boolean)')
        print(f"  Errors/Status: {errors}")

        if "7 digit code" in body.lower() or "emailed" in body.lower() or "verify" in body.lower():
            print("  ✅ Verification code sent!")
        elif "unable to process" in body.lower():
            print("  ❌ IBM still blocking — IP detected as datacenter")
            print("  💡 Need residential proxy or different approach")
            return False
        else:
            print(f"  Body: {body[:300]}")

        # Poll OTP
        print("[6] Waiting for OTP...")
        otp = await poll_otp(token, timeout=120)
        if otp:
            print(f"  ✅ OTP: {otp}")
            print("[7] Entering code...")
            code_input = page.locator('input[type="tel"], input[inputmode="numeric"], input[maxlength="7"], input[maxlength="6"]')
            if await code_input.count() == 0:
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
                await page.screenshot(path="bob-stealth-step3.png")
                final_url = page.url
                final_body = await page.inner_text("body")
                print(f"  URL: {final_url}")
                if "trial" not in final_url and "bob.ibm.com" in final_url:
                    print("\n✅ IBM BOB REGISTERED!")
                    os.makedirs("output", exist_ok=True)
                    with open("output/ibm-bob.txt", "a") as f:
                        f.write(f"{email}|{ibm_pw}|IBM Bob 40 Bobcoins\n")
                    return True
                elif "bobcoins" in final_body.lower():
                    print("\n✅ IBM BOB TRIAL ACTIVATED!")
                    return True
        else:
            print("  ❌ No OTP received")
            await page.screenshot(path="bob-stealth-no-otp.png")

        print(f"\n[Final] URL: {page.url}")
    except Exception as e:
        print(f"\n[Error]: {e}")
        await page.screenshot(path="bob-stealth-error.png")
    finally:
        await browser.close()
        await pw.stop()

    return False

if __name__ == "__main__":
    ok = asyncio.run(main())
    print(f"\nResult: {'SUCCESS' if ok else 'FAILED'}")
