import { Request, Response } from "express";
import prisma from "../../helpers/prismaClient";
import { aiMatchmakingQueue } from "../../helpers/queue";
import { userStatusTypes } from "../../Types/users";

export const createMatchmakingRequest = async (req: Request, res: Response) => {
  const { interests, description, userId } = req.body;

  if (!userId || !interests) {
    return res.status(400).json({
      message: "userId, interests, and description are required.",
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

    return res.status(202).json({
      message: "Matchmaking request accepted and being processed.",
      requestId: requestRecord.id,
    });
  } catch (error) {
    console.error("Matchmaking error:", error);

    return res.status(500).json({
      message: "Internal server error.",
      error: error instanceof Error ? error.message : "",
    });
  }
};