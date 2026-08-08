# TempMail API Endpoints (ikona-oni.com)

## Source
- **Website:** https://ikona-oni.com/TempMail/
- **API Base:** `https://tempmail-worker.hasildia1.workers.dev`
- **Backend:** Cloudflare Worker
- **Database:** Supabase (project: spdjcdudscoqcxlytcbx)

## Public Endpoints (No Auth Required)

### Health Check
```
GET /health
Response: { "success": true, "data": { "status": "ok", "service": "TempMail", "version": "1.0.0" } }
```

### Service Info
```
GET /domains
Response: { "success": true, "data": { "service": "TempMail API", "version": "1.0.0", "docs": "/health" } }
```

### Check Inbox (Public)
```
GET /inbox/{email_address}
Example: GET /inbox/test@merapi92338.my.id
Response: { "success": true, "data": { "address": "test@merapi92338.my.id", "emails": [], "count": 0 } }
```

### View Email (Public)
```
GET /view/{email_id}
Returns: HTML content of the email
```

## Authenticated Endpoints (Require JWT Token)

### Login
```
POST /auth/login
Body: { "username": "...", "password": "..." }
Response: { "token": "jwt_token_here" }
```

### Generate Email
```
POST /api/generate
Headers: { "Authorization": "Bearer <token>" }
Response: { "success": true, "data": { "email": "random@domain.com" } }
```

## Admin Endpoints (Require Admin JWT Token)

### Stats
```
GET /admin/stats
Headers: { "Authorization": "Bearer <admin_token>" }
```

### Accounts Management
```
GET /admin/accounts                    # List all accounts
POST /admin/accounts                   # Create account
DELETE /admin/accounts/{id}            # Delete account
```

### Domains Management
```
GET /admin/domains                     # List all domains
POST /admin/domains                    # Create domain
PUT /admin/domains/{id}               # Update domain
DELETE /admin/domains/{id}            # Delete domain
```

### Domain Assignments
```
GET /admin/domains/{domainId}/assignments      # List assignments
POST /admin/domains/{domainId}/assignments     # Create assignment
DELETE /admin/domains/{domainId}/assignments/{accountId}  # Delete assignment
```

## Known Domains (from HTML source)
- `merapi92338.my.id` (hardcoded in frontend)
- Dynamic domains fetched from Supabase `domains` table

## Supabase Config (for dynamic domains)
```
URL: https://spdjcdudscoqcxlytcbx.supabase.co
API Key (anon): eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZGpjZHVkc2NvcWN4bHl0Y2J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MjgyNDcsImV4cCI6MjA5MDEwNDI0N30.uBXPKlFxNZ9eJzaAXqtBCZSfKXBSPqa4Ee9EnRHxMb8
Table: domains
```

## Usage Example (Node.js)
```javascript
const API_BASE = 'https://tempmail-worker.hasildia1.workers.dev';

// Generate email (needs auth)
const genRes = await fetch(`${API_BASE}/api/generate`, {
  method: 'POST',
  headers: { 'Authorization': 'Bearer <token>' }
});
const { data: { email } } = await genRes.json();

// Check inbox (public)
const inboxRes = await fetch(`${API_BASE}/inbox/${encodeURIComponent(email)}`);
const { data: { emails } } = await inboxRes.json();

// View email content
// Navigate to: ${API_BASE}/view/${email_id}
```

## Notes
- Emails auto-deleted after 6 hours
- Inbox check is PUBLIC (no auth needed)
- Generate email requires authentication
- Admin endpoints require admin role JWT
- JWT stored in localStorage as `tm_token`
- Frontend uses Supabase for dynamic domain list
