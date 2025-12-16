import { Prisma, PrismaClient } from "@prisma/client";

export const attachActivityLogger = (prisma: PrismaClient) => {
  prisma.$use(async (params: Prisma.MiddlewareParams, next) => {
    const result = await next(params);

    if (["create", "update", "delete"].includes(params.action)) {
      try {
        if (params?.model == "ActivityLog") return;
        const userId = (prisma as any)._currentUserId || "system";
        const recordId = String(result?.id) ?? "";

        await prisma.activityLog.create({
          data: {
            model: params.model ?? "",
            action: params.action ?? "",
            recordId,
            userId,
            details: JSON.stringify(params.args || {}) || "{}",
          },
        });
      } catch (err) {
        console.error("Activity log failed:", err);
      }
    }

    return result;
  });
};
