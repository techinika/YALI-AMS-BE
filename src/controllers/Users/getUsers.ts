import { Request, Response } from "express";
import { userStatusTypes } from "../../Types/users";
import prisma from "../../helpers/prismaClient";

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        status: {
          not: userStatusTypes?.DELETED,
        },
      },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        whatsappNumber: true,
        nearestLandmark: true,
        bio: true,
        facebook: true,
        instagram: true,
        linkedin: true,
        twitter: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        role: true,
        gender: true,
        residentDistrict: true,
        residentSector: true,
        residentCountry: true,
        cohort: true,
        track: true,
        state: true,
        profileImage: true,
      },
    });

    return res.status(200).json({
      message: "List of all users",
      data: users,
      count: users.length,
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
        status: {
          not: userStatusTypes?.DELETED,
        },
      },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        whatsappNumber: true,
        nearestLandmark: true,
        bio: true,
        facebook: true,
        instagram: true,
        linkedin: true,
        twitter: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        gender: true,
        residentDistrict: true,
        residentSector: true,
        cohort: true,
        role: true,
        track: true,
        profileImage: true,
        state: true,
        residentCountry: true,
      },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
