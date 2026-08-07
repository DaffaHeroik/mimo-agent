"""Direct Blackbox.ai registration — no TUI."""
import asyncio, json, os, secrets, string, time, sys
from pathlib import Path

# Set browser path
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = os.path.expanduser('~/.cache/ms-playwright')

from config import Config
from providers.blackbox import BlackboxClient, AccountResult
from providers.tempmail import generate_email

OUTPUT_DIR = "output"

def generate_password(length=16):
    return "".join(secrets.choice(string.ascii_letters + string.digits + "!@#$%") for _ in range(length))

def save_key(record):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(os.path.join(OUTPUT_DIR, "keys.txt"), "a") as f:
        f.write(f"{record['email']}|{record['password']}|{record['api_key']}\n")
    with open(os.path.join(OUTPUT_DIR, "keys.json"), "a") as f:
        f.write(json.dumps(record) + "\n")

async def register_one(count=1):
    cfg = Config(headless=True, max_workers=1, random_delay_min=2, random_delay_max=5)
    results = []
    
    for i in range(count):
        email = generate_email(cfg.tempmail_domain)
        password = generate_password()
        print(f"\n[{i+1}/{count}] Registering: {email}")
        
        client = None
        try:
            client = BlackboxClient(cfg)
            await client.start()
            
            print(f"  → Creating account...")
            api_key = await client.register_and_create_key(email, password)
            
            if api_key:
                record = {"email": email, "password": password, "api_key": api_key, "success": True}
                save_key(record)
                print(f"  ✅ SUCCESS! API Key: {api_key[:30]}...")
                results.append(record)
            else:
                print(f"  ❌ No API key returned")
                results.append({"email": email, "password": password, "success": False, "error": "no key"})
                
        except Exception as e:
            print(f"  ❌ Error: {str(e)[:200]}")
            results.append({"email": email, "password": password, "success": False, "error": str(e)[:200]})
        finally:
            if client:
                try: await client.stop()
                except: pass
        
        if i < count - 1:
            delay = secrets.SystemRandom().uniform(3, 8)
            print(f"  ⏳ Waiting {delay:.1f}s...")
            await asyncio.sleep(delay)
    
    # Summary
    ok = sum(1 for r in results if r.get('success'))
    print(f"\n{'='*50}")
    print(f"  Results: {ok}/{count} success")
    print(f"{'='*50}")
    
    if ok > 0:
        print(f"\n  Keys saved to: {OUTPUT_DIR}/keys.txt")
        for r in results:
            if r.get('api_key'):
                print(f"  {r['email']} → {r['api_key'][:40]}...")
    
    return results

if __name__ == "__main__":
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    print(f"Blackbox.ai Farm — Registering {count} account(s)...")
    results = asyncio.run(register_one(count))
