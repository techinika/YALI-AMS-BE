import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const addWStoOrganization = async (req: Request, res: Response) => {
  const { wsId, organizationId } = req.body;
  try {
    const image = await prisma.organization_WorkingSector.create({
      data: {
        name: profileImage.name,
        link: result?.secure_url,
        creatorId: req.body.userId,
        createdAt: new Date(),
      },
    });

    fs.unlinkSync(profileImage.tempFilePath);

    res.status(200).send({
      image: image,
      message: "File uploaded successfully!",
      name: profileImage.name,
    });
  } catch (prismaError: any) {
    console.error(prismaError);
    return res
      .status(500)
      .json({ error: "Database Error", message: prismaError.message });
  }
};

export const removeWSfromOrganization = async (req: Request, res: Response) => {
  const { wsId, organizationId } = req.body;
  try {
    const image = await prisma.image.create({
      data: {
        name: profileImage.name,
        link: result?.secure_url,
        creatorId: req.body.userId,
        createdAt: new Date(),
      },
    });

    fs.unlinkSync(profileImage.tempFilePath);

    res.status(200).send({
      image: image,
      message: "File uploaded successfully!",
      name: profileImage.name,
    });
  } catch (prismaError: any) {
    console.error(prismaError);
    return res
      .status(500)
      .json({ error: "Database Error", message: prismaError.message });
  }
};
