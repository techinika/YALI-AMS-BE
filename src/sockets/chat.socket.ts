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

export const chatSocket = (io: Server, socket: Socket) => {
  const userId = (socket as any).userId;

  socket.on("join-room", async ({ room }, callback) => {
    if (typeof room !== "string" || !room) {
      callback?.({ error: "Room is required" });
      return;
    }

    if (!socketRateLimit(`join-room:${socket.id}`, 10, 10_000)) {
      callback?.({ error: "Too many requests, slow down." });
      return;
    }

    const ownRoom = `user-${userId}`;
    if (room === ownRoom) {
      socket.join(room);
      callback?.({ ok: true, room });
      return;
    }

    const groupMatch = room.match(/^group-(.+)$/);
    if (!groupMatch) {
      callback?.({ error: "You can only join your own or group rooms." });
      return;
    }

    const groupId = groupMatch[1];
    try {
      const member = await prisma.groupMember.findFirst({
        where: { groupId, userId, status: groupJoinStatusTypes.APPROVED },
      });
      if (!member) {
        callback?.({ error: "You are not an approved member of this group." });
        return;
      }
      socket.join(room);
      callback?.({ ok: true, room });
    } catch (err) {
      console.error("join-room authorization error:", err);
      callback?.({ error: "Failed to join room." });
    }
  });

  socket.on("send-message", async (payload) => {
    try {
      if (!socketRateLimit(`send-message:${socket.id}`, 30, 15_000)) {
        socket.emit("error-message", "Too many messages, please slow down.");
        return;
      }

      const { message, receiverId } = payload ?? {};

      if (!isValidMessage(message)) {
        socket.emit("error-message", "Message is invalid or too long.");
        return;
      }

      if (receiverId !== undefined && receiverId !== "" &&
          (typeof receiverId !== "string" || !receiverId)) {
        socket.emit("error-message", "Invalid receiver.");
        return;
      }

      const senderId = userId;
      const isPublic = !receiverId || receiverId === "";

      const savedMessage = await prisma.message.create({
        data: {
          message,
          senderId,
          receiverId: isPublic ? undefined : receiverId,
          public: isPublic,
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
          receiver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImage: true,
            },
          },
        },
      });

      if (!isPublic) {
        io.to(`user-${receiverId}`).emit("new-message", savedMessage);
        io.to(`user-${senderId}`).emit("new-message", savedMessage);
      } else {
        io.to("public").emit("new-message", savedMessage);
      }
    } catch (error) {
      console.error("Socket send_message error:", error);
      socket.emit("error-message", "Message not sent");
    }
  });

  socket.on("disconnect", () => {
    clearSocketRateLimit(`join-room:${socket.id}`);
    clearSocketRateLimit(`send-message:${socket.id}`);
  });
};