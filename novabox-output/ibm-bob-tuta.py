"""Full flow: Create Tutanota email → Register IBM Bob."""
import asyncio, os, secrets, re, time, httpx, subprocess

os.environ['PLAYWRIGHT_BROWSERS_PATH'] = os.path.expanduser('~/.cache/ms-playwright')

PROXY = {'server': 'http://66.163.127.204:10006'}

def read_clock_from_screenshot(screenshot_path):
    """Use mimo-omni to read clock time from screenshot."""
    try:
        result = subprocess.run(
            ['python3', os.path.expanduser('~/.openclaw/skills/mimo-omni/mimo_api.py'),
             'image', screenshot_path,
             'What time does the clock show? Give me ONLY the time in HH:MM format, nothing else.'],
            capture_output=True, text=True, timeout=30
        )
        output = result.stdout.strip()
        # Extract HH:MM from output
        match = re.search(r'(\d{1,2}:\d{2})', output)
        if match:
            return match.group(1)
    except Exception as e:
        print(f'  Clock read error: {e}')
    return None

async def create_tuta_account():
    """Create a Tutanota email account."""
    from playwright.async_api import async_playwright
    
    username = f'mimo{secrets.token_hex(4)}'
    password = 'TutaSecure2026!@#'
    
    print(f'[Tuta] Username: {username}@tutamail.com')
    
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = await browser.new_page()
    await page.set_viewport_size({'width': 1280, 'height': 900})
    
    try:
        # Go to signup
        await page.goto('https://app.tuta.com/signup', wait_until='domcontentloaded', timeout=60000)
        await asyncio.sleep(8)
        
        # Select Free plan
        await page.locator('text=Free').first.click()
        await asyncio.sleep(2)
        await page.locator('button:has-text("Continue")').first.click()
        await asyncio.sleep(5)
        
        # Fill form
        await page.locator('[aria-label="Username"]').fill(username)
        await asyncio.sleep(1)
        await page.locator('[aria-label="Set password"]').fill(password)
        await asyncio.sleep(0.5)
        await page.locator('[aria-label="Repeat password"]').fill(password)
        await asyncio.sleep(1)
        
        # Check checkboxes
        checkboxes = page.locator('input[type="checkbox"]')
        for i in range(await checkboxes.count()):
            await checkboxes.nth(i).click()
            await asyncio.sleep(0.3)
        
        # Click Create account
        await page.locator('button:has-text("Create account")').click()
        await asyncio.sleep(30)
        
        # Handle CAPTCHA (up to 3 attempts)
        for attempt in range(3):
            body = await page.inner_text('body')
            
            if 'captcha' in body.lower() or 'clock' in body.lower() or 'hh:mm' in body.lower():
                print(f'[Tuta] CAPTCHA detected (attempt {attempt+1})')
                
                # Take screenshot
                captcha_path = f'tuta-captcha-{attempt}.png'
                await page.screenshot(path=captcha_path, full_page=True)
                
                # Read clock time
                time_str = read_clock_from_screenshot(captcha_path)
                print(f'[Tuta] Clock time: {time_str}')
                
                if time_str:
                    # Enter the time
                    answer_input = page.locator('input[type="text"], input[placeholder*="hh:mm"], input[placeholder*="answer"]')
                    if await answer_input.count() > 0:
                        await answer_input.first.fill(time_str)
                        await asyncio.sleep(1)
                        
                        # Click OK
                        ok_btn = page.locator('button:has-text("Ok"), button:has-text("OK")')
                        if await ok_btn.count() > 0:
                            await ok_btn.first.click()
                            await asyncio.sleep(30)
                    else:
                        print('[Tuta] No answer input found')
                        break
                else:
                    print('[Tuta] Could not read clock time')
                    break
            elif 'recovery' in body.lower():
                print('[Tuta] ✅ Account created! Recovery page.')
                email = f'{username}@tutamail.com'
                os.makedirs('output', exist_ok=True)
                with open('output/tuta-accounts.txt', 'a') as f:
                    f.write(f'{email}|{password}\n')
                await browser.close()
                await pw.stop()
                return email, password
            elif 'inbox' in body.lower() or 'welcome' in body.lower():
                print('[Tuta] ✅ Account created! Inbox.')
                email = f'{username}@tutamail.com'
                os.makedirs('output', exist_ok=True)
                with open('output/tuta-accounts.txt', 'a') as f:
                    f.write(f'{email}|{password}\n')
                await browser.close()
                await pw.stop()
                return email, password
            else:
                print(f'[Tuta] Status: {body[:200]}')
                await asyncio.sleep(10)
        
        await page.screenshot(path='tuta-final-status.png')
        print(f'[Tuta] Final URL: {page.url}')
        
    except Exception as e:
        print(f'[Tuta] Error: {e}')
        await page.screenshot(path='tuta-error.png')
    finally:
        await browser.close()
        await pw.stop()
    
    return None, None

