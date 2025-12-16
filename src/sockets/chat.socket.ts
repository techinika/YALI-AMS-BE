import { Server, Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const chatSocket = (io: Server, socket: Socket) => {
  socket.on("join-room", ({ room }) => {
    socket.join(room);
    console.log("room joined: ", room);
  });

  socket.on("send-message", async (payload) => {
    try {
      const { message, senderId, receiverId } = payload;

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
          sender: true,
          receiver: true,
        },
      });

      if (!isPublic) {
        io.to(receiverId).emit("new-message", savedMessage);

        io.to(senderId).emit("new-message", savedMessage);
      } else {
        io.emit("new-message", savedMessage);
      }
    } catch (error) {
      console.error("Socket send_message error:", error);
      socket.emit("error-message", "Message not sent");
    }
  });
};
