# YALI AMS

Alumni Management System for YALI Rwanda Chapter

---

## Tech Stack

- **Backend:** Node.js, Express, Prisma (MySQL/MariaDB)  
- **Frontend:** React, Next.js, Tailwind CSS  
- **Real-time:** Socket.IO (chat, group messages, and per-user notification events)
- **Queue:** BullMQ + Redis for background job processing
- **Other:** Node-cron for scheduled tasks
- **Cache:** Redis-backed response caching for reference data

---

## API Documentation

Interactive API documentation is available at `/api/docs` when the server is running.

### Authentication Endpoints

| Method | Endpoint | Description | Rate Limited |
|--------|----------|-------------|:------------:|
| POST | `/api/auth/login` | User login | Yes (10/15min) |
| POST | `/api/auth/logout` | User logout (auth required) | No |
| POST | `/api/auth/me/extend` | Extend an expiring session — re-issues a fresh 24h JWT while the presented token is still valid, not blocklisted, and the user is `ACTIVE` | No |
| POST | `/api/auth/change-pass` | Change password (auth required) | No |
| POST | `/api/auth/request-link` | Request password reset | Yes (10/15min) |
| POST | `/api/auth/reset-password` | Reset password with token | Yes (10/15min) |

### User Endpoints (Admin-only routes marked with 🔒)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/users` | List users with pagination (`page`, `limit`; default 100, max 1000, excludes passwords/tokens) | Any authenticated user |
| GET | `/api/users/:userId` | Get user by ID (excludes sensitive fields) | Any authenticated user |
| PUT | `/api/users/:userId` | Update user | 🔒 Admin only |
| DELETE | `/api/users/:userId` | Delete user | 🔒 Admin only |
| POST | `/api/users/profile` | Create user profile | Any authenticated user |
| POST | `/api/users/invite` | Invite user | 🔒 Admin only |
| POST | `/api/users/import` | Import users in the background — returns `202` + `jobId`, processed by the BullMQ `user-imports` queue (max 500 per batch) | 🔒 Admin only |
| POST | `/api/users/export/all` | Export all users to Excel (file auto-expires after 24h) | 🔒 Admin only |
| POST | `/api/users/role/:userId` | Change user role | 🔒 Admin only |

### Organization Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/organizations` | Get all organizations |
| GET | `/api/organizations/:id` | Get organization by ID |
| POST | `/api/organizations/new` | Create organization |
| PUT | `/api/organizations/update` | Update organization |

### Chat Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat` | Get public/community messages |
| POST | `/api/chat` | Send message (body: `{ senderId, receiverId, message }`; `receiverId` empty → public) |
| GET | `/api/chat/top` | Get top active members |
| GET | `/api/chat/:id` | Get a user's private chats |
| GET | `/api/chat/:id/:oid` | Get private messages between two users |
| GET | `/api/chat/group/all` | Get all groups |
| POST | `/api/chat/group/create` | Create group |
| GET | `/api/chat/group/:groupId` | Get group by ID |
| GET | `/api/chat/group/my/:userId` | Get groups the current user belongs to |
| POST | `/api/chat/group/messages/:groupId/:userId` | Send group message (auth user as sender) |
| GET | `/api/chat/group/messages/:groupId/:userId` | Get group messages (auth user verified as member) |
| GET | `/api/chat/group/get-members/:groupId` | Get group members |
| POST | `/api/chat/group/add-member/:groupId` | Add member to group |
| DELETE | `/api/chat/group/remove-member` | Remove member (body: groupId, userId; admin only) |
| POST | `/api/chat/group/join-request` | Request to join a group |
| POST | `/api/chat/group/approve-request/admin` | Admin approves a join request |
| POST | `/api/chat/group/approve-request/member` | Member accepts a group invitation |
| POST | `/api/chat/group/reject-request/:groupId` | Reject a join request |
| POST | `/api/chat/group/decline-request/:groupId` | Decline a group invitation |
| GET | `/api/chat/group/to-invite/:currentUserId/:activeGroupId` | List users available to invite to a group |

### Matchmaking Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/matchmaking/ai` | Submit an AI matchmaking request (processed asynchronously by BullMQ) |
| GET | `/api/matchmaking/history` | List the current user's past matchmaking requests |
| GET | `/api/matchmaking/status/:requestId` | Poll the status and matches of a request |

### Notification Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/notification/:userId` | Get a user's notifications (each row may carry an optional `link` used for action buttons) | Owner only |
| GET | `/api/notification/unopened/:userId` | Get a user's unopened notifications | Owner only |
| POST | `/api/notification` | Mark a notification as opened (body: `id`) | Owner only |
| GET | `/api/notification/update/setup` | List notification templates | 🔒 Admin only |
| GET | `/api/notification/update/setup/one/:usage` | Get a notification template by usage | 🔒 Admin only |
| PUT | `/api/notification/update/setup` | Update a notification template | 🔒 Admin only |

