import { Request, Response } from "express";
import prisma from "../../helpers/prismaClient";
import { groupJoinStatusTypes } from "../../Types/chat";
import sendEmail from "../../helpers/sendMail";

export const createGroup = async (req: Request, res: Response) => {
  const { name, createdBy, memberIds, interests } = req.body;

  console.log(req.body);

  if (!name || !createdBy) {
    return res.status(400).json({
      message: "Group name and creator ID are required.",
    });
  }

  try {
    const group = await prisma.group.create({
      data: {
        name,
        description: req.body.description || "",
        interests,
        createdBy: {
          connect: {
            id: createdBy,
          },
        },
      },
      include: { members: true },
    });

    const uniqueIds = new Set([createdBy, ...memberIds]);

    const existingMembers = await prisma.groupMember.findMany({
      where: {
        groupId: group.id,
        userId: { in: [...uniqueIds] },
      },
      select: { userId: true },
    });

    const existingIds = new Set(existingMembers.map((m) => m.userId));

    const newMembers = [...uniqueIds]
      .filter((id) => !existingIds.has(id))
      .map((id) => ({
        groupId: group.id,
        userId: id,
        status:
          id === createdBy
            ? groupJoinStatusTypes?.APPROVED
            : groupJoinStatusTypes?.MEMBER_JOINING_PENDING,
      }));

    if (newMembers.length > 0) {
      await prisma.groupMember.createMany({
        data: newMembers,
        skipDuplicates: true,
      });

      const memberIds = newMembers.map((m) => m.userId);
      const members = await prisma.user.findMany({
        where: { id: { in: memberIds } },
        select: { id: true, firstName: true, email: true },
      });

      const memberMap = new Map(members.map((m) => [m.id, m]));

      for (const m of newMembers) {
        const member = memberMap.get(m.userId);
        if (member) {
          await sendEmail({
            subject: "Your have been invited to join a group on YALI AMS!",
            name: member.firstName,
            message: `<p>
             You have been invited to join group "<strong>${group?.name}</strong>" on YALI AMS.
          </p>
          <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/chat/groups">
              Review Invitation
            </a>
          </p>
    <p style="font-size: 14px; color: #777;">
      If you do not want to join this group, please ignore this.
    </p></div>`,
            receiver: member.email,
          });

          const notification = {
            title: "Your have been invited to join a group on YALI AMS!",
            message: `<p>
           You have been invited to join group "<strong>${group?.name}</strong>" on YALI AMS.
          </p>
          <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/chat/groups">
              Review Invitation
            </a>
          </p>`,
            receiverId: m?.userId,
            opened: false,
            createdAt: new Date(),
          };

          await prisma.notifications.create({
            data: notification,
          });
        }
      }
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
    const existingMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
      },
    });

    const group = await prisma.group.findFirst({ where: { id: groupId } });

    if (
      existingMembership?.status ===
        groupJoinStatusTypes?.ADMIN_APPROVAL_PENDING ||
      existingMembership?.status ===
        groupJoinStatusTypes?.MEMBER_JOINING_PENDING
    ) {
      return res.status(409).json({
        message: "User already has a membership or pending request.",
        data: existingMembership,
      });
    }

    const member = await prisma.groupMember.create({
      data: {
        groupId,
        userId,
        status: groupJoinStatusTypes?.MEMBER_JOINING_PENDING,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, email: true },
    });

    if (user) {
      await sendEmail({
        subject: "Your have been invited to join a group on YALI AMS!",
        name: user.firstName,
        message: `<p>
             You have been invited to join group "<strong>${group?.name}</strong>" on YALI AMS.
          </p>
          <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/chat/groups">
              Review Invitation
            </a>
          </p>
    <p style="font-size: 14px; color: #777;">
      If you do not want to join this group, please ignore this.
    </p></div>`,
        receiver: user.email,
      });

      const notification = {
        title: "Your have been invited to join a group on YALI AMS!",
        message: `<p>
           You have been invited to join group "<strong>${group?.name}</strong>" on YALI AMS.
          </p>
          <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/chat/groups">
              Review Invitation
            </a>
          </p>`,
        receiverId: userId,
        opened: false,
        createdAt: new Date(),
      };

      await prisma.notifications.create({
        data: notification,
      });
    }

    return res.status(201).json({
      message: "Invitation sent successfully.",
      data: member,
    });
  } catch (err: any) {
    console.error("Add member error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

export const sendGroupMessage = async (req: Request, res: Response) => {
  const { groupId, userId } = req.params;
  const { content } = req.body;

  if (!groupId || !userId || !content) {
    return res.status(400).json({
      message: "groupId, userId, and content are required.",
    });
  }

  try {
    // Check membership
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: "approved",
      },
    });

    if (!membership) {
      return res.status(403).json({
        message: "You are not allowed to send messages to this group.",
      });
    }

    const message = await prisma.groupMessage.create({
      data: {
        groupId,
        senderId: userId,
        content,
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
      },
    });

    return res.status(201).json({
      message: "Message sent successfully.",
      data: message,
    });
  } catch (err: any) {
    console.error("Send group message error:", err);
    return res.status(500).json({
      message: "Failed to send message.",
      error: err.message,
    });
  }
};

