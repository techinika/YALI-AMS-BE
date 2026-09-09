import { Request, Response } from "express";
import { userStatusTypes } from "../../Types/users";
import prisma from "../../helpers/prismaClient";

const strip = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : String(value ?? "").toLowerCase();

export const deleteOwnAccount = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { email, firstName } = req.body ?? {};

  try {
    if (!strip(email) || !strip(firstName)) {
      return res
        .status(400)
        .json({ message: "Please confirm your email address and first name to delete your account." });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
        status: { not: userStatusTypes?.DELETED },
      },
      select: { id: true, email: true, firstName: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (strip(user.email) !== strip(email) || strip(user.firstName) !== strip(firstName)) {
      return res.status(400).json({
        message: "The email address and first name you entered do not match your account.",
      });
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

    const groupsToDelete: string[] = [];
    const groupTransfers: { id: string; newOwnerId: string }[] = [];

    for (const group of ownedGroups) {
      const nextOwner = group.members[0];
      if (nextOwner) {
        groupTransfers.push({ id: group.id, newOwnerId: nextOwner.userId });
      } else {
        groupsToDelete.push(group.id);
      }
    }

    const ops: any[] = [
      prisma.notificationSetup.updateMany({
        where: { updatedBy: userId },
        data: { updatedBy: null },
      }),
      prisma.organization.updateMany({
        where: { addedById: userId },
        data: { addedById: null },
      }),
      prisma.matchmakingItem.deleteMany({
        where: {
          OR: [{ request: { userId } }, { matchedUserId: userId }],
        },
      }),
      prisma.matchmakingRequest.deleteMany({ where: { userId } }),
      prisma.notifications.deleteMany({ where: { receiverId: userId } }),
      prisma.message.deleteMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      }),
      prisma.groupMessage.deleteMany({ where: { senderId: userId } }),
      prisma.groupMember.deleteMany({ where: { userId } }),
      prisma.organization_WorkingSector.deleteMany({ where: { userId } }),
      prisma.user_Organization.deleteMany({ where: { userId } }),
      prisma.image.deleteMany({ where: { creatorId: userId } }),
      prisma.activityLog.deleteMany({ where: { userId } }),
      ...groupTransfers.map((transfer) =>
        prisma.group.update({
          where: { id: transfer.id },
          data: { createdById: transfer.newOwnerId },
        })
      ),
    ];

    if (groupsToDelete.length > 0) {
      ops.push(
        prisma.matchmakingItem.deleteMany({
          where: { matchedGroupId: { in: groupsToDelete } },
        }),
        prisma.groupMessage.deleteMany({
          where: { groupId: { in: groupsToDelete } },
        }),
        prisma.groupMember.deleteMany({
          where: { groupId: { in: groupsToDelete } },
        }),
        prisma.group.deleteMany({ where: { id: { in: groupsToDelete } } })
      );
    }

    ops.push(prisma.user.delete({ where: { id: userId } }));

    await prisma.$transaction(ops);

    return res
      .status(200)
      .json({ message: "Your account and all associated data have been permanently deleted." });
  } catch (error) {
    console.error("deleteOwnAccount error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};