### Reference-Data Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data/genders` | List genders (cached) |
| GET | `/api/data/countries` | List countries (cached) |
| GET | `/api/data/states` | List states (cached) |
| GET | `/api/data/states/:countryId` | List states for a country (cached) |
| GET | `/api/data/districts` | List districts (cached) |
| GET | `/api/data/district/:districtId` | Get a district (cached) |
| GET | `/api/data/district/sector/:districtId` | List sectors for a district (cached) |
| GET | `/api/data/sectors` | List sectors (cached) |
| GET | `/api/data/sector/:sectorId` | Get a sector (cached) |
| GET | `/api/data/tracks` | List tracks |
| GET | `/api/data/working-sectors` | List working sectors |
| GET | `/api/data/cohorts` | List cohorts |

### Dashboard Statistics Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Aggregate counts (users, messages, unopened notifications, sent notifications) |
| GET | `/api/stats/activity-trend?days=7` | Daily message counts for the last N days (default 7, max 30); returns `{ data: [{ date, count }] }` with zero-filled days so the chart never has gaps |

---

## Security

### Authentication
- JWT tokens with 24-hour expiry; payload contains only user `id`
- **SECRET_KEY is required** — server refuses to start if the env var is missing
- All authenticated endpoints verify token against DB user status
- Only `ACTIVE` users can log in or connect via socket; `INACTIVE`/`INVITED` accounts are rejected (`403`) until activated
- Password reset tokens are validated against the stored `refreshToken` in the database; tokens are rejected on mismatch
- **Token revocation:** on logout and password change the JWT is added to a Redis blocklist (`jwt:blk:*` via `src/helpers/tokenStore.ts`) and rejected until its natural expiry, so"logged-out" tokens become useless immediately
- **Session extension:** `POST /api/auth/me/extend` verifies the presented bearer token is still valid, not blocklisted, and belongs to an `ACTIVE` user, then re-issues a fresh 24-hour JWT (persisted to the user row) so near-expiry sessions can continue without a full re-login

### Authorization (RBAC)
- `requireAuth` middleware on all `/api/*` routes except login, request-link, reset-password
- `requireAdmin` middleware on sensitive operations: user delete, update, role change, invite, import, export

### Rate Limiting
- Global API rate limiter: 100 requests / 15 min (configurable via env vars)
- Auth-specific rate limiter: 10 requests / 15 min on login, request-link, and reset-password
- Upload limiter: 30 uploads / 15 min per IP (configurable via `UPLOAD_RATE_LIMIT_*`)
- Per-socket rate limits on `join-group`/`send-message`/`join-matchmaking` events with sweep on disconnect (`src/helpers/socketRateLimit.ts`)

### Upload Security
- Uploads are authenticated, size-capped at 10 MB (`MAX_FILE_BYTES`), and restricted to a MIME whitelist (jpeg, png, webp, gif) — oversized uploads return `413`
- The file creator is taken from the authenticated JWT (`req.user.id`), never from the request body
- Uploaded temp files are always cleaned up, including on error paths

### Data Protection
- User queries exclude `password`, `token`, and `refreshToken` fields from all responses
- User IDs are server-generated (UUIDs); client-supplied IDs are ignored
- Group operations (send message, create group, remove member) use the authenticated user's ID from the JWT, not URL params or request body
- Activity logs are written asynchronously (fire-and-forget) with sanitized arguments and never block the request they audit
- DB credential logging removed

### Output Sanitization / XSS
- Notification and email content built from user-controlled CSV fields (names, group names) is HTML-escaped via `escapeHtml` before being stored or sent (import, invite, group join/invite emails)

### Socket Authentication
- Socket.IO connections are authenticated with the same JWT from `socket.handshake.auth.token` only (the query-parameter fallback was removed) via middleware in `src/sockets/index.ts`; unauthenticated or non-`ACTIVE` sockets are rejected
- Hardened limits: 200 KB max message buffer, `pingInterval: 25s` / `pingTimeout: 20s`, per-socket rate limiting, and message validation (non-empty, ≤ 4,000 chars) in both private and group sockets
- Each socket is joined to a per-user room (`user-<userId>`) so controllers can target individuals
- Public/community messages are broadcast to a dedicated `public` room instead of a global `io.emit`

---

## Performance Optimizations

