import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const addUserOrganization = async (req: Request, res: Response) => {
  const { organizationId, userId, relation, position } = req.body;

  try {
    const uo = await prisma.user_Organization.create({
      data: {
        organizationId: organizationId,
        relation,
        position,
        userId: userId,
        createdAt: new Date(),
      },
    });
    return res.status(200).json({
      message: "User organization added successfully.",
      data: uo,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const removeUserOrganization = async (req: Request, res: Response) => {
  const { organizationId, userId, relation, id } = req.body;

  try {
    const uo = await prisma.user_Organization.delete({
      where: {
        id,
        organizationId,
        userId: userId,
        relation,
      },
    });

    return res.status(200).json({
      message: "User organization removed successfully.",
      data: uo,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
