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