export const getGroupMessages = async (req: Request, res: Response) => {
  const { groupId, userId } = req.params;

  if (!groupId || !userId) {
    return res.status(400).json({
      message: "groupId and userId are required.",
    });
  }

  try {
    // Check membership
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: "approved", // enforce approved access
      },
    });

    if (!membership) {
      return res.status(403).json({
        message: "You are not allowed to view messages in this group.",
      });
    }

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
      message: "Group messages fetched successfully.",
      data: messages,
    });
  } catch (err: any) {
    console.error("Fetch group messages error:", err);
    return res.status(500).json({
      message: "Failed to fetch group messages.",
      error: err.message,
    });
  }
};

export const getGroupMembers = async (req: Request, res: Response) => {
  const { groupId } = req.params;

  try {
    const members = await prisma.groupMember.findMany({
      where: {
        groupId,
        status: groupJoinStatusTypes.APPROVED,
      },
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
      orderBy: {
        createdAt: "asc",
      },
    });

    return res.status(200).json({
      message: "Group members fetched successfully.",
      data: members,
    });
  } catch (err: any) {
    console.error("Fetch members error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

export const removeUserFromGroup = async (req: Request, res: Response) => {
  const { groupId, userId } = req.params;

  if (!groupId || !userId) {
    return res
      .status(400)
      .json({ message: "groupId and userId are required." });
  }

  try {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    if (group.createdById === userId) {
      return res
        .status(403)
        .json({ message: "Group owner cannot be removed." });
    }

    const membership = await prisma.groupMember.findFirst({
      where: { groupId, userId },
    });

    if (!membership) {
      return res
        .status(404)
        .json({ message: "User is not a member of this group." });
    }

    await prisma.groupMember.delete({
      where: { id: membership.id },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, email: true },
    });

    if (user) {
      await sendEmail({
        subject: "You have been removed from group on YALI AMS!",
        name: user.firstName,
        message: `<p>
             You have been removed from group "<strong>${group?.name}</strong>" on YALI AMS.
          </p>
          <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/chat/groups">
              Open Groups
            </a>
          </p>
    <p style="font-size: 14px; color: #777;">
      If you need more information, please reach out to group admin.
    </p></div>`,
        receiver: user.email,
      });

      const notification = {
        title: "You have been removed from group on YALI AMS!",
        message: `<p>
           You have been removed from group "<strong>${group?.name}</strong>" on YALI AMS.
          </p>
          <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/chat/groups">
              Open Groups
            </a>
          </p>`,
        receiverId: userId,
        opened: false,
        createdAt: new Date(),
      };

      await prisma.notifications.create({
        data: notification,
      });
    }

    return res.status(200).json({
      message: "User removed from group successfully.",
    });
  } catch (error: any) {
    console.error("Remove member error:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getAllGroups = async (req: Request, res: Response) => {
  try {
    const groups = await prisma.group.findMany({
      include: {
        _count: {
          select: { members: true },
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
                firstName: true,
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

export const getMyGroups = async (req: Request, res: Response) => {
  try {
    let userId = req.user?.id || req.params.userId || req.query.userId;

    if (Array.isArray(userId)) {
      userId = userId[0];
    }

    if (!userId) {
      return res.status(400).json({
        message: "User ID is required.",
      });
    }

    const groups = await prisma.groupMember.findMany({
      where: { userId, status: { not: groupJoinStatusTypes?.ADMIN_REJECTED } },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    const formatted = groups
      .filter((gm) => gm.group)
      .map((gm) => ({
        ...gm.group,
        myMembership: {
          id: gm.id,
          status: gm.status,
          joinedAt: gm.createdAt,
        },
      }));

    return res.status(200).json({
      message: "Groups fetched successfully.",
      data: formatted,
    });
  } catch (error: any) {
    console.error("Get my groups error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};
