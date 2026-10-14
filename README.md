# Eurotrans Express — Backend

Node.js + Express + MongoDB Atlas backend for the Eurotrans Express shipping website.
Provides admin auth (JWT), parcel registration, status tracking, and a public tracking API.

## Tech Stack

- Node.js (CommonJS)
- Express.js
- MongoDB Atlas + Mongoose
- JWT (jsonwebtoken)
- bcryptjs
- helmet, cors, express-rate-limit
- dotenv

## Folder Structure

```
eurotransbackend/
├── config/db.js
├── controllers/
│   ├── authController.js
│   └── parcelController.js
├── middleware/
│   ├── authMiddleware.js
│   ├── errorHandler.js
│   └── rateLimiters.js
├── models/
│   ├── Admin.js
│   └── Parcel.js
├── routes/
│   ├── authRoutes.js
│   └── parcelRoutes.js
├── scripts/createAdmin.js
├── utils/trackingCode.js
├── .env               (not committed)
├── .env.example
├── .gitignore
├── package.json
└── server.js
```

## Setup

```bash
npm install
cp .env.example .env   # then edit .env
npm run create-admin -- --email admin@example.com --password "StrongPass123" --setup-secret <ADMIN_SETUP_SECRET>
npm run dev
```

## Environment Variables (backend only)

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development` / `production` |
| `PORT` | Server port (default 5000) |
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Long random string (≥32 chars) |
| `JWT_EXPIRES_IN` | e.g. `1d` |
| `ADMIN_SETUP_SECRET` | One-time secret for admin script |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins |

**Frontend (Vite) uses only:**
- `VITE_API_URL` — backend base URL, e.g. `https://eurotrans-backend.onrender.com`

⚠️ **Never** put `MONGO_URI`, `JWT_SECRET`, or any backend secret in a `VITE_*` variable.

## API Reference

### Public

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | Admin login (rate limited) |
| GET | `/api/track/:code` | Public parcel tracking (rate limited) |

### Protected (Bearer token required)

| Method | Path | Description |
|---|---|---|
| GET | `/api/auth/me` | Current admin |
| POST | `/api/parcels` | Register parcel |
| GET | `/api/parcels` | List/search parcels (`?page=&limit=&status=&q=`) |
| GET | `/api/parcels/:id` | Get single parcel |
| PATCH | `/api/parcels/:id/status` | Update status (`Registered`, `In Transit`, `Out for Delivery`, `Delivered`, `On Hold`) |

## Postman / Thunder Client Test Plan

### 1. Health
```
GET http://localhost:5000/api/health
=> 200 { success: true, db: "connected" }
```

### 2. Login (success)
```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{ "email": "admin@example.com", "password": "StrongPass123" }
=> 200 { success: true, token: "<jwt>", admin: { ... } }
```
Save the `token`.

### 3. Login (wrong password)
```
=> 401 { success: false, message: "Invalid email or password" }
```

### 4. Login (missing fields)
```
=> 400 { success: false, message: "Email and password are required" }
```

### 5. Brute-force protection
Fire 11 bad logins quickly.
```
=> 11th returns 429 { success: false, message: "Too many login attempts..." }
```

### 6. GET /me (with token)
```
GET http://localhost:5000/api/auth/me
Authorization: Bearer <token>
=> 200 { success: true, admin: { ... } }
```

### 7. GET /me without token
```
=> 401 { success: false, message: "Authorization token missing" }
```

### 8. GET /me with bad token
```
=> 401 { success: false, message: "Invalid authentication token" }
```

### 9. Create parcel
```
POST http://localhost:5000/api/parcels
Authorization: Bearer <token>
Content-Type: application/json

{
  "sender":    { "name": "Ali",    "phone": "0300-1234567", "city": "Karachi", "country": "PK" },
  "recipient": { "name": "Sara",   "phone": "0300-7654321", "city": "Lahore",  "country": "PK" },
  "origin": "Karachi",
  "destination": "Lahore",
  "parcelType": "Documents",
  "serviceType": "Express",
  "weightKg": 0.5,
  "pieces": 1,
  "description": "Urgent documents",
  "note": "Received at counter"
}
=> 201 { success: true, parcel: { trackingCode: "ETX-XXXXXXXXXX", ... } }
```
Copy the `trackingCode`.

### 10. Create parcel without token
```
=> 401
```

### 11. Create parcel with invalid sender
```
{ "sender": {}, "recipient": {...}, "origin": "A", "destination": "B" }
=> 400 { success: false, message: "Valid sender is required" }
```

### 12. List parcels
```
GET http://localhost:5000/api/parcels?page=1&limit=10
Authorization: Bearer <token>
=> 200 { success: true, items: [...], total, page, pages }
```

