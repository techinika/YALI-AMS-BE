import IORedis from "ioredis";

const DEFAULT_TTL = 300;

const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  lazyConnect: true,
});

redis.on("error", (err) => {
  console.warn("Redis cache unavailable, falling through:", err.message);
});

export async function getOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL,
): Promise<T> {
  try {
    if (redis.status === "ready") {
      const cached = await redis.get(key);
      if (cached) return JSON.parse(cached) as T;
    }
  } catch {}
  const data = await fetcher();
  try {
    if (redis.status === "ready") {
      await redis.setex(key, ttl, JSON.stringify(data));
    }
  } catch {}
  return data;
}

export async function invalidate(key: string) {
  try {
    if (redis.status === "ready") {
      await redis.del(key);
    }
  } catch {}
}

export async function connectCache() {
  try {
    await redis.connect();
  } catch {
    console.warn("Could not connect to Redis, caching disabled");
  }
}
