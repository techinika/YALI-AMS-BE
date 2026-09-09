import { Request, Response } from "express";
import { subtractDays, subtractMonths } from "../helpers/date";
import { userStatusTypes } from "../Types/users";
import { AuthenticatedRequest } from "../middleware/auth";
import prisma from "../helpers/prismaClient";
import { emitToUser } from "../sockets/notificationEmitter";

export const notificationTypes = {
  SIGNUP: "signup",
  UPDATE: "updated",
  UPDATED: "updated",
};

export async function generateProfileUpdateNotifications() {
  try {
    const sixMonthsAgo = subtractMonths(new Date(), 6);
    const oneDayAgo = subtractDays(new Date(), 1);

    const setup = await prisma.notificationSetup.findFirst({
      where: { usage: "UPDATE" },
    });

    if (!setup || !setup.message) {
      console.log("No notification template found for UPDATE.");
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        updatedAt: { lt: sixMonthsAgo },
        status: { not: userStatusTypes?.DELETED },

        Notifications: {
          none: {
            createdAt: { gt: oneDayAgo },
            title: "UPDATE: You need to update your profile",
          },
        },
      },
      select: { id: true, firstName: true },
    });

    if (users.length === 0) {
      console.log("No users need profile update notifications.");
      return;
    }

    const notificationsData = users.map((user) => ({
      title: "UPDATE: You need to update your profile",
      message: setup.message.replace(/\[name\]/g, user.firstName),
      link: setup.link || null,
      receiverId: user.id,
      opened: false,
      createdAt: new Date(),
    }));

    const result = await prisma.notifications.createMany({
      data: notificationsData,
      skipDuplicates: true,
    });

    users.forEach((user) => {
      emitToUser(user.id, "notification:new", {
        title: "UPDATE: You need to update your profile",
        message: setup.message.replace(/\[name\]/g, user.firstName),
        link: setup.link || null,
        receiverId: user.id,
        createdAt: new Date(),
      });
    });

    console.log("Profile update notifications created:", result.count);
  } catch (error) {
    console.error("Error generating profile notifications:", error);
  }
}

export const getUsersNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requesterId = req.user?.id;
    const targetUserId = req.params.userId;

    if (!requesterId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (requesterId !== targetUserId) {
      return res.status(403).json({ error: "You can only view your own notifications" });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notifications.findMany({
        where: { receiverId: targetUserId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notifications.count({ where: { receiverId: targetUserId } }),
    ]);

    res.status(200).send({
      message: "All notifications",
      notifications,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getUnopenedNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requesterId = req.user?.id;
    const targetUserId = req.params.userId;

    if (!requesterId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (requesterId !== targetUserId) {
      return res.status(403).json({ error: "You can only view your own notifications" });
    }

    const notifications = await prisma.notifications.findMany({
      where: {
        receiverId: targetUserId,
        opened: false,
      },
    });
    res
      .status(200)
      .send({ message: "All unopened notifications", notifications });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const openNotification = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const notificationId = req.body.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const existing = await prisma.notifications.findUnique({
      where: { id: notificationId },
      select: { receiverId: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Notification not found" });
    }

    if (existing.receiverId !== userId) {
      return res.status(403).json({ error: "You can only open your own notifications" });
    }

    const notification = await prisma.notifications.update({
      where: { id: notificationId },
      data: {
        opened: true,
        updatedAt: new Date(),
      },
    });
    res.status(200).send({ message: "Notification opened", notification });
  } catch (error) {
    console.error("openNotification error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateNotificationDetails = async (
  req: Request,
  res: Response
) => {
  try {
    const { message, link, usage } = req.body;
    const not = await prisma.notificationSetup.findFirst({ where: { usage } });

    if (!not) {
      return res
        .status(404)
        .send({ message: "This notification is not found!" });
    }

    const notification = await prisma.notificationSetup.update({
      where: { usage: usage },
      data: {
        message,
        link,
        updatedAt: new Date(),
      },
    });

    if (notification) {
      res.status(201).send({ message: "Notification updated", notification });
    }
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getAllNotificationSetups = async (req: Request, res: Response) => {
  try {
    const setups = await prisma.notificationSetup.findMany();

    res.status(200).send({ message: "Notification Setups", data: setups });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getOneNotificationSetups = async (req: Request, res: Response) => {
  try {
    const { usage } = req.params;
    if (!usage) {
      return res.status(400).json({ error: "Usage parameter is required" });
    }
    const setup = await prisma.notificationSetup.findFirst({
      where: { usage: usage },
    });

    res.status(200).send({ message: "Notification Setup", data: setup });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
