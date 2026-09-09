import { Server, Socket } from "socket.io";
import prisma from "../helpers/prismaClient";
import { groupJoinStatusTypes } from "../Types/chat";
import {
  socketRateLimit,
  clearSocketRateLimit,
} from "../helpers/socketRateLimit";

const MAX_MESSAGE_LENGTH = 4000;

const isValidMessage = (message: any): message is string =>
  typeof message === "string" && message.trim().length > 0 &&
  message.length <= MAX_MESSAGE_LENGTH;

export const groupSocket = (io: Server, socket: Socket) => {
  const userId = (socket as any).userId;

  socket.on("join-group", async ({ groupId }) => {
    if (typeof groupId !== "string" || !groupId) {
      socket.emit("error-message", "Invalid group.");
      return;
    }

    if (!socketRateLimit(`join-group:${socket.id}`, 10, 10_000)) {
      socket.emit("error-message", "Too many requests, slow down.");
      return;
    }

    try {
      const member = await prisma.groupMember.findFirst({
        where: { groupId, userId, status: groupJoinStatusTypes.APPROVED },
      });

      if (!member) {
        socket.emit("error-message", "You are not a member of this group.");
        return;
      }

      const roomName = `group-${groupId}`;
      socket.join(roomName);

      socket.emit("joined-group", { groupId });
    } catch (err) {
      console.error("join-group error:", err);
      socket.emit("error-message", "Failed to join group.");
    }
  });

  socket.on("send-group-message", async (payload) => {
    const { groupId, message } = payload ?? {};

    if (typeof groupId !== "string" || !groupId) {
      socket.emit("error-message", "Invalid group.");
      return;
    }

    if (!isValidMessage(message)) {
      socket.emit("error-message", "Message is invalid or too long.");
      return;
    }

    if (!socketRateLimit(`send-group-message:${socket.id}`, 30, 15_000)) {
      socket.emit("error-message", "Too many messages, please slow down.");
      return;
    }

    try {
      const member = await prisma.groupMember.findFirst({
        where: { groupId, userId, status: groupJoinStatusTypes.APPROVED },
      });

      if (!member) {
        socket.emit("error-message", "You are not a member of this group.");
        return;
      }

      const savedMessage = await prisma.groupMessage.create({
        data: {
          groupId,
          content: message,
          senderId: userId,
          createdAt: new Date(),
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImage: true,
            },
          },
        },
      });

      const roomName = `group-${groupId}`;

      io.to(roomName).emit("new-group-message", savedMessage);
    } catch (error) {
      console.error("send-group-message error:", error);
      socket.emit("error-message", "Group message not sent.");
    }
  });

  socket.on("disconnect", () => {
    clearSocketRateLimit(`join-group:${socket.id}`);
    clearSocketRateLimit(`send-group-message:${socket.id}`);
  });
};