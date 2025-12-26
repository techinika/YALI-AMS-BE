import { Server } from "socket.io";
import { chatSocket } from "./chat.socket";
import { groupSocket } from "./group.sockets";

export const initSockets = (httpServer: any) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
    path: "/ws/socket.io/",
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    chatSocket(io, socket);
    groupSocket(io, socket);

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });

  return io;
};
