import { Server, Socket } from "socket.io";
import prisma from "../helpers/prismaClient";

export const chatSocket = (io: Server, socket: Socket) => {
  const userId = (socket as any).userId;

  socket.on("join-room", ({ room }) => {
    socket.join(room);
    console.log("room joined: ", room);
  });

  socket.on("send-message", async (payload) => {
    try {
      const { message, receiverId } = payload;
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
        io.emit("new-message", savedMessage);
      }
    } catch (error) {
      console.error("Socket send_message error:", error);
      socket.emit("error-message", "Message not sent");
    }
  });
};
