import { Server, Socket } from "socket.io";
import prisma from "../helpers/prismaClient";

export const groupSocket = (io: Server, socket: Socket) => {
  // JOIN GROUP ROOM
  socket.on("join-group", async ({ groupId, userId }) => {
    try {
      // Validate membership
      const member = await prisma.groupMember.findFirst({
        where: { groupId, userId },
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

  // SEND GROUP MESSAGE
  socket.on("send-group-message", async (payload) => {
    const { groupId, senderId, message } = payload;

    try {
      // Validate membership
      const member = await prisma.groupMember.findFirst({
        where: { groupId, userId: senderId },
      });

      if (!member) {
        socket.emit("error-message", "You are not a member of this group.");
        return;
      }

      // Save message
      const savedMessage = await prisma.groupMessage.create({
        data: {
          groupId,
          content: message,
          senderId,
          createdAt: new Date(),
        },
        include: {
          sender: true,
        },
      });

      const roomName = `group-${groupId}`;

      // Emit to group room
      io.to(roomName).emit("new-group-message", savedMessage);
    } catch (error) {
      console.error("send-group-message error:", error);
      socket.emit("error-message", "Group message not sent.");
    }
  });
};
