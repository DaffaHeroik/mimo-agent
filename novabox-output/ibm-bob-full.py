"""Full flow v2: Create Tutanota → verify login → IBM Bob."""
import asyncio, os, secrets, re, time, subprocess, base64

os.environ['PLAYWRIGHT_BROWSERS_PATH'] = os.path.expanduser('~/.cache/ms-playwright')

PROXY = {'server': 'http://66.163.127.204:10006'}

def read_clock(path):
    try:
        r = subprocess.run(['python3', os.path.expanduser('~/.openclaw/skills/mimo-omni/mimo_api.py'), 'image', path, 'What time does the analog clock show? Give ONLY the time in HH:MM format (24-hour).'], capture_output=True, text=True, timeout=60)
        m = re.search(r'(\d{1,2}:\d{2})', r.stdout)
        return m.group(1) if m else None
    except:
        return None

async def create_tuta():
    from playwright.async_api import async_playwright
    
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])
    page = await browser.new_page()
    await page.set_viewport_size({'width': 1280, 'height': 900})
    
    username = f'mimo{secrets.token_hex(4)}'
    password = 'TutaSecure2026!@#'
    
    try:
        await page.goto('https://app.tuta.com/signup', wait_until='domcontentloaded', timeout=60000)
        await asyncio.sleep(8)
        
        await page.locator('text=Free').first.click()
        await asyncio.sleep(2)
        await page.locator('button:has-text("Continue")').first.click()
        await asyncio.sleep(5)
        
        await page.locator('[aria-label="Username"]').fill(username)
        await page.locator('[aria-label="Set password"]').fill(password)
        await page.locator('[aria-label="Repeat password"]').fill(password)
        await asyncio.sleep(1)
        
        checkboxes = page.locator('input[type="checkbox"]')
        for i in range(await checkboxes.count()):
            await checkboxes.nth(i).click()
        
        await page.locator('button:has-text("Create account")').click()
        
        # Wait for CAPTCHA
        for i in range(18):
            await asyncio.sleep(5)
            body = await page.inner_text('body')
            
            if 'captcha' in body.lower() or 'clock' in body.lower():
                print(f'  CAPTCHA at {(i+1)*5}s')
                
                # Save clock image
                captcha_img = await page.evaluate('() => { const imgs = document.querySelectorAll("img"); for (const img of imgs) { if (img.src && img.src.startsWith("data:image")) return img.src; } return null; }')
                
                if captcha_img:
                    img_data = captcha_img.split(',')[1]
                    with open('tuta-clock-tmp.png', 'wb') as f:
                        f.write(base64.b64decode(img_data))
                    
                    time_str = read_clock('tuta-clock-tmp.png')
                    print(f'  Clock: {time_str}')
                    
                    if time_str:
                        # Fill answer
                        await page.evaluate(f'''() => {{
                            const inputs = document.querySelectorAll("input[type=text]");
                            for (const inp of inputs) {{
                                if (inp.getBoundingClientRect().y > 600) {{
                                    inp.value = "{time_str}";
                                    inp.dispatchEvent(new Event("input", {{bubbles: true}}));
                                    break;
                                }}
                            }}
                        }}''')
                        
                        await asyncio.sleep(1)
                        ok_btn = page.locator('button:has-text("Ok")')
                        if await ok_btn.count() > 0:
                            await ok_btn.first.click()
                            await asyncio.sleep(30)
                
                break
        
        # Check result
        body = await page.inner_text('body')
        url = page.url
        
        if 'recovery' in body.lower() or 'inbox' in url.lower():
            print(f'  ✅ Account created: {username}@tutamail.com')
            await browser.close()
            await pw.stop()
            return username, password
        
        print(f'  Status: {body[:200]}')
        
    except Exception as e:
        print(f'  Error: {e}')
    finally:
        await browser.close()
        await pw.stop()
    
    return None, None

async def verify_tuta_login(username, password):
    from playwright.async_api import async_playwright
    
    email = f'{username}@tutamail.com'
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])
    page = await browser.new_page()
    await page.set_viewport_size({'width': 1280, 'height': 900})
    
    try:
        await page.goto('https://app.tuta.com/login', wait_until='domcontentloaded', timeout=60000)
        await asyncio.sleep(8)
        
        await page.locator('input[type="email"]').fill(email)
        await page.locator('input[type="password"]').fill(password)
        await page.locator('button:has-text("Log in")').click()
        await asyncio.sleep(15)
        
        url = page.url
        body = await page.inner_text('body')
        
        if 'inbox' in url.lower() or 'mail' in url.lower():
            print(f'  ✅ Login verified!')
            await browser.close()
            await pw.stop()
            return True
        elif 'invalid' in body.lower():
            print(f'  ❌ Invalid credentials')
        else:
            print(f'  Status: {body[:200]}')
        
    except Exception as e:
        print(f'  Error: {e}')
    finally:
        await browser.close()
        await pw.stop()
    
    return False

