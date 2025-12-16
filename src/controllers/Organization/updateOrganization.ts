import { Request, Response } from "express";
import prisma from "../../helpers/prismaClient";

export async function updateOrganization(req: Request, res: Response) {
  try {
    const {
      organizationId,
      userId,
      name,
      website,
      countryId,
      districtId,
      sectorId,
      stateId,
      relation,
      position,
      connectionId,
    } = req.body;

    if (!organizationId || !userId) {
      return res
        .status(400)
        .json({ message: "organizationId and userId are required" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.update({
        where: { id: organizationId },
        data: {
          name,
          website,
          countryId,
          districtId: districtId || null,
          sectorId: sectorId || null,
          stateId: stateId || null,
        },
      });

      await tx.user_Organization.upsert({
        where: {
          id: connectionId,
          userId,
          organizationId,
        },
        update: {
          relation,
          position,
        },
        create: {
          userId,
          organizationId,
          relation,
          position,
        },
      });

      return organization;
    });

    return res.json({
      message: "Organization updated successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Update organization error:", error);

    return res.status(500).json({ message: "Failed to update organization" });
  }
}
