import { Server } from "socket.io";
import { chatSocket } from "./chat.socket";
import { groupSocket } from "./group.sockets";
import { verifyToken } from "../helpers/auth";
import { isTokenRevoked } from "../helpers/tokenStore";
import prisma from "../helpers/prismaClient";
import { userStatusTypes } from "../Types/users";
import { setIO } from "./notificationEmitter";
import { sweepSocketRateLimits } from "../helpers/socketRateLimit";

const MAX_MESSAGE_BYTES = 200_000;

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
    maxHttpBufferSize: MAX_MESSAGE_BYTES,
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token || typeof token !== "string") {
        return next(new Error("Authentication required"));
      }

      const decoded = verifyToken(token) as { id: string };

      if (await isTokenRevoked(token)) {
        return next(new Error("Session expired, please log in again"));
      }

      const user = await prisma.user.findUnique({
        where: {
          id: decoded.id,
          status: userStatusTypes?.ACTIVE,
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

    socket.join(`user-${userId}`);
    socket.join("public");

    chatSocket(io, socket);
    groupSocket(io, socket);

    socket.on("disconnect", () => {
      sweepSocketRateLimits();
    });
  });

  setIO(io);

  return io;
};