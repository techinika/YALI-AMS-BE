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

    for (const group of ownedGroups) {
      const nextOwner = group.members[0];
      if (nextOwner) {
        await prisma.group.update({
          where: { id: group.id },
          data: { createdById: nextOwner.userId },
        });
      } else {
        await prisma.groupMember.deleteMany({
          where: { groupId: group?.id },
        });
        await prisma.group.delete({
          where: { id: group.id },
        });
      }
    }

    await prisma.groupMember.deleteMany({
      where: { userId: userId },
    });

    const deleted = await prisma.user.update({
      where: { id: userId },
      data: {
        status: userStatusTypes?.DELETED,
        updatedAt: new Date(),
      },
    });
    if (deleted) {
      return res.status(201).json({ message: "User deleted successfully" });
    } else {
      return res.status(500).json({ message: "User delete failed" });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
