import { Request, Response } from "express";
import { userStatusTypes } from "../Types/users";
import prisma from "../helpers/prismaClient";

export const numbersController = async (req: Request, res: Response) => {
  try {
    const [users, notificationsUnopened, messages, sentNotifications] =
      await Promise.all([
        prisma.user.count({
          where: { status: { not: userStatusTypes?.DELETED } },
        }),
        prisma.notifications.count({ where: { opened: false } }),
        prisma.message.count(),
        prisma.notifications.count(),
      ]);

    res.status(200).send({
      users,
      notificationsUnopened,
      messages,
      sentNotifications,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const activityTrendController = async (req: Request, res: Response) => {
  try {
    const days = Math.min(30, Math.max(1, parseInt(req.query.days as string) || 7));
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const messages = await prisma.message.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: { createdAt: true },
    });

    const countsByDate = new Map<string, number>();
    for (const msg of messages) {
      const dateStr = msg.createdAt.toISOString().split("T")[0];
      countsByDate.set(dateStr, (countsByDate.get(dateStr) || 0) + 1);
    }

    const trend: { date: string; count: number }[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      trend.push({
        date: dateStr,
        count: countsByDate.get(dateStr) || 0,
      });
    }

    res.status(200).json({ data: trend });
  } catch (error) {
    console.error("Activity trend error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
