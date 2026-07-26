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

      let beforeData: any = null;
      let result: any = null;
      let error: any = null;

      if (isMutation && ["update", "delete"].includes(operation) && model) {
        try {
          const where = (args as any)?.where;
          if (where?.id) {
            beforeData = await (this as any)[model].findUnique({
              where: { id: where.id },
            });
          }
        } catch (e) {
          console.error("Failed to fetch beforeData for activity log:", e);
        }
      }

      try {
        result = await query(args);
      } catch (err) {
        error = err;
      }

      if (isMutation && !isActivityLogWrite) {
        try {
          const recordId =
            result?.id || args?.where?.id || args?.data?.id || null;

          let changedFields: Record<string, any> = {};

          if (beforeData && args?.data) {
            Object.keys(args.data).forEach((key) => {
              if (SENSITIVE_FIELDS.has(key)) return;
              if (beforeData[key] !== (args.data as any)[key]) {
                changedFields[key] = {
                  before: beforeData[key],
                  after: (args.data as any)[key],
                };
              }
            });
          }

          await prisma.activityLog.create({
            data: {
              model: model!,
              action: error ? `${operation}_failed` : operation,
              recordId: recordId ? String(recordId) : null,
              userId: getUserId(),
              details: {
                args: sanitizeArgs(args),
                changedFields,
                error: error ? String(error.message ?? error) : null,
              },
            },
          });
        } catch (logError) {
          console.error("Activity logging failed:", logError);
        }
      }

      if (error) throw error;
      return result;
    },
  },
});
