import { Request, Response } from "express";
import prisma from "../../helpers/prismaClient";
import { groupJoinStatusTypes } from "../../Types/chat";
import sendEmail from "../../helpers/sendMail";
import { AuthenticatedRequest } from "../../middleware/auth";

export const requestToJoinGroup = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { groupId } = req.body;
    const userId = req.user?.id;

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

      if (existingMembership.status === "admin_approval_pending") {
        return res.status(400).json({
          message: "Your request to join this group is still pending approval.",
        });
      }

      await prisma.groupMember.update({
        where: { id: existingMembership.id },
        data: {
          status: groupJoinStatusTypes?.ADMIN_APPROVAL_PENDING,
          createdAt: new Date(),
        },
      });

      return res.status(200).json({
        message: "Join request sent successfully. Awaiting admin approval.",
      });
    }

    await prisma.groupMember.create({
      data: {
        groupId,
        userId,
        status: groupJoinStatusTypes?.ADMIN_APPROVAL_PENDING,
      },
    });

    const admin = await prisma.user.findFirst({
      where: { id: group?.createdById },
    });

    if (admin) {
      await sendEmail({
        subject: "New group join request on YALI AMS!",
        name: admin?.firstName,
        message: `<p>
            A user has requested to join your group "<strong>${group.name}</strong>".
          </p>
          <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/chat/groups">
              Review request
            </a>
          </p>
    <p style="font-size: 14px; color: #777;">
      If you are not the admin of this group, please contact Admin immediately or ignore this.
    </p>`,
        receiver: admin?.email,
      });

      const notification = {
        title: "New group join request on YALI AMS!",
        message: `<p>
            A user has requested to join your group "<strong>${group.name}</strong>".
          </p>
          <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/chat/groups">
              Review request
            </a>
          </p>`,
        receiverId: group?.createdById,
        opened: false,
        createdAt: new Date(),
      };

      await prisma.notifications.create({
        data: notification,
      });
    }

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