- **Database Indexes:** Added indexes on frequently queried fields (cohortId, trackId, genderName, roleId, createdAt, etc.) to improve query performance
- **Connection Pool:** Connection pool size is configurable via `CONNECTION_LIMIT` and clamped to 5–50 (default 20) to prevent pool exhaustion under burst load
- **N+1 Query Fixes:** Optimized GroupChats, AIMatchmaking, and bulk-import controllers to use batch queries instead of sequential calls
- **Bulk Import:** the controller now only validates and enqueues — the heavy work runs in a dedicated BullMQ `user-imports` worker (concurrency 1). Inside the worker, reference tables (countries, districts, sectors, states, cohorts, tracks, working sectors) are loaded **once** into in-memory maps; existing emails are pre-checked with a single query, each user is created in **one** write (self-assigned UUID + inline reset token), and rows process in bounded batches of 10 with parallel side effects. A completion/failure notification is emitted to the requester (`requestedBy`)
- **Rate Limiting:** API rate limiting middleware protecting endpoints (100 requests/15 min default)
- **Background Jobs:** AI matchmaking requests and bulk user imports are processed asynchronously via BullMQ workers; outgoing emails share a dedicated BullMQ `emails` queue (concurrency 3, 3 attempts with exponential backoff, `sendEmail` returns before SMTP)
- **Response Compression:** `compression` middleware enabled globally for JSON/static responses
- **Redis Response Caching:** added a `getOrSet()` helper (`src/helpers/cache.ts`) with a 5-minute TTL; genders, cohorts, tracks, and working sectors are cached alongside the location/reference-data endpoints (countries, states, districts, sectors) and are invalidated on mutation. Falls back gracefully to the database if Redis is unreachable
- **Private Chat Pagination:** `GET /api/chat/:id` is paginated (default 200, max 500, newest-first) with parallel counts and a slimmer `select` instead of nested `include`
- **Deterministic Ordering:** Location/reference-data queries now use `orderBy: { name: "asc" }` for stable, predictable dropdown ordering

## Real-time Notifications

- **Socket.IO** is served on the **same HTTP server as the API** (`PORT`), at path `/ws/socket.io/` — there is no separate socket port. The legacy `HTTP_PORT` env var is unused.
- **Socket events:** the server emits `new-message`, `new-group-message`, and `notification:new` to per-user rooms (`user-<userId>`) and per-group rooms (`group-<groupId>`)
- **`src/sockets/notificationEmitter.ts`:** central emitter holding the Socket.IO instance; `setIO` captures it at startup and `getIO()` exposes it to controllers and BullMQ workers
- **Single-writer messaging:** messages are persisted once by the REST controllers (`sendMessage`, `sendGroupMessage`) and then broadcast over sockets via `getIO()` — the client no longer double-writes through socket handlers
- **Matchmaking lifecycle notifications:** "AI Matchmaking Started" on request creation, "AI Matchmaking Completed"/"Failed" from the BullMQ worker (both the in-job failure branches and the `worker.on("failed")` handler)
- **Profile update cron:** the hourly `generateProfileUpdateNotifications` job now stamps each notification (and the `notification:new` socket payload) with the template's `link`, so clients can render action buttons (e.g. confirm/decline the profile update)

## Email Delivery

- **Queue-first:** `sendEmail()` enqueues a BullMQ `emails` job and returns immediately — the HTTP request never waits on SMTP; if Redis is unavailable it falls back to a synchronous send
- **Hardened transport** (`src/helpers/mailer.ts`): single pooled transporter (max 3 connections, 50 messages each, 10s/10s/30s timeouts), `secure` derived from the port, and `EMAIL_FROM_NAME` configurable
- Every email includes a plain-text alternative; user-controlled fields are `escapeHtml`-escaped before interpolation
- **Exports** are uploaded to Cloudinary with a 24-hour `expires_at`, so exported PII does not persist publicly after download

---

## Database Migrations

Prisma migrations live in `prisma/migrations/`:

- `20260723001657_init` — baseline schema, including `MatchmakingRequest` and `MatchmakingItem` tables
- `20260731181755_init` — adds `MatchmakingItem` foreign keys to `User`/`Group`, indexes on `ActivityLog`, `State`, and `Organization`, and sets the `user.password` default to `''`
- `20260909000000_add_notification_link` — adds a nullable `link VARCHAR(500)` column to `Notifications` for notification action buttons

> **Note:** The `Organization_addedById` index rename is emitted as a RedefineIndex step. Because MySQL/MariaDB cannot `DROP INDEX` an index that backs a foreign key (error 1091), the migration drops the foreign key, creates the new index, then re-adds the foreign key constraint.

