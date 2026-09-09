import { Request, Response } from "express";
import prisma from "../../helpers/prismaClient";
import { getOrSet, invalidate } from "../../helpers/cache";

export const getWorkingSector = async (req: Request, res: Response) => {
  try {
    const workingSectors = await getOrSet("ref:working-sectors", () =>
      prisma.workingSector.findMany({ orderBy: { name: "asc" } }),
    );
    res.status(200).send({
      message: "Working Sectors",
      data: workingSectors,
      count: workingSectors.length,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const addWorkingSector = async (req: Request, res: Response) => {
  try {
    const sector = await prisma.workingSector.create({
      data: {
        name: req.body.name,
      },
    });
    await invalidate("ref:working-sectors");
    res.status(201).send({ message: "WorkingSector", data: sector });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Failed to add working sector" });
  }
};

export const deleteWorkingSector = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const sector = await prisma.workingSector.delete({
      where: { id: id },
    });
    await invalidate("ref:working-sectors");
    res.status(200).send({ message: "WorkingSector deleted", data: sector });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Failed to delete working sector" });
  }
};