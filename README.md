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
| POST | `/api/auth/change-pass` | Change password (auth required) | No |
| POST | `/api/auth/request-link` | Request password reset | Yes (10/15min) |
| POST | `/api/auth/reset-password` | Reset password with token | Yes (10/15min) |

### User Endpoints (Admin-only routes marked with 🔒)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/users` | Get all users (excludes passwords/tokens) | Any authenticated user |
| GET | `/api/users/:userId` | Get user by ID (excludes sensitive fields) | Any authenticated user |
| PUT | `/api/users/:userId` | Update user | 🔒 Admin only |
| DELETE | `/api/users/:userId` | Delete user | 🔒 Admin only |
| POST | `/api/users/profile` | Create user profile | Any authenticated user |
| POST | `/api/users/invite` | Invite user | 🔒 Admin only |
| POST | `/api/users/import` | Import users | 🔒 Admin only |
| POST | `/api/users/export/all` | Export all users | Any authenticated user |
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
| GET | `/api/notification/:userId` | Get a user's notifications | Owner only |
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

---

## Security

### Authentication
- JWT tokens with 24-hour expiry; payload contains only user `id`
- **SECRET_KEY is required** — server refuses to start if the env var is missing
- All authenticated endpoints verify token against DB user status
- Password reset tokens are validated against the stored `refreshToken` in the database; revoked tokens are rejected

### Authorization (RBAC)
- `requireAuth` middleware on all `/api/*` routes except login, request-link, reset-password
- `requireAdmin` middleware on sensitive operations: user delete, update, role change, invite, import

### Rate Limiting
- Global API rate limiter: 100 requests / 15 min (configurable via env vars)
- Auth-specific rate limiter: 10 requests / 15 min on login, request-link, and reset-password

### Data Protection
- User queries exclude `password`, `token`, and `refreshToken` fields from all responses
- User IDs are server-generated (UUIDs); client-supplied IDs are ignored
- Group operations (send message, create group, remove member) use the authenticated user's ID from the JWT, not URL params or request body
- DB credential logging removed

### Socket Authentication
- Socket.IO connections are authenticated with the same JWT (`socket.handshake.auth.token` or `socket.handshake.query.token`) via middleware in `src/sockets/index.ts`; unauthenticated sockets are rejected
- Each socket is joined to a per-user room (`user-<userId>`) so controllers can target individuals

---

## Performance Optimizations

- **Database Indexes:** Added indexes on frequently queried fields (cohortId, trackId, genderName, roleId, createdAt, etc.) to improve query performance
- **Connection Pool:** Increased default connection pool size from 5 to 20 for better concurrency
- **N+1 Query Fixes:** Optimized GroupChats and AIMatchmaking controllers to use batch queries instead of sequential calls
- **Rate Limiting:** API rate limiting middleware protecting endpoints (100 requests/15 min default)
- **Background Jobs:** AI matchmaking requests are processed asynchronously via BullMQ workers
- **Redis Response Caching:** Added a `getOrSet()` helper (`src/helpers/cache.ts`) with a 5-minute TTL; all 7 location/reference-data endpoints (countries, states, districts, sectors) are cached and return results ordered by name. Falls back gracefully to the database if Redis is unreachable
- **Deterministic Ordering:** Location/reference-data queries now use `orderBy: { name: "asc" }` for stable, predictable dropdown ordering

## Real-time Notifications

- **Socket.IO** is served on the **same HTTP server as the API** (`PORT`), at path `/ws/socket.io/` — there is no separate socket port. The legacy `HTTP_PORT` env var is unused.
- **Socket events:** the server emits `new-message`, `new-group-message`, and `notification:new` to per-user rooms (`user-<userId>`) and per-group rooms (`group-<groupId>`)
- **`src/sockets/notificationEmitter.ts`:** central emitter holding the Socket.IO instance; `setIO` captures it at startup and `getIO()` exposes it to controllers and BullMQ workers
- **Single-writer messaging:** messages are persisted once by the REST controllers (`sendMessage`, `sendGroupMessage`) and then broadcast over sockets via `getIO()` — the client no longer double-writes through socket handlers
- **Matchmaking lifecycle notifications:** "AI Matchmaking Started" on request creation, "AI Matchmaking Completed"/"Failed" from the BullMQ worker (both the in-job failure branches and the `worker.on("failed")` handler)
- **Profile update cron:** the hourly `generateProfileUpdateNotifications` job now emits a `notification:new` refetch signal to affected users

---

## Database Migrations

Prisma migrations live in `prisma/migrations/`:

- `20260723001657_init` — baseline schema, including `MatchmakingRequest` and `MatchmakingItem` tables
- `20260731181755_init` — adds `MatchmakingItem` foreign keys to `User`/`Group`, indexes on `ActivityLog`, `State`, and `Organization`, and sets the `user.password` default to `''`

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
| `CONNECTION_LIMIT` | Database connection pool size | 100 | No |
| `EMAIL_HOST` | SMTP host for outgoing email | - | No |
| `EMAIL_PORT` | SMTP port | 465 | No |
| `EMAIL_USERNAME` | SMTP username | - | No |
| `EMAIL_PASSWORD` | SMTP password | - | No |
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

---

## Redis

Redis powers two features: **BullMQ** background jobs (AI matchmaking) and **response caching** for reference data (`src/helpers/cache.ts`, 5-minute TTL). The app falls back to the database gracefully if Redis is unreachable, so the server still boots without it — but caching and queued jobs are disabled.

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