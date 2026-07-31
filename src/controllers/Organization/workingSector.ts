import { Request, Response } from "express";
import prisma from "../../helpers/prismaClient";

export const addWStoOrganization = async (req: Request, res: Response) => {
  const { wsId, organizationId, userId } = req.body;
  try {
    const ws = await prisma.organization_WorkingSector.create({
      data: {
        organizationId: organizationId,
        workingSectorId: wsId,
        userId: userId,
        createdAt: new Date(),
      },
    });

    res.status(200).send({
      data: ws,
      message: "Working Sector added successfully!",
    });
  } catch (prismaError: any) {
    if (prismaError.code === "P2002") {
      return res.status(409).json({
        message:
          "This working sector is already added to the organization by this user.",
      });
    }

    console.error("addWStoOrganization error:", prismaError);
    return res.status(500).json({
      error: "Database Error",
      message: "Failed to add working sector to organization",
    });
  }
};

export const removeWSfromOrganization = async (req: Request, res: Response) => {
  const { wsId, userId, orgId, id } = req.body;

  try {
    const ws = await prisma.organization_WorkingSector.delete({
      where: {
        id,
        organizationId: orgId,
        workingSectorId: wsId,
        userId: userId,
      },
    });

    return res.status(200).json({
      data: ws,
      message: "Working sector removed successfully!",
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({
        message: "Working sector not found for this organization and user.",
      });
    }

    console.error("removeWSfromOrganization error:", error);
    return res.status(500).json({
      error: "Database Error",
      message: "Failed to remove working sector from organization",
    });
  }
};
