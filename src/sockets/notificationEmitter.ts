import { Server } from "socket.io";
import prisma from "../helpers/prismaClient";

let ioInstance: Server | null = null;

export const setIO = (io: Server | null) => {
  ioInstance = io;
};

export const emitToUser = (userId: string, event: string, payload: unknown) => {
  if (ioInstance) {
    ioInstance.to(`user-${userId}`).emit(event, payload);
  }
};

export const createAndEmitNotification = async (data: {
  receiverId: string;
  title: string;
  message: string;
}) => {
  const notification = await prisma.notifications.create({
    data: {
      receiverId: data.receiverId,
      title: data.title,
      message: data.message,
      opened: false,
      createdAt: new Date(),
    },
  });

  emitToUser(data.receiverId, "notification:new", notification);
  return notification;
};
