# YALI AMS

Alumni Management System for YALI Rwanda Chapter

---

## Tech Stack

- **Backend:** Node.js, Express, Prisma, MySQL  
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
| GET | `/api/chat` | Get messages |
| POST | `/api/chat` | Send message |
| GET | `/api/chat/group/all` | Get all groups |
| POST | `/api/chat/group/create` | Create group |
| GET | `/api/chat/group/:groupId` | Get group by ID |
| GET | `/api/chat/group/my` | Get current user's groups |
| POST | `/api/chat/group/messages/:groupId` | Send group message (auth user as sender) |
| GET | `/api/chat/group/messages/:groupId` | Get group messages (auth user verified as member) |
| DELETE | `/api/chat/group/remove-member` | Remove member (body: groupId, userId; admin only) |

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

### Known Limitations
- No input validation library (Zod or similar) — validate inputs at the API boundary before adding untrusted data
- Socket.IO connections have no auth middleware

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

- **Socket events:** the server emits `new-message`, `new-group-message`, and `notification:new` to per-user rooms (`user-<userId>`)
- **`src/sockets/notificationEmitter.ts`:** central emitter that creates a `Notifications` row and broadcasts it via `notification:new`; the Socket.IO instance is captured by `setIO` so controllers and BullMQ workers can emit without holding a reference to the server
- **Matchmaking lifecycle notifications:** "AI Matchmaking Started" on request creation, "AI Matchmaking Completed"/"Failed" from the BullMQ worker (both the in-job failure branches and the `worker.on("failed")` handler)
- **Profile update cron:** the hourly `generateProfileUpdateNotifications` job now emits a `notification:new` refetch signal to affected users

---

## Installation

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your database and Redis credentials

# Run database migrations
npx prisma migrate deploy

# Start the server
npm start
```

---

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|:--------:|
| `SECRET_KEY` | JWT signing secret | - | **Yes** |
| `DATABASE_HOST` | MySQL database host | - | Yes |
| `DATABASE_PORT` | MySQL port | 3306 | No |
| `DATABASE_USER` | Database username | - | Yes |
| `DATABASE_PASSWORD` | Database password | - | Yes |
| `DATABASE_NAME` | Database name | - | Yes |
| `CONNECTION_LIMIT` | Database connection pool size | 20 | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | 900000 (15 min) | No |
| `RATE_LIMIT_MAX` | Max requests per window | 100 | No |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Auth rate limit window (ms) | 900000 | No |
| `AUTH_RATE_LIMIT_MAX` | Max auth requests per window | 10 | No |
| `REDIS_URL` | Redis connection URL | redis://localhost:6379 | No |
| `GEMINI_KEY` | Google Gemini API key | - | No |
| `FRONTEND_URL` | Frontend URL for notifications | - | No |

---

## Disclaimer

This project is developed and maintained by **Ubunifu Labs**.  
The software is provided "as is" without any warranties of any kind. Use at your own risk. Ubunifu Labs is not responsible for any issues, data loss, or damages that may occur from using this software.