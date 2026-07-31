import { Server } from "socket.io";
import { chatSocket } from "./chat.socket";
import { groupSocket } from "./group.sockets";
import { verifyToken } from "../helpers/auth";
import prisma from "../helpers/prismaClient";
import { userStatusTypes } from "../Types/users";
import { setIO } from "./notificationEmitter";

export const initSockets = (httpServer: any) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : ["http://localhost:3000"];

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    path: "/ws/socket.io/",
  });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token;

      if (!token || typeof token !== "string") {
        return next(new Error("Authentication required"));
      }

      const decoded = verifyToken(token) as { id: string };

      const user = await prisma.user.findUnique({
        where: {
          id: decoded.id,
          status: { not: userStatusTypes?.DELETED },
        },
        select: { id: true, email: true },
      });

      if (!user) {
        return next(new Error("User not found"));
      }

      (socket as any).userId = user.id;
      (socket as any).userEmail = user.email;
      next();
    } catch (err) {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = (socket as any).userId;
    console.log("Socket connected:", socket.id, "User:", userId);

    socket.join(`user-${userId}`);

    chatSocket(io, socket);
    groupSocket(io, socket);

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });

  setIO(io);

  return io;
};