async def register_ibm_bob(email, password):
    """Register IBM Bob with the given email."""
    from playwright.async_api import async_playwright
    
    ibm_pw = 'SuperSecure2026!@#'
    
    print(f'\n[IBM] Registering with {email}...')
    
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'], proxy=PROXY)
    page = await browser.new_page()
    await page.set_viewport_size({'width': 1280, 'height': 900})
    
    try:
        # Go to trial page
        print('[IBM] Opening trial page...')
        await page.goto('https://bob.ibm.com/trial', wait_until='domcontentloaded', timeout=60000)
        await asyncio.sleep(5)
        
        # Country
        await page.select_option('#country', value='MY')
        await page.locator('#country').evaluate('e => e.dispatchEvent(new Event("change",{bubbles:true}))')
        await asyncio.sleep(1)
        
        # Fill form
        for fid, val in [('email', email), ('password', ibm_pw), ('firstName', 'Respati'), ('lastName', 'Iswahyudi'), ('company', 'Bozztirex Corp')]:
            el = page.locator(f'#{fid}')
            await el.click(click_count=3)
            await el.fill(val)
            await el.evaluate('e => {e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));e.dispatchEvent(new Event("blur",{bubbles:true}))}')
            await asyncio.sleep(0.3)
        print('[IBM] Form filled')
        
        # Click Next
        await page.locator('button:has-text("Next")').click()
        await asyncio.sleep(10)
        
        body = await page.inner_text('body')
        if 'verify' in body.lower() or '7 digit' in body.lower():
            print('[IBM] ✅ Code sent! Check Tutanota inbox...')
            
            # Wait for OTP in Tutanota
            otp = await check_tuta_inbox(email, password, timeout=120)
            if otp:
                print(f'[IBM] ✅ OTP: {otp}')
                
                # Enter code
                code_input = page.locator('input[type="tel"], input[inputmode="numeric"], input[maxlength="7"], input[maxlength="6"]')
                if await code_input.count() == 0:
                    await page.locator('text=Verify email').click()
                    await asyncio.sleep(2)
                
                if await code_input.count() > 0:
                    await code_input.first.fill(otp)
                    submit = page.locator('button:has-text("Submit")')
                    disabled = await submit.evaluate('b => b.disabled')
                    if disabled:
                        await page.evaluate('() => { const b = document.querySelector("button[type=submit]:disabled"); if(b){b.disabled=false;} }')
                    await submit.click()
                    await asyncio.sleep(10)
                    
                    final_url = page.url
                    final_body = await page.inner_text('body')
                    print(f'[IBM] Final URL: {final_url}')
                    
                    if 'trial' not in final_url and 'bob.ibm.com' in final_url:
                        print('\n✅✅✅ IBM BOB REGISTERED!')
                        os.makedirs('output', exist_ok=True)
                        with open('output/ibm-bob.txt', 'a') as f:
                            f.write(f'{email}|{ibm_pw}|IBM Bob 40 Bobcoins\n')
                        return True
                    elif 'bobcoins' in final_body.lower():
                        print('\n✅ IBM BOB TRIAL ACTIVATED!')
                        return True
                    else:
                        print(f'[IBM] Body: {final_body[:300]}')
            else:
                print('[IBM] ❌ No OTP received')
        else:
            print(f'[IBM] Body: {body[:300]}')
        
    except Exception as e:
        print(f'[IBM] Error: {e}')
    finally:
        await browser.close()
        await pw.stop()
    
    return False

async def check_tuta_inbox(email, password, timeout=120):
    """Check Tutanota inbox for OTP."""
    from playwright.async_api import async_playwright
    
    print('[Tuta Inbox] Opening Tutanota...')
    
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = await browser.new_page()
    await page.set_viewport_size({'width': 1280, 'height': 900})
    
    try:
        # Login to Tutanota
        await page.goto('https://app.tuta.com/login', wait_until='domcontentloaded', timeout=60000)
        await asyncio.sleep(5)
        
        # Fill email
        email_input = page.locator('input[type="text"], input[aria-label*="mail"], input[aria-label*="Mail"]')
        if await email_input.count() > 0:
            await email_input.first.fill(email)
            await asyncio.sleep(1)
        
        # Fill password
        pw_input = page.locator('input[type="password"]')
        if await pw_input.count() > 0:
            await pw_input.first.fill(password)
            await asyncio.sleep(1)
        
        # Click Login
        login_btn = page.locator('button:has-text("Log in"), button:has-text("Login")')
        if await login_btn.count() > 0:
            await login_btn.first.click()
            await asyncio.sleep(10)
        
        # Poll for emails
        deadline = time.monotonic() + timeout
        pat = re.compile(r'\b(\d{6,7})\b')
        
        while time.monotonic() < deadline:
            body = await page.inner_text('body')
            
            # Look for IBM email
            if 'ibm' in body.lower() or 'verification' in body.lower() or 'code' in body.lower():
                # Try to click on the email
                ibm_email = page.locator('text=IBM, text=ibm, text=verification')
                if await ibm_email.count() > 0:
                    await ibm_email.first.click()
                    await asyncio.sleep(3)
                    
                    # Read the email content
                    email_body = await page.inner_text('body')
                    match = pat.search(email_body)
                    if match:
                        await browser.close()
                        await pw.stop()
                        return match.group(1)
            
            # Refresh
            await page.reload()
            await asyncio.sleep(5)
        
    except Exception as e:
        print(f'[Tuta Inbox] Error: {e}')
    finally:
        await browser.close()
        await pw.stop()
    
    return None

async def main():
    # Step 1: Create Tutanota account
    print('='*50)
    print('STEP 1: Creating Tutanota account')
    print('='*50)
    
    email, password = await create_tuta_account()
    
    if not email:
        print('\n❌ Failed to create Tutanota account')
        return
    
    print(f'\n✅ Tutanota account: {email}')
    
    # Step 2: Register IBM Bob
    print('\n' + '='*50)
    print('STEP 2: Registering IBM Bob')
    print('='*50)
    
    success = await register_ibm_bob(email, password)
    
    if success:
        print('\n🎉 COMPLETE! IBM Bob registered successfully!')
    else:
        print('\n❌ IBM Bob registration failed')

if __name__ == "__main__":
    asyncio.run(main())
