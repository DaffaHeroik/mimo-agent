import asyncio, os, secrets
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = os.path.expanduser('~/.cache/ms-playwright')

async def check():
    from playwright.async_api import async_playwright
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])
    page = await browser.new_page()
    await page.set_viewport_size({'width':1280,'height':900})
    
    await page.goto('https://bob.ibm.com/trial', wait_until='domcontentloaded', timeout=30000)
    await asyncio.sleep(5)
    
    # Fill form
    await page.select_option('#country', value='MY')
    await page.locator('#country').evaluate('e => e.dispatchEvent(new Event("change",{bubbles:true}))')
    await asyncio.sleep(1)
    
    email = f'{secrets.token_hex(6)}@emalupe.com'
    for fid, val in [('email', email), ('password', 'TestPassword123!'), ('firstName', 'Test'), ('lastName', 'User')]:
        el = page.locator(f'#{fid}')
        await el.click(click_count=3)
        await el.fill(val)
        await el.evaluate('e => {e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));e.dispatchEvent(new Event("blur",{bubbles:true}))}')
        await asyncio.sleep(0.3)
    
    # Click Next
    await page.locator('button:has-text("Next")').click()
    await asyncio.sleep(10)
    
    # Get page text
    body = await page.inner_text('body')
    print('=== PAGE TEXT ===')
    print(body[:2000])
    print('=== URL ===')
    print(page.url)
    
    # Check for verification
    verify = await page.evaluate('() => { const els = document.querySelectorAll("h2, h3, h4"); return Array.from(els).map(e => e.textContent.trim()); }')
    print('=== HEADINGS ===')
    print(verify)
    
    # Check errors
    errors = await page.evaluate('() => { return Array.from(document.querySelectorAll(".cds--form-requirement")).map(e => e.textContent.trim()); }')
    print('=== ERRORS ===')
    print(errors)
    
    await page.screenshot(path='bob-debug-final.png')
    
    await browser.close()
    await pw.stop()

asyncio.run(check())
