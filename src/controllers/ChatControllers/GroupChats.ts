import { Request, Response } from "express";
import prisma from "../../helpers/prismaClient";

export const createGroup = async (req: Request, res: Response) => {
  const { name, createdBy, memberIds, interests } = req.body;

  if (!name || !createdBy) {
    return res.status(400).json({
      message: "Group name and creator ID are required.",
    });
  }

  try {
    const group = await prisma.group.create({
      data: {
        name,
        createdById: createdBy,
        interests,
      },
      include: { members: true },
    });

    if (memberIds && Array.isArray(memberIds)) {
      const groupMembersData = memberIds.map((memberId: string) => ({
        groupId: group.id,
        userId: memberId,
      }));

      await prisma.groupMember.createMany({
        data: [{ groupId: group.id, userId: createdBy }, ...groupMembersData],
      });
    }

    return res.status(201).json({
      message: "Group created successfully.",
      data: group,
    });
  } catch (err: any) {
    console.error("Create group error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

export const addMemberToGroup = async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required." });
  }

  try {
    const alreadyMember = await prisma.groupMember.findFirst({
      where: { userId, groupId },
    });

    if (alreadyMember) {
      return res.status(409).json({ message: "User is already a member." });
    }

    const member = await prisma.groupMember.create({
      data: { groupId, userId },
    });

    return res.status(201).json({
      message: "Member added successfully.",
      data: member,
    });
  } catch (err: any) {
    console.error("Add member error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

export const sendGroupMessage = async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const { senderId, content } = req.body;

  if (!senderId || !content) {
    return res.status(400).json({
      message: "senderId and content are required.",
    });
  }

  try {
    const check = await prisma.groupMember.findFirst({
      where: { groupId, userId: senderId },
    });

    if (!check) {
      return res.status(403).json({
        message: "User is not a member of this group.",
      });
    }

    const message = await prisma.groupMessage.create({
      data: { groupId, senderId, content },
      include: { sender: true },
    });

    return res.status(201).json({
      message: "Message sent.",
      data: message,
    });
  } catch (err: any) {
    console.error("Send group message error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

export const getGroupMessages = async (req: Request, res: Response) => {
  const { groupId } = req.params;

  try {
    const messages = await prisma.groupMessage.findMany({
      where: { groupId },
      orderBy: { createdAt: "asc" },
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
    });

    return res.status(200).json({
      message: "Messages fetched.",
      data: messages,
    });
  } catch (err: any) {
    console.error("Fetch group messages error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

export const getGroupMembers = async (req: Request, res: Response) => {
  const { groupId } = req.params;

  try {
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImageId: true,
            profileImage: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: "Group members fetched.",
      data: members,
    });
  } catch (err: any) {
    console.error("Fetch members error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

export const removeUserFromGroup = async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.body;

    if (!groupId || !userId) {
      return res
        .status(400)
        .json({ message: "groupId and userId are required." });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    if (group.createdById === userId) {
      return res
        .status(403)
        .json({ message: "Owner cannot be removed from group." });
    }

    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!membership) {
      return res
        .status(400)
        .json({ message: "User is not a member of this group." });
    }

    await prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    return res.status(200).json({
      message: "User removed from group successfully.",
    });
  } catch (error: any) {
    console.error("Error removing user:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const getAllGroups = async (req: Request, res: Response) => {
  try {
    const groups = await prisma.group.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { members: true },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            content: true,
            createdAt: true,
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({ data: groups });
  } catch (error: any) {
    console.error("Error getting groups:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const getGroupById = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;

    if (!groupId) {
      return res.status(400).json({ message: "groupId is required." });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    return res.status(200).json({ data: group });
  } catch (error: any) {
    console.error("Error getting group:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};
