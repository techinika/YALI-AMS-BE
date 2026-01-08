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
      workingSectors = [],
    } = req.body;

    if (!organizationId || !userId) {
      return res
        .status(400)
        .json({ message: "organizationId and userId are required" });
    }

    const cleanDistrict =
      districtId && districtId !== ""
        ? await prisma.district
            .findFirst({
              where: { id: districtId },
            })
            .then((r) => {
              return r?.name;
            })
        : undefined;

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.update({
        where: { id: organizationId },
        data: {
          name,
          website,
          countryId,
          districtId: cleanDistrict || null,
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

      const existing = await tx.organization_WorkingSector.findMany({
        where: {
          userId,
          organizationId,
        },
        select: {
          id: true,
          workingSectorId: true,
        },
      });

      const existingIds = new Set(
        existing.map((ws) => ws.workingSectorId).filter(Boolean) as string[]
      );

      const submittedIds = new Set(workingSectors);

      const toDelete = existing.filter(
        (ws) => ws.workingSectorId && !submittedIds.has(ws.workingSectorId)
      );

      if (toDelete.length > 0) {
        await tx.organization_WorkingSector.deleteMany({
          where: {
            id: { in: toDelete.map((w) => w.id) },
          },
        });
      }

      const toCreate = workingSectors.filter(
        (sectorId: string) => !existingIds.has(sectorId)
      );

      if (toCreate.length > 0) {
        await tx.organization_WorkingSector.createMany({
          data: toCreate.map((sectorId: string) => ({
            userId,
            organizationId,
            workingSectorId: sectorId,
          })),
        });
      }

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
