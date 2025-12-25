// src/lib/prisma-context.ts
import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  userId?: string;
}

export const prismaContext = new AsyncLocalStorage<RequestContext>();

export const getUserId = () => prismaContext.getStore()?.userId ?? "system";
