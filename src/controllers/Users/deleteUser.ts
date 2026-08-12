import { Request, Response } from "express";
import { userStatusTypes } from "../../Types/users";
import prisma from "../../helpers/prismaClient";

export const deleteUser = async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
        status: {
          not: userStatusTypes?.DELETED,
        },
      },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found!" });
    }

    const ownedGroups = await prisma.group.findMany({
      where: { createdById: userId },
      include: {
        members: {
          where: { userId: { not: userId } },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });

    const groupIdsToDelete: string[] = [];
    const groupUpdates: { groupId: string; newOwnerId: string }[] = [];

    for (const group of ownedGroups) {
      const nextOwner = group.members[0];
      if (nextOwner) {
        groupUpdates.push({ groupId: group.id, newOwnerId: nextOwner.userId });
      } else {
        groupIdsToDelete.push(group.id);
      }
    }

    await prisma.$transaction([
      ...groupUpdates.map((u) =>
        prisma.group.update({
          where: { id: u.groupId },
          data: { createdById: u.newOwnerId },
        })
      ),
      ...(groupIdsToDelete.length > 0
        ? [
            prisma.groupMember.deleteMany({
              where: { groupId: { in: groupIdsToDelete } },
            }),
            prisma.group.deleteMany({
              where: { id: { in: groupIdsToDelete } },
            }),
          ]
        : []),
      prisma.groupMember.deleteMany({ where: { userId } }),
      prisma.user.update({
        where: { id: userId },
        data: { status: userStatusTypes?.DELETED, updatedAt: new Date() },
      }),
    ]);

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("deleteUser error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
