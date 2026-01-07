import { Request, Response } from "express";
import prisma from "../../helpers/prismaClient";

export const requestToJoinGroup = async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.body;

    if (!groupId || !userId) {
      return res.status(400).json({ message: "groupId is required." });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    const existingMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
      },
    });

    if (existingMembership) {
      if (existingMembership.status === "approved") {
        return res
          .status(400)
          .json({ message: "You are already a member of this group." });
      }

      // Request already pending
      if (existingMembership.status === "admin_approval_pending") {
        return res.status(400).json({
          message: "Your request to join this group is still pending approval.",
        });
      }

      // Allow re-request if previously rejected or left
      await prisma.groupMember.update({
        where: { id: existingMembership.id },
        data: {
          status: "admin_approval_pending",
          createdAt: new Date(),
        },
      });

      return res.status(200).json({
        message: "Join request sent successfully. Awaiting admin approval.",
      });
    }

    // 3. Create fresh join request
    await prisma.groupMember.create({
      data: {
        groupId,
        userId,
        status: "admin_approval_pending",
      },
    });

    return res.status(201).json({
      message: "Join request sent successfully. Awaiting admin approval.",
    });
  } catch (error: any) {
    console.error("Error requesting to join group:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const approveGroupJoinRequest = async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.body;
    const adminId = req.user?.id;

    if (!groupId || !userId) {
      return res
        .status(400)
        .json({ message: "groupId and userId are required." });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }

    if (group.createdById !== adminId) {
      return res
        .status(403)
        .json({ message: "Only group admins can approve requests." });
    }

    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: "admin_approval_pending",
      },
    });

    if (!membership) {
      return res.status(400).json({
        message: "No pending admin approval request found.",
      });
    }

    // 3. Approve
    await prisma.groupMember.update({
      where: { id: membership.id },
      data: {
        status: "approved",
      },
    });

    return res.status(200).json({
      message: "User approved and added to the group.",
    });
  } catch (error: any) {
    console.error("Approve group join error:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const acceptGroupInvitation = async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.body;

    if (!groupId || !userId) {
      return res.status(400).json({ message: "groupId is required." });
    }

    // 1. Find invitation
    const invitation = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: "member_joining_pending",
      },
    });

    if (!invitation) {
      return res.status(400).json({
        message: "No pending group invitation found.",
      });
    }

    // 2. Accept invitation
    await prisma.groupMember.update({
      where: { id: invitation.id },
      data: {
        status: "approved",
      },
    });

    return res.status(200).json({
      message: "You have successfully joined the group.",
    });
  } catch (error: any) {
    console.error("Accept group invitation error:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const declineGroupInvitation = async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const { userId } = req.body;

  if (!groupId || !userId) {
    return res.status(400).json({
      message: "groupId and userId are required.",
    });
  }

  try {
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: "member_joining_pending",
      },
    });

    if (!membership) {
      return res.status(404).json({
        message: "No pending invitation found for this user.",
      });
    }

    await prisma.groupMember.update({
      where: { id: membership.id },
      data: {
        status: "member_rejected",
      },
    });

    return res.status(200).json({
      message: "Group invitation declined successfully.",
    });
  } catch (error: any) {
    console.error("Decline invitation error:", error);
    return res.status(500).json({
      message: "Internal server error.",
      error: error.message,
    });
  }
};

export const rejectJoinRequest = async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const { adminId, userId } = req.body;

  if (!groupId || !adminId || !userId) {
    return res.status(400).json({
      message: "groupId, adminId, and userId are required.",
    });
  }

  try {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return res.status(404).json({
        message: "Group not found.",
      });
    }

    if (group.createdById !== adminId) {
      return res.status(403).json({
        message: "Only the group admin can reject requests.",
      });
    }

    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: "admin_approval_pending",
      },
    });

    if (!membership) {
      return res.status(404).json({
        message: "No pending join request found for this user.",
      });
    }

    await prisma.groupMember.update({
      where: { id: membership.id },
      data: {
        status: "admin_rejected",
      },
    });

    return res.status(200).json({
      message: "Join request rejected successfully.",
    });
  } catch (error: any) {
    console.error("Reject join request error:", error);
    return res.status(500).json({
      message: "Internal server error.",
      error: error.message,
    });
  }
};

export const getUsersToInvite = async (req: Request, res: Response) => {
  const { currentUserId, activeGroupId } = req.params;
  const usersToInvite = await prisma.user.findMany({
    where: {
      id: {
        not: currentUserId,
      },
      groupMembers: {
        none: {
          groupId: activeGroupId,
        },
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  return res.status(200).json({ data: usersToInvite });
};
