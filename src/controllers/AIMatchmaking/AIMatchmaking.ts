import { Response } from "express";
import prisma from "../../helpers/prismaClient";
import { aiMatchmakingQueue } from "../../helpers/queue";
import { userStatusTypes } from "../../Types/users";
import { AuthenticatedRequest } from "../../middleware/auth";
import { createAndEmitNotification } from "../../sockets/notificationEmitter";

export const createMatchmakingRequest = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { interests, description } = req.body;

  if (!userId || !interests) {
    return res.status(400).json({
      message: "interests is required. userId is taken from your session.",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organizations: true },
    });

    const members = await prisma.user.findMany({
      where: {
        status: {
          not: userStatusTypes?.DELETED,
        },
      },
      include: {
        userOrganizations: {
          include: {
            organization: {
              include: {
                organizationWorkingSectors: true,
              },
            },
          },
        },
      },
    });

    const groups = await prisma.group.findMany();

    const requestRecord = await prisma.matchmakingRequest.create({
      data: {
        userId,
        interests,
        description:
          description ??
          "No description provided. Please use only interests provided to find matching users.",
        status: "pending",
      },
    });

    await aiMatchmakingQueue.add("process-matchmaking", {
      requestId: requestRecord.id,
      userId,
      interests,
      description:
        description ??
        "No description provided. Please use only interests provided to find matching users.",
      user,
      members,
      groups,
    });

    try {
      await createAndEmitNotification({
        receiverId: userId,
        title: "AI Matchmaking Started",
        message:
          "Your matchmaking request is being processed in the background. You will be notified when your matches are ready.",
      });
    } catch (notifyErr) {
      console.error("Failed to send matchmaking start notification:", notifyErr);
    }

    return res.status(202).json({
      message: "Matchmaking request accepted and being processed.",
      requestId: requestRecord.id,
    });
  } catch (error) {
    console.error("Matchmaking error:", error);

    return res.status(500).json({
      message: "Internal server error.",
    });
  }
};

export const getMatchmakingHistory = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      prisma.matchmakingRequest.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          matchmakingItems: {
            include: {
              matchedUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  bio: true,
                  profileImage: true,
                },
              },
              matchedGroup: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  interests: true,
                  members: {
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.matchmakingRequest.count({ where: { userId } }),
    ]);

    const history = requests.map((r) => ({
      id: r.id,
      interests: r.interests,
      description: r.description,
      status: r.status,
      aiSummary: r.aiSummary,
      aiNotes: r.aiNotes,
      aiResponse: r.status === "completed" ? r.aiResponse : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      matches: r.matchmakingItems.map((item) => ({
        type: item.matchType,
        score: item.score,
        reason: item.reason,
        user: item.matchedUser,
        group: item.matchedGroup
          ? {
              ...item.matchedGroup,
              memberCount: item.matchedGroup.members.length,
            }
          : null,
      })),
    }));

    return res.status(200).json({
      data: history,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("getMatchmakingHistory error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getMatchmakingStatus = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { requestId } = req.params;

  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const request = await prisma.matchmakingRequest.findFirst({
      where: { id: requestId, userId },
      include: {
        matchmakingItems: {
          include: {
            matchedUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                bio: true,
                profileImage: true,
              },
            },
            matchedGroup: {
              select: {
                id: true,
                name: true,
                description: true,
                interests: true,
                members: {
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });

    if (!request) {
      return res.status(404).json({ error: "Matchmaking request not found" });
    }

    return res.status(200).json({
      id: request.id,
      status: request.status,
      interests: request.interests,
      description: request.description,
      aiSummary: request.aiSummary,
      createdAt: request.createdAt,
      matches: request.matchmakingItems.map((item) => ({
        type: item.matchType,
        score: item.score,
        reason: item.reason,
        user: item.matchedUser,
        group: item.matchedGroup
          ? { ...item.matchedGroup, memberCount: item.matchedGroup.members.length }
          : null,
      })),
    });
  } catch (error) {
    console.error("getMatchmakingStatus error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};