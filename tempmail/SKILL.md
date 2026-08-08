# TempMail Skill — ikona-oni.com

## Overview
Scraped API from https://ikona-oni.com/TempMail/ — disposable email service powered by Cloudflare Worker + Supabase.

## API Base
```
https://tempmail-worker.hasildia1.workers.dev
```

## Quick Usage

### Cek Inbox (PUBLIC — gak perlu auth!)
```bash
curl -s 'https://tempmail-worker.hasildia1.workers.dev/inbox/yourname@merapi92338.my.id' | python3 -m json.tool
```

### View Email Content
```bash
# Buka di browser:
https://tempmail-worker.hasildia1.workers.dev/view/{email_id}
```

### Generate Email (Butuh Auth)
```bash
# Step 1: Login
TOKEN=$(curl -s -X POST 'https://tempmail-worker.hasildia1.workers.dev/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"username":"***","password":"***"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Step 2: Generate
curl -s -X POST 'https://tempmail-worker.hasildia1.workers.dev/api/generate' \
  -H "Authorization: $TOKEN"
```

### Health Check
```bash
curl -s 'https://tempmail-worker.hasildia1.workers.dev/health'
```

## All Endpoints

### Public (No Auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/domains` | Service info |
| GET | `/inbox/{email}` | Check inbox emails |
| GET | `/view/{id}` | View email HTML content |

### Authenticated
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login → JWT token |
| POST | `/api/generate` | Generate random temp email |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/stats` | Dashboard stats |
| GET | `/admin/accounts` | List accounts |
| POST | `/admin/accounts` | Create account |
| DELETE | `/admin/accounts/{id}` | Delete account |
| GET | `/admin/domains` | List domains |
| POST | `/admin/domains` | Create domain |
| PUT | `/admin/domains/{id}` | Update domain |
| DELETE | `/admin/domains/{id}` | Delete domain |
| GET | `/admin/domains/{id}/assignments` | List domain assignments |
| POST | `/admin/domains/{id}/assignments` | Create assignment |
| DELETE | `/admin/domains/{id}/assignments/{accId}` | Delete assignment |

## Known Domains
- `merapi92338.my.id` (hardcoded in frontend)
- Dynamic domains from Supabase `domains` table

## Supabase Config
```
Project: spdjcdudscoqcxlytcbx.supabase.co
Table: domains
```

## Automation Script

```javascript
// tempmail-check.js — Auto-check inbox for an email
const API_BASE = 'https://tempmail-worker.hasildia1.workers.dev';

async function checkInbox(email) {
  const res = await fetch(`${API_BASE}/inbox/${encodeURIComponent(email)}`);
  const json = await res.json();
  return json.data.emails || [];
}

async function waitForEmail(email, timeout = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const emails = await checkInbox(email);
    if (emails.length > 0) return emails;
    await new Promise(r => setTimeout(r, 5000));
  }
  return [];
}

// Usage:
// const emails = await waitForEmail('user@merapi92338.my.id');
```

## Notes
- ⚡ Inbox check is PUBLIC — no auth needed to read emails
- 🔒 Generate needs auth token
- ⏰ Emails auto-deleted after 6 hours
- 🌐 Uses Cloudflare Worker backend
- 💾 Dynamic domains stored in Supabase

## Use Cases
1. **Account registration** — Generate temp email, register, check inbox for verification
2. **Automation** — Public inbox API = easy integration with scripts
3. **Testing** — Quick disposable emails for testing flows
