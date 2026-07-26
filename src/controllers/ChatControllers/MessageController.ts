import prisma from "../../helpers/prismaClient";
import { AuthenticatedRequest } from "../../middleware/auth";

export const getMessages = async (req: any, res: any) => {
  try {
    const messages = await prisma.message.findMany({
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
    });
    res
      .status(200)
      .send({ message: "Messages", data: messages, count: messages.length });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getPrivateMessages = async (req: AuthenticatedRequest, res: any) => {
  try {
    const { id, oid } = req.params;
    const requesterId = req.user?.id;

    if (!requesterId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (requesterId !== id && requesterId !== oid) {
      return res.status(403).json({ error: "You can only view your own private messages" });
    }

    const messages = await prisma.message.findMany({
      where: {
        public: false,
        OR: [
          {
            AND: [{ receiverId: id }, { senderId: oid }],
          },
          {
            AND: [{ receiverId: oid }, { senderId: id }],
          },
        ],
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
    res
      .status(200)
      .send({ message: "Messages", data: messages, count: messages.length });
  } catch (error) {
    console.log(error);
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

    const messages = await prisma.message.findMany({
      where: {
        public: false,
        OR: [{ senderId: targetId }, { receiverId: targetId }],
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

    res
      .status(200)
      .send({ message: "Messages", data: messages, count: messages.length });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const sendMessage = async (req: any, res: any) => {
  const { data: messageData } = req.body;
  let message: any;
  try {
    if (messageData?.receiverId == "") {
      message = await prisma.message.create({
        data: {
          message: messageData.message,
          senderId: messageData.senderId,
          public: true,
          createdAt: new Date(),
        },
      });
    } else {
      message = await prisma.message.create({
        data: {
          message: messageData.message,
          senderId: messageData.senderId,
          receiverId: messageData.receiverId,
          public: false,
          createdAt: new Date(),
        },
      });
    }

    res.status(201).send({ message: "Message Sent", data: message });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
