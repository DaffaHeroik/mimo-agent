"""Debug IBM Bob trial page — full inspection."""
import asyncio, os, json
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = os.path.expanduser('~/.cache/ms-playwright')
from playwright.async_api import async_playwright

async def debug():
    pw = await async_playwright().start()
    b = await pw.chromium.launch(headless=True, args=['--no-sandbox'])
    p = await b.new_page()
    await p.set_viewport_size({"width": 1280, "height": 900})
    
    # Track POST URLs only
    post_urls = []
    def on_req(req):
        if req.method == "POST":
            post_urls.append(req.url[:120])
    p.on("request", on_req)
    
    print("[1] Loading trial page...")
    await p.goto("https://bob.ibm.com/trial", wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)
    
    # All links
    links = await p.evaluate("""() => {
        return Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.textContent.trim().substring(0,50),
            href: a.href
        })).filter(l => l.text.length > 0);
    }""")
    print(f"\n[2] Links ({len(links)}):")
    for l in links:
        print(f'  "{l["text"]}" -> {l["href"][:80]}')
    
    # Social buttons
    social = await p.evaluate("""() => {
        const btns = document.querySelectorAll('button, a');
        return Array.from(btns).map(b => ({
            text: b.textContent.trim().substring(0,60),
            href: b.href || '',
            tag: b.tagName
        })).filter(b => 
            b.text.toLowerCase().includes('google') || 
            b.text.toLowerCase().includes('github') ||
            b.text.toLowerCase().includes('sign up') ||
            b.href.includes('google') ||
            b.href.includes('github')
        );
    }""")
    print(f"\n[3] Social buttons:")
    for s in social:
        print(f'  [{s["tag"]}] "{s["text"]}" -> {s["href"][:80]}')
    
    # Form structure
    form_info = await p.evaluate("""() => {
        const form = document.querySelector('form');
        if (!form) return 'no form found';
        return {
            action: form.action,
            method: form.method,
            inputs: Array.from(form.querySelectorAll('input')).map(i => ({
                type: i.type, name: i.name, id: i.id, required: i.required
            })),
            buttons: Array.from(form.querySelectorAll('button')).map(b => ({
                text: b.textContent.trim(), type: b.type, disabled: b.disabled
            }))
        };
    }""")
    print(f"\n[4] Form: {json.dumps(form_info, indent=2)}")
    
    # Accordion items
    accordion = await p.evaluate("""() => {
        const items = document.querySelectorAll('[class*=accordion]');
        return Array.from(items).map(i => ({
            text: i.textContent.trim().substring(0,120).replace(/\\s+/g, ' '),
            disabled: i.classList.contains('disabled') || i.classList.contains('cds--accordion__item--disabled')
        }));
    }""")
    print(f"\n[5] Accordion items:")
    for a in accordion:
        status = 'DISABLED' if a['disabled'] else 'ACTIVE'
        print(f'  [{status}] {a[chr(34)+chr(116)+chr(101)+chr(120)+chr(116)+chr(34)][:100]}')
    
    # Check for "Verify you are human" widget
    verify_widget = await p.evaluate("""() => {
        const body = document.body.innerHTML;
        const has_turnstile = body.includes('turnstile') || body.includes('cf-turnstile');
        const has_recaptcha = body.includes('recaptcha') || body.includes('g-recaptcha');
        const has_hcaptcha = body.includes('hcaptcha');
        const verify_els = document.querySelectorAll('[class*=verify], [id*=verify]');
        return {
            has_turnstile, has_recaptcha, has_hcaptcha,
            verify_elements: Array.from(verify_els).map(e => ({
                tag: e.tagName, class: e.className?.substring(0,60),
                text: e.textContent?.substring(0,80)
            }))
        };
    }""")
    print(f"\n[6] Verification widgets: {json.dumps(verify_widget, indent=2)}")
    
    # Screenshot
    await p.screenshot(path="ibm-debug.png")
    
    # Now fill and click Next
    print("\n[7] Filling form with respati1@bozztirex.us...")
    await p.select_option("#country", value="MY")
    for fid, val in [("email", "respati1@bozztirex.us"), ("password", "Daffa112233"), ("firstName", "Respati"), ("lastName", "Iswahyudi")]:
        el = p.locator(f"#{fid}")
        await el.click(click_count=3)
        await el.fill(val)
        await el.evaluate('e => {e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}))}')
    
    post_urls.clear()
    
    print("[8] Clicking Next...")
    await p.locator('button:has-text("Next")').click()
    await asyncio.sleep(10)
    
    print(f"\n[9] POST requests after Next ({len(post_urls)}):")
    for u in post_urls:
        print(f"  {u}")
    
    # Check body
    body = await p.inner_text("body")
    print(f"\n[10] Body after Next:")
    print(f"  {body[:500]}")
    
    # All inputs after Next
    inputs = await p.evaluate("""() => {
        return Array.from(document.querySelectorAll('input')).map(i => ({
            type: i.type, id: i.id, name: i.name, value: i.value?.substring(0,50),
            visible: i.offsetParent !== null, maxlength: i.maxLength,
            placeholder: i.placeholder
        }));
    }""")
    print(f"\n[11] Inputs after Next:")
    for i in inputs:
        vis = "VISIBLE" if i["visible"] else "hidden"
        print(f'  [{vis}] {i["type"]} #{i["id"]} name={i["name"]} max={i["maxlength"]} val={i["value"]}')
    
    # Accordion after Next
    accordion2 = await p.evaluate("""() => {
        const items = document.querySelectorAll('[class*=accordion]');
        return Array.from(items).map(i => ({
            text: i.textContent.trim().substring(0,120).replace(/\\s+/g, ' '),
            disabled: i.classList.contains('disabled') || i.classList.contains('cds--accordion__item--disabled'),
            class: i.className?.substring(0,80)
        }));
    }""")
    print(f"\n[12] Accordion after Next:")
    for a in accordion2:
        status = 'DISABLED' if a['disabled'] else 'ACTIVE'
        print(f'  [{status}] {a[chr(34)+chr(116)+chr(101)+chr(120)+chr(116)+chr(34)][:100]}')
    
    await p.screenshot(path="ibm-debug-after-next.png")
    
    await b.close()
    await pw.stop()
    print("\n[DONE]")

asyncio.run(debug())
