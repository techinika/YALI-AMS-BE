import { Server, Socket } from "socket.io";
import prisma from "../helpers/prismaClient";
import { groupJoinStatusTypes } from "../Types/chat";

export const groupSocket = (io: Server, socket: Socket) => {
  const userId = (socket as any).userId;

  socket.on("join-group", async ({ groupId }) => {
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
      console.log(`User ${userId} joined ${roomName}`);

      socket.emit("joined-group", { groupId });
    } catch (err) {
      console.error("join-group error:", err);
      socket.emit("error-message", "Failed to join group.");
    }
  });

  socket.on("send-group-message", async (payload) => {
    const { groupId, message } = payload;

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
};