export const approveGroupJoinRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { groupId, userId } = req.body;
    const adminId = req.user?.id;

    if (!groupId || !userId || !adminId) {
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
        status: groupJoinStatusTypes?.ADMIN_APPROVAL_PENDING,
      },
    });

    if (!membership) {
      return res.status(400).json({
        message: "No pending admin approval request found.",
      });
    }

    await prisma.groupMember.update({
      where: { id: membership.id },
      data: {
        status: "approved",
      },
    });

    const member = await prisma.user.findFirst({ where: { id: userId } });

    if (member) {
      await sendEmail({
        subject: "Your group join request was approved on YALI AMS!",
        name: member?.firstName,
        message: `<p>
            Your request to join group "<strong>${group.name}</strong>" has been approved.
          </p>
          <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/chat/groups">
              Open Groups
            </a>
          </p>
    <p style="font-size: 14px; color: #777;">
      If you did not request to join this group, please contact Admin immediately or ignore this.
    </p>`,
        receiver: member?.email,
      });

      const notification = {
        title: "New group join request on YALI AMS!",
        message: `<p>
            Your request to join group "<strong>${group.name}</strong>" has been approved.
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

export const acceptGroupInvitation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { groupId } = req.body;
    const userId = req.user?.id;

    if (!groupId || !userId) {
      return res.status(400).json({ message: "groupId is required." });
    }

    const group = await prisma.group.findFirst({ where: { id: groupId } });

    const invitation = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: groupJoinStatusTypes?.MEMBER_JOINING_PENDING,
      },
    });

    if (!invitation) {
      return res.status(400).json({
        message: "No pending group invitation found.",
      });
    }

    await prisma.groupMember.update({
      where: { id: invitation.id },
      data: {
        status: groupJoinStatusTypes?.APPROVED,
      },
    });

    const admin = await prisma.user.findFirst({
      where: { id: group?.createdById },
    });

    const member = await prisma.user.findFirst({
      where: { id: userId },
    });

    if (admin) {
      await sendEmail({
        subject: "Member accepted invitation to join group on YALI AMS!",
        name: admin?.firstName,
        message: `<p>
            Member ${member?.firstName} has accepted your invitation to join group "<strong>${group?.name}</strong>" on YALI AMS.
          </p>
          <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/chat/groups">
              Open Groups
            </a>
          </p>
    <p style="font-size: 14px; color: #777;">
      If you did send this invitation to join this group, please contact Admin immediately or ignore this.
    </p>`,
        receiver: admin?.email,
      });

      const notification = {
        title: "Member accepted invitation to join group on YALI AMS!",
        message: `<p>
           Member ${member?.firstName} has accepted your invitation to join group "<strong>${group?.name}</strong>" on YALI AMS.
          </p>
          <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/chat/groups">
              Open Groups
            </a>
          </p>`,
        receiverId: group?.createdById,
        opened: false,
        createdAt: new Date(),
      };

      await prisma.notifications.create({
        data: notification,
      });
    }

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

export const declineGroupInvitation = async (req: AuthenticatedRequest, res: Response) => {
  const { groupId } = req.params;
  const userId = req.user?.id;

  if (!groupId || !userId) {
    return res.status(400).json({
      message: "groupId and userId are required.",
    });
  }

  try {
    const group = await prisma.group.findFirst({ where: { id: groupId } });
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: groupJoinStatusTypes?.MEMBER_JOINING_PENDING,
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
        status: groupJoinStatusTypes?.MEMBER_REJECTED,
      },
    });

    const admin = await prisma.user.findFirst({
      where: { id: group?.createdById },
    });

    const member = await prisma.user.findFirst({
      where: { id: userId },
    });

    if (admin) {
      await sendEmail({
        subject: "Member rejected invitation to join group on YALI AMS!",
        name: admin?.firstName,
        message: `<p>
            Member ${member?.firstName} has rejected your invitation to join group "<strong>${group?.name}</strong>" on YALI AMS.
          </p>
          <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/chat/groups">
              Open Groups
            </a>
          </p>
    <p style="font-size: 14px; color: #777;">
      If you did send this invitation to join this group, please contact Admin immediately or ignore this.
    </p>`,
        receiver: admin?.email,
      });

      const notification = {
        title: "Member rejected invitation to join group on YALI AMS!",
        message: `<p>
           Member ${member?.firstName} has accepted your invitation to join group "<strong>${group?.name}</strong>" on YALI AMS.
          </p>
          <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/chat/groups">
              Open Groups
            </a>
          </p>`,
        receiverId: group?.createdById,
        opened: false,
        createdAt: new Date(),
      };

      await prisma.notifications.create({
        data: notification,
      });
    }

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

export const rejectJoinRequest = async (req: AuthenticatedRequest, res: Response) => {
  const { groupId } = req.params;
  const { userId } = req.body;
  const adminId = req.user?.id;

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
        status: groupJoinStatusTypes?.ADMIN_APPROVAL_PENDING,
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
        status: groupJoinStatusTypes?.ADMIN_REJECTED,
      },
    });

    const member = await prisma.user.findFirst({
      where: { id: userId },
    });

    if (member) {
      await sendEmail({
        subject: "Your request to join group on YALI AMS is rejected!",
        name: member?.firstName,
        message: `<p>
             Your request to join group "<strong>${group?.name}</strong>" on YALI AMS is rejected by Admin.
          </p>
          <p>
            <a href="${process.env.FRONTEND_URL}/dashboard/chat/groups">
              Open Groups
            </a>
          </p>
    <p style="font-size: 14px; color: #777;">
      If you did send this request to join this group, please ignore this.
    </p>`,
        receiver: member?.email,
      });

      const notification = {
        title: "Your request to join group on YALI AMS is rejected!",
        message: `<p>
           Your request to join group "<strong>${group?.name}</strong>" on YALI AMS is rejected by Admin.
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
