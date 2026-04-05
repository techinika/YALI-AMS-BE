# YALI AMS

Alumni Management System for YALI Rwanda Chapter

---

## Tech Stack

- **Backend:** Node.js, Express, Prisma, MySQL  
- **Frontend:** React, Next.js, Tailwind CSS  
- **Real-time:** Socket.IO  
- **Queue:** BullMQ + Redis for background job processing
- **Other:** Node-cron for scheduled tasks  

---

## Performance Optimizations

- **Database Indexes:** Added indexes on frequently queried fields (cohortId, trackId, genderName, roleId, createdAt, etc.) to improve query performance
- **Connection Pool:** Increased default connection pool size from 5 to 20 for better concurrency
- **N+1 Query Fixes:** Optimized GroupChats and AIMatchmaking controllers to use batch queries instead of sequential calls
- **Rate Limiting:** API rate limiting middleware protecting endpoints (100 requests/15 min default)
- **Background Jobs:** AI matchmaking requests are processed asynchronously via BullMQ workers

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_HOST` | MySQL database host | - |
| `DATABASE_PORT` | MySQL port | 3306 |
| `DATABASE_USER` | Database username | - |
| `DATABASE_PASSWORD` | Database password | - |
| `DATABASE_NAME` | Database name | - |
| `CONNECTION_LIMIT` | Database connection pool size | 20 |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | 900000 (15 min) |
| `RATE_LIMIT_MAX` | Max requests per window | 100 |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Auth rate limit window (ms) | 900000 |
| `AUTH_RATE_LIMIT_MAX` | Max auth requests per window | 10 |
| `REDIS_URL` | Redis connection URL | redis://localhost:6379 |
| `GEMINI_KEY` | Google Gemini API key | - |
| `FRONTEND_URL` | Frontend URL for notifications | - |

---

## Disclaimer

This project is developed and maintained by **Ubunifu Labs**.  
The software is provided "as is" without any warranties of any kind. Use at your own risk. Ubunifu Labs is not responsible for any issues, data loss, or damages that may occur from using this software.