> **Note (case-sensitive filesystems):** On Linux MySQL/MariaDB (`lower_case_table_names=0`), `20260731181755_init` initially failed because it referenced tables as `user`/`organization` while they are created as `User`/`Organization`. The migration file was corrected to use the exact table case. If you run `migrate deploy` on a fresh database and hit the same error, apply the corrected SQL and mark the migration resolved.

> **Note:** The `migrate:dev` npm script passes `--name init`. Use `npm run migrate:noinit` (plain `prisma migrate dev`) for subsequent schema changes, or run `npx prisma migrate dev` directly.

## Prerequisites

- Node.js 18+
- MySQL or MariaDB 10.6+ (the app uses the `@prisma/adapter-mariadb` driver)
- Redis (required for BullMQ background jobs and response caching)

## Installation

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your database and Redis credentials (root password, DB name, etc.)

# Run database migrations
npx prisma migrate deploy

# Seed the database with reference data (genders, cohorts, roles, districts, sectors, countries, states, etc.)
npm run seed

# Start the server in development (hot reload via tsx watch)
npm run dev

# Or build and start for production
npm run build
npm start
```

---

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|:--------:|
| `PORT` | HTTP API server port (Socket.IO shares this port at `/ws/socket.io/`) | 9000 | No |
| `HTTP_PORT` | **Legacy/unused** — sockets are served on `PORT`, not a separate port | 4500 | No |
| `SECRET_KEY` | JWT signing secret (use a secure 64+ char random string for production) | - | **Yes** |
| `DATABASE_URL` | Prisma CLI connection string (MySQL) | - | Yes |
| `DATABASE_HOST` | MySQL/MariaDB host | 127.0.0.1 | Yes |
| `DATABASE_PORT` | MySQL/MariaDB port | 3306 | No |
| `DATABASE_USER` | Database username | - | Yes |
| `DATABASE_PASSWORD` | Database password | - | Yes |
| `DATABASE_NAME` | Database name | - | Yes |
| `CONNECTION_LIMIT` | Database connection pool size (clamped to 5–50) | 20 | No |
| `EMAIL_HOST` | SMTP host for outgoing email | - | No |
| `EMAIL_PORT` | SMTP port | 465 | No |
| `EMAIL_USERNAME` | SMTP username | - | No |
| `EMAIL_PASSWORD` | SMTP password | - | No |
| `EMAIL_FROM_NAME` | From-name used on outgoing emails | - | No |
| `CLOUDINARY_NAME` | Cloudinary cloud name | - | No |
| `CLOUDINARY_KEY` | Cloudinary API key | - | No |
| `CLOUDINARY_SECRET` | Cloudinary API secret | - | No |
| `GEMINI_KEY` | Google Gemini API key | - | No |
| `REDIS_URL` | Redis connection URL | redis://localhost:6379 | No |
| `FRONTEND_URL` | Frontend URL for notification links | - | No |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (or `*` for development only) | - | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | 900000 (15 min) | No |
| `RATE_LIMIT_MAX` | Max requests per window | 100 | No |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Auth rate limit window (ms) | 900000 | No |
| `AUTH_RATE_LIMIT_MAX` | Max auth requests per window | 10 | No |
| `UPLOAD_RATE_LIMIT_WINDOW_MS` | Upload rate limit window (ms) | 900000 | No |
| `UPLOAD_RATE_LIMIT_MAX` | Max uploads per window | 30 | No |

---

## Redis

Redis powers the following features: **BullMQ** background jobs (AI matchmaking, bulk user imports, and the outgoing-email queue), **JWT token revocation** (`src/helpers/tokenStore.ts`), and **response caching** for reference data (`src/helpers/cache.ts`, 5-minute TTL). The app falls back gracefully if Redis is unreachable — email sends become synchronous, the token blocklist is skipped (stale tokens may survive until JWT expiry), caching re-reads the DB, and queued jobs are disabled — so the server still boots without it, but caching, revocation, and queue throughput are degraded.

Quick setup on Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y redis-server

# Verify it is running
redis-cli ping   # -> PONG

# Optional: enable auto-start on boot
sudo systemctl enable redis-server
```

Redis binds to `127.0.0.1:6379` by default, which matches the `REDIS_URL` default (`redis://localhost:6379`). For production, secure Redis with a password (`requirepass` in `/etc/redis/redis.conf`) and point `REDIS_URL` at it, e.g. `redis://:yourpassword@127.0.0.1:6379`.

---

## Disclaimer

This project is developed and maintained by **Ubunifu Labs**.  
The software is provided "as is" without any warranties of any kind. Use at your own risk. Ubunifu Labs is not responsible for any issues, data loss, or damages that may occur from using this software.