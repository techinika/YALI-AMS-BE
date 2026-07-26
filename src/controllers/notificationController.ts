import { Request, Response } from "express";
import { subtractDays, subtractMonths } from "../helpers/date";
import { userStatusTypes } from "../Types/users";
import { AuthenticatedRequest } from "../middleware/auth";
import prisma from "../helpers/prismaClient";

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
      receiverId: user.id,
      opened: false,
      createdAt: new Date(),
    }));

    const result = await prisma.notifications.createMany({
      data: notificationsData,
      skipDuplicates: true,
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

    const notifications = await prisma.notifications.findMany({
      where: {
        receiverId: targetUserId,
      },
    });
    res.status(200).send({ message: "All notifications", notifications });
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

export const openNotification = async (req: Request, res: Response) => {
  try {
    const notification = await prisma.notifications.update({
      where: {
        id: req.body.id,
      },
      data: {
        opened: true,
        updatedAt: new Date(),
      },
    });
    res.status(201).send({ message: "Notification opened", notification });
  } catch (error) {
    console.log(error);
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
