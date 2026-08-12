import { Request, Response } from "express";
import { userStatusTypes } from "../../Types/users";
import prisma from "../../helpers/prismaClient";

export const getTopActiveMembers = async (req: Request, res: Response) => {
  try {
    const grouped = await prisma.message.groupBy({
      by: ["senderId"],
      _count: {
        senderId: true,
      },
      where: {
        senderId: {
          not: null,
        },
      },
      orderBy: {
        _count: {
          senderId: "desc",
        },
      },
      take: 3,
    });

    if (grouped.length === 0) return [];

    const senderIds = grouped.map((g) => g.senderId!).filter(Boolean);

    const users = await prisma.user.findMany({
      where: {
        id: { in: senderIds },
        status: { not: userStatusTypes?.DELETED },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profileImageId: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const results = grouped
      .map((g) => ({
        user: userMap.get(g.senderId!) || null,
        messageCount: g._count.senderId,
      }))
      .filter((r) => r.user !== null);

    res.status(200).send({
      message: "Top Active Members",
      data: results,
      count: results.length,
    });
  } catch (err) {
    console.error("Error fetching top active members:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
