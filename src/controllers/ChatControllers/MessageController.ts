import prisma from "../../helpers/prismaClient";
import { AuthenticatedRequest } from "../../middleware/auth";
import { getIO } from "../../sockets/notificationEmitter";

export const getMessages = async (req: any, res: any) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { public: true },
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
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.message.count({ where: { public: true } }),
    ]);

    res.status(200).send({
      message: "Messages",
      data: messages,
      count: messages.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("getMessages error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getPrivateMessages = async (req: AuthenticatedRequest, res: any) => {
  try {
    const { id, oid } = req.params;
    const requesterId = req.user?.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    if (!requesterId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (requesterId !== id && requesterId !== oid) {
      return res.status(403).json({ error: "You can only view your own private messages" });
    }

    const where = {
      public: false,
      OR: [
        { AND: [{ receiverId: id }, { senderId: oid }] },
        { AND: [{ receiverId: oid }, { senderId: id }] },
      ],
    };

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          sender: { select: { id: true, firstName: true, lastName: true, profileImage: true } },
          receiver: { select: { id: true, firstName: true, lastName: true, profileImage: true } },
        },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);

    res.status(200).send({
      message: "Messages",
      data: messages,
      count: messages.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("getPrivateMessages error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getPrivateChats = async (req: AuthenticatedRequest, res: any) => {
  try {
    const requesterId = req.user?.id;
    const targetId = req.params.id;

    if (!requesterId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (requesterId !== targetId) {
      return res.status(403).json({ error: "You can only view your own chats" });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 200));
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: {
          public: false,
          OR: [{ senderId: targetId }, { receiverId: targetId }],
        },
        select: {
          id: true,
          message: true,
          senderId: true,
          receiverId: true,
          public: true,
          createdAt: true,
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
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.message.count({
        where: {
          public: false,
          OR: [{ senderId: targetId }, { receiverId: targetId }],
        },
      }),
    ]);

    res.status(200).send({
      message: "Messages",
      data: messages,
      count: messages.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const sendMessage = async (req: AuthenticatedRequest, res: any) => {
  const messageData = req.body?.data ?? req.body;
  const senderId = req.user?.id;
  let message: any;
  try {
    if (!senderId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (messageData?.receiverId == "") {
      message = await prisma.message.create({
        data: {
          message: messageData.message,
          senderId,
          public: true,
          createdAt: new Date(),
        },
      });
    } else {
      message = await prisma.message.create({
        data: {
          message: messageData.message,
          senderId,
          receiverId: messageData.receiverId,
          public: false,
          createdAt: new Date(),
        },
      });
    }
    if (!message) {
      return res.status(500).json({ error: "Failed to create message" });
    }

    const io = getIO();
    if (messageData?.receiverId == "") {
      io?.to("public").emit("new-message", message);
    } else {
      io?.to(`user-${senderId}`).emit("new-message", message);
      io?.to(`user-${messageData?.receiverId}`).emit("new-message", message);
    }

    res.status(201).send({ message: "Message Sent", data: message });
  } catch (error) {
    console.error("sendMessage error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
