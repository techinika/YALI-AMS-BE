// src/middleware/activityLoggerExtension.ts

import { Prisma } from "@prisma/client";
import { getUserId } from "../helpers/prisma-context";
import prisma from "../helpers/prismaClient";

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
        } catch (e) {}
      }

      // Execute the actual operation
      try {
        result = await query(args);
      } catch (err) {
        error = err;
      }

      // Only log mutations, and do NOT log ActivityLog mutations
      if (isMutation && !isActivityLogWrite) {
        try {
          const recordId =
            result?.id || args?.where?.id || args?.data?.id || null;

          // Only log changed fields for update
          let changedFields: Record<string, any> = {};

          if (beforeData && args?.data) {
            Object.keys(args.data).forEach((key) => {
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
                args,
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
