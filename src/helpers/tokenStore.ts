import crypto from "crypto";
import jwt from "jsonwebtoken";
import { redisGet, redisSetex } from "./cache";

const BLACKLIST_PREFIX = "jwt:blk:";

const tokenKey = (token: string): string =>
  `${BLACKLIST_PREFIX}${crypto.createHash("sha256").update(token).digest("hex")}`;

export const revokeToken = async (token?: string): Promise<void> => {
  if (!token) return;

  const decoded = jwt.decode(token) as { exp?: number } | null;
  const nowSec = Math.floor(Date.now() / 1000);
  const remainingSec = decoded?.exp ? decoded.exp - nowSec : 0;

  if (remainingSec > 0) {
    await redisSetex(tokenKey(token), remainingSec, "1");
  }
};

export const isTokenRevoked = async (token: string): Promise<boolean> => {
  if (!token) return true;
  try {
    const value = await redisGet(tokenKey(token));
    return value === "1";
  } catch {
    return false;
  }
};