async def register_ibm(email):
    from playwright.async_api import async_playwright
    
    ibm_pw = 'SuperSecure2026!@#'
    
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True, args=['--no-sandbox','--disable-dev-shm-usage'], proxy=PROXY)
    page = await browser.new_page()
    await page.set_viewport_size({'width': 1280, 'height': 900})
    
    try:
        await page.goto('https://bob.ibm.com/trial', wait_until='domcontentloaded', timeout=60000)
        await asyncio.sleep(5)
        
        await page.select_option('#country', value='MY')
        await page.locator('#country').evaluate('e => e.dispatchEvent(new Event("change",{bubbles:true}))')
        await asyncio.sleep(1)
        
        for fid, val in [('email', email), ('password', ibm_pw), ('firstName', 'Respati'), ('lastName', 'Iswahyudi'), ('company', 'Bozztirex Corp')]:
            el = page.locator(f'#{fid}')
            await el.click(click_count=3)
            await el.fill(val)
            await el.evaluate('e => {e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));e.dispatchEvent(new Event("blur",{bubbles:true}))}')
            await asyncio.sleep(0.3)
        
        await page.locator('button:has-text("Next")').click()
        await asyncio.sleep(10)
        
        body = await page.inner_text('body')
        if 'verify' in body.lower() or '7 digit' in body.lower():
            print(f'  ✅ Code sent to {email}')
            await browser.close()
            await pw.stop()
            return True
        
        print(f'  Body: {body[:200]}')
        
    except Exception as e:
        print(f'  Error: {e}')
    finally:
        await browser.close()
        await pw.stop()
    
    return False

async def check_tuta_inbox_for_otp(username, password, timeout=120):
    from playwright.async_api import async_playwright
    
    email = f'{username}@tutamail.com'
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])
    page = await browser.new_page()
    await page.set_viewport_size({'width': 1280, 'height': 900})
    
    try:
        await page.goto('https://app.tuta.com/login', wait_until='domcontentloaded', timeout=60000)
        await asyncio.sleep(8)
        
        await page.locator('input[type="email"]').fill(email)
        await page.locator('input[type="password"]').fill(password)
        await page.locator('button:has-text("Log in")').click()
        await asyncio.sleep(15)
        
        # Poll for emails
        deadline = time.monotonic() + timeout
        pat = re.compile(r'\b(\d{6,7})\b')
        
        while time.monotonic() < deadline:
            body = await page.inner_text('body')
            
            if 'ibm' in body.lower() or 'bob' in body.lower():
                ibm_link = page.locator('text=IBM, text=Bob')
                if await ibm_link.count() > 0:
                    await ibm_link.first.click()
                    await asyncio.sleep(3)
                    
                    email_body = await page.inner_text('body')
                    match = pat.search(email_body)
                    if match:
                        print(f'  ✅ OTP: {match.group(1)}')
                        await browser.close()
                        await pw.stop()
                        return match.group(1)
            
            await page.reload()
            await asyncio.sleep(5)
        
    except Exception as e:
        print(f'  Error: {e}')
    finally:
        await browser.close()
        await pw.stop()
    
    return None

async def complete_ibm(otp):
    from playwright.async_api import async_playwright
    
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True, args=['--no-sandbox','--disable-dev-shm-usage'], proxy=PROXY)
    page = await browser.new_page()
    await page.set_viewport_size({'width': 1280, 'height': 900})
    
    try:
        await page.goto('https://bob.ibm.com/trial', wait_until='domcontentloaded', timeout=60000)
        await asyncio.sleep(5)
        
        code_input = page.locator('input[type="tel"], input[inputmode="numeric"]')
        if await code_input.count() > 0:
            await code_input.first.fill(otp)
            
            submit = page.locator('button:has-text("Submit")')
            await submit.click()
            await asyncio.sleep(10)
            
            final_url = page.url
            final_body = await page.inner_text('body')
            
            if 'trial' not in final_url and 'bob.ibm.com' in final_url:
                print(f'  ✅ IBM BOB REGISTERED!')
                os.makedirs('output', exist_ok=True)
                with open('output/ibm-bob.txt', 'a') as f:
                    f.write(f'mimoXXX@tutamail.com|SuperSecure2026!@#|IBM Bob 40 Bobcoins\n')
                return True
        
    except Exception as e:
        print(f'  Error: {e}')
    finally:
        await browser.close()
        await pw.stop()
    
    return False

async def main():
    print('='*60)
    print('FULL FLOW: Tutanota → IBM Bob')
    print('='*60)
    
    # Step 1: Create Tutanota
    print('\n[1] Creating Tutanota account...')
    username, password = await create_tuta()
    
    if not username:
        print('❌ Failed to create Tutanota')
        return
    
    email = f'{username}@tutamail.com'
    print(f'✅ Tutanota: {email}')
    
    # Step 2: Verify login
    print('\n[2] Verifying Tutanota login...')
    if not await verify_tuta_login(username, password):
        print('❌ Login verification failed')
        return
    
    # Step 3: Register IBM Bob
    print('\n[3] Registering IBM Bob...')
    if not await register_ibm(email):
        print('❌ IBM registration failed')
        return
    
    # Step 4: Check inbox for OTP
    print('\n[4] Checking Tutanota inbox for OTP...')
    otp = await check_tuta_inbox_for_otp(username, password, timeout=120)
    
    if not otp:
        print('❌ No OTP received')
        return
    
    # Step 5: Complete IBM registration
    print(f'\n[5] Completing IBM registration with OTP: {otp}...')
    if await complete_ibm(otp):
        print('\n🎉🎉🎉 COMPLETE SUCCESS! 🎉🎉🎉')
        print(f'IBM Bob: {email}|SuperSecure2026!@#')
    else:
        print('❌ Failed to complete IBM registration')

if __name__ == "__main__":
    asyncio.run(main())
