"""mail.tm temp email provider — real domain, not blocked."""
import asyncio, time, re, httpx

API = "https://api.mail.tm"

async def create_account(email_prefix: str = None) -> dict:
    """Create a mail.tm account. Returns {email, password, token}."""
    async with httpx.AsyncClient(timeout=30) as client:
        # Get available domain
        resp = await client.get(f"{API}/domains")
        domains = resp.json().get("hydra:member", [])
        domain = domains[0]["domain"] if domains else "web-library.net"
        
        # Generate email
        import secrets
        if not email_prefix:
            email_prefix = secrets.token_hex(8)
        email = f"{email_prefix}@{domain}"
        password = secrets.token_hex(12)
        
        # Create account
        resp = await client.post(f"{API}/accounts", json={
            "address": email,
            "password": password
        })
        if resp.status_code >= 400:
            raise Exception(f"Account creation failed: {resp.text}")
        
        # Get auth token
        resp = await client.post(f"{API}/token", json={
            "address": email,
            "password": password
        })
        token = resp.json().get("token", "")
        
        return {"email": email, "password": password, "token": token}

async def get_messages(token: str) -> list:
    """Get messages for authenticated account."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{API}/messages", headers={
            "Authorization": f"Bearer {token}"
        })
        if resp.status_code >= 400:
            return []
        data = resp.json()
        return data.get("hydra:member", [])

async def get_message(msg_id: str, token: str) -> dict:
    """Get full message content."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{API}/messages/{msg_id}", headers={
            "Authorization": f"Bearer {token}"
        })
        return resp.json() if resp.status_code < 400 else {}

async def wait_for_otp(token: str, timeout: int = 120, poll_interval: int = 3) -> str:
    """Poll for OTP code. Returns 6-digit code."""
    otp_pattern = re.compile(r"\b(\d{6})\b")
    deadline = time.monotonic() + timeout
    
    while time.monotonic() < deadline:
        messages = await get_messages(token)
        for msg in messages:
            msg_id = msg.get("id")
            if not msg_id:
                continue
            full = await get_message(msg_id, token)
            # Check text and html body
            for key in ("text", "html"):
                body = full.get(key, "")
                if isinstance(body, str):
                    match = otp_pattern.search(body)
                    if match:
                        return match.group(1)
            # Also check from/subject for code
            subject = full.get("subject", "")
            match = otp_pattern.search(subject)
            if match:
                return match.group(1)
        
        await asyncio.sleep(poll_interval)
    
    raise Exception(f"No OTP received within {timeout}s")

# For use in novabox
def generate_email(domain: str = None) -> str:
    """Generate email — this is sync wrapper for compatibility."""
    import secrets
    return f"{secrets.token_hex(8)}@web-library.net"

async def fetch_messages(email: str, **kwargs) -> list:
    """Compatibility wrapper — needs token, but we'll create account first."""
    return []

async def wait_for_otp_compat(email: str, cfg) -> str:
    """Compatibility wrapper for novabox."""
    # Create account first
    prefix = email.split("@")[0]
    account = await create_account(prefix)
    return await wait_for_otp(account["token"], timeout=cfg.verify_poll_timeout)
