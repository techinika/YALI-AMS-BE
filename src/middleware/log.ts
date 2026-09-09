// src/middleware/activityLoggerExtension.ts

import { Prisma } from "@prisma/client";
import { getUserId } from "../helpers/prisma-context";
import prisma from "../helpers/prismaClient";

const SENSITIVE_FIELDS = new Set([
  "password",
  "refreshToken",
  "token",
  "secret",
  "SECRET_KEY",
  "EMAIL_PASSWORD",
  "CLOUDINARY_SECRET",
]);

function sanitizeArgs(args: any): any {
  if (!args || typeof args !== "object") return args;

  const sanitized = { ...args };

  if (sanitized.data && typeof sanitized.data === "object") {
    const cleanData = { ...sanitized.data };
    for (const key of Object.keys(cleanData)) {
      if (SENSITIVE_FIELDS.has(key)) {
        cleanData[key] = "[REDACTED]";
      }
    }
    sanitized.data = cleanData;
  }

  return sanitized;
}

export const activityLoggerExtension = Prisma.defineExtension({
  name: "activity-logger",

  query: {
    async $allOperations({
      model,
      operation,
      args,
      query,
    }: {
      model?: string;
      operation: string;
      args: any;
      query: (args: any) => Prisma.PrismaPromise<any>;
    }) {
      const isMutation = ["create", "update", "delete"].includes(operation);
      const isActivityLogWrite = model === "ActivityLog";

      let result: any = null;
      let error: any = null;

      try {
        result = await query(args);
      } catch (err) {
        error = err;
      }

      if (isMutation && !isActivityLogWrite) {
        const recordId =
          result?.id || args?.where?.id || args?.data?.id || null;

        // Fire-and-forget: never block the request path on audit logging.
        prisma.activityLog
          .create({
            data: {
              model: model!,
              action: error ? `${operation}_failed` : operation,
              recordId: recordId ? String(recordId) : null,
              userId: getUserId(),
              details: {
                args: sanitizeArgs(args),
                error: error ? String(error.message ?? error) : null,
              },
            },
          })
          .catch((logError) => {
            console.error("Activity logging failed:", logError);
          });
      }

      if (error) throw error;
      return result;
    },
  },
});