### 13. Search parcels
```
GET http://localhost:5000/api/parcels?q=Lahore
=> 200 { ... }
```

### 14. List with invalid status filter
```
GET http://localhost:5000/api/parcels?status=Flying
=> 400 { success: false, message: "Invalid status filter" }
```

### 15. Get single parcel
```
GET http://localhost:5000/api/parcels/<id>
Authorization: Bearer <token>
=> 200 { success: true, parcel: {...} }
```

### 16. Invalid ObjectId
```
GET http://localhost:5000/api/parcels/not-a-real-id
=> 400 { success: false, message: "Invalid identifier format" }
```

### 17. Update status
```
PATCH http://localhost:5000/api/parcels/<id>/status
Authorization: Bearer <token>
Content-Type: application/json

{ "status": "In Transit", "note": "Left Karachi hub" }
=> 200 { success: true, parcel: { status: "In Transit", history: [...] } }
```

### 18. Invalid status
```
{ "status": "Lost" }
=> 400 { success: false, message: "Status must be one of: ..." }
```

### 19. Public tracking (success)
```
GET http://localhost:5000/api/track/<trackingCode>
=> 200 { success: true, trackingCode, status, origin, destination, history, recipient: { name, city, country } }
```

**Verify** response has **NO** `sender`, **NO** `recipient.phone`, **NO** `recipient.email`, **NO** `recipient.address`.

### 20. Public tracking (not found)
```
GET http://localhost:5000/api/track/ETX-NOTEXIST00
=> 404 { success: false, message: "No shipment found for this code" }
```

### 21. Public tracking (bad code format)
```
GET http://localhost:5000/api/track/xx
=> 400 { success: false, message: "Invalid tracking code" }
```

### 22. 404 unknown route
```
GET http://localhost:5000/api/nope
=> 404 { success: false, message: "Route not found: GET /api/nope" }
```

## Frontend Integration (React + Vite)

Create a small API client in the frontend:

```js
// src/lib/api.js
const API_URL = import.meta.env.VITE_API_URL;

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}
```

Frontend `.env` (Vercel environment variable):
```
VITE_API_URL=https://eurotrans-backend.onrender.com
```

**Token storage:** `localStorage` is simplest but is vulnerable to XSS. For a small admin panel it's acceptable if the frontend has no user-generated HTML. If you need stronger security, switch to HttpOnly cookie + CSRF token — this requires a small backend change.

## Deployment (Render)

1. Push backend to GitHub (ensure `.env` is NOT committed).
2. Render → New Web Service → connect repo.
3. Build command: `npm install`
4. Start command: `node server.js`
5. Environment variables on Render dashboard:
   - `NODE_ENV=production`
   - `PORT=10000` (or leave — Render sets it)
   - `MONGO_URI=<atlas uri>`
   - `JWT_SECRET=<long random>`
   - `JWT_EXPIRES_IN=1d`
   - `CORS_ORIGINS=https://eurotrans-express.vercel.app`
   - *(remove `ADMIN_SETUP_SECRET` after initial admin creation)*
6. After first deploy, run the create-admin command locally pointing at the **production** DB **once**, or use Render's shell:
   ```
   node scripts/createAdmin.js --email ... --password ... --setup-secret ...
   ```
   Then **unset** `ADMIN_SETUP_SECRET` on Render.

7. MongoDB Atlas → Network Access → allow Render's outbound IPs (or `0.0.0.0/0` if you must, but prefer specific IPs).

## Security Checklist (already implemented)

- [x] Passwords hashed with bcrypt (cost 12), never stored plain
- [x] `passwordHash` field `select: false` by default
- [x] JWT signed with `JWT_SECRET`, verified on every protected request
- [x] Admin re-fetched from DB on each request (not trusted from token alone)
- [x] No public admin signup route
- [x] One-time `ADMIN_SETUP_SECRET` for initial admin
- [x] Rate limiting on login + public tracking
- [x] helmet security headers
- [x] CORS restricted to allowlist
- [x] Body size limit `100kb`
- [x] Unique DB indexes on `trackingCode` and `shipmentId`
- [x] Duplicate-key errors handled
- [x] Public tracking returns only safe fields (no phone/email/full address)
- [x] ReDoS-safe search (regex escaped)
- [x] Production errors hide stack traces
- [x] No secrets in logs

## Known Limitations / Not Included

- No SMS / email / WhatsApp notifications
- No barcode / label printing
- No live GPS / driver tracking
- No third-party courier API integrations
- No online payments
- No multi-branch / advanced user management
- No frontend admin UI (separate task)

---

Prepared by CodePulse — Web Development and Digital Solutions