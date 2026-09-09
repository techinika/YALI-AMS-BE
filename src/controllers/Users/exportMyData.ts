import { Request, Response } from "express";
import { userStatusTypes } from "../../Types/users";
import prisma from "../../helpers/prismaClient";

export const exportMyData = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
        status: { not: userStatusTypes?.DELETED },
      },
      include: {
        gender: true,
        role: true,
        residentCountry: true,
        residentDistrict: true,
        residentSector: true,
        state: true,
        cohort: true,
        track: true,
        profileImage: true,
        userOrganizations: {
          include: {
            organization: {
              include: {
                country: true,
                state: true,
                district: true,
                sector: true,
                workingSector: true,
              },
            },
          },
        },
        organizationWorkingSectors: {
          include: { organization: true, workingSector: true },
        },
        groupMembers: {
          include: {
            group: true,
          },
        },
        groups: {
          include: {
            members: true,
          },
        },
        sentMessages: true,
        receivedMessages: true,
        Notifications: true,
        imageCreator: true,
        matchmakingRequests: {
          include: {
            matchmakingItems: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { password, refreshToken, token, ...safeUser } = user;

    return res.status(200).json({
      exportedAt: new Date().toISOString(),
      exportedBy: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      data: safeUser,
    });
  } catch (error) {
    console.error("exportMyData error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};