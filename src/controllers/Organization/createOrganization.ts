import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createNewOrganization = async (req: Request, res: Response) => {
  const { name, countryId, stateId, districtId, sectorId, website, addedById } =
    req.body;

  if (!name) {
    return res.status(400).json({
      message: "Organization name is required.",
    });
  }

  try {
    const organization = await prisma.organization.create({
      data: {
        name,
        countryId,
        stateId,
        districtId,
        sectorId,
        website,
        addedById,
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