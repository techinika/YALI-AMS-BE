import { Request, Response } from "express";
import prisma from "../../helpers/prismaClient";

export const getRecentActivityLogs = async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 5;

    const logs = await prisma.activityLog.findMany({
      orderBy: {
        timestamp: "desc",
      },
      take: limit,
    });

    return res.status(200).json({
      data: logs,
      count: logs.length,
      message: "Recent activity logs fetched successfully",
    });
  } catch (error: any) {
    console.error("Error fetching activity logs:", error);

    return res.status(500).json({
      error: "Database Error",
      message: "Failed to fetch activity logs",
    });
  }
};
