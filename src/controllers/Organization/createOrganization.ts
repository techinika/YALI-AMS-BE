import { Request, Response } from "express";
import prisma from "../../helpers/prismaClient";

export const createNewOrganization = async (req: Request, res: Response) => {
  const { name, countryId, stateId, districtId, sectorId, website, addedById } =
    req.body;

  if (!name) {
    return res.status(400).json({
      message: "Organization name is required.",
    });
  }

  const cleanStateId = stateId && stateId !== "" ? stateId : undefined;

  const cleanDistrictId =
    districtId && districtId !== ""
      ? await prisma.district
          .findFirst({
            where: { id: districtId },
          })
          .then((r) => {
            return r?.name;
          })
      : undefined;

  const cleanSectorId = sectorId && sectorId !== "" ? sectorId : undefined;

  try {
    const organization = await prisma.organization.create({
      data: {
        name,
        countryId: countryId ?? undefined,
        stateId: cleanStateId,
        districtId: cleanDistrictId,
        sectorId: cleanSectorId,
        website: website ?? "",
        addedById: addedById ?? undefined,
      },
    });

    return res.status(201).json({
      data: organization,
      message: "Organization created successfully!",
    });
  } catch (error: any) {
    console.error(error);

    return res.status(500).json({
      error: "Database Error",
      message: error.message,
    });
  }
};
