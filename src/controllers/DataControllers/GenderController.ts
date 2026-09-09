import { Request, Response } from "express";
import prisma from "../../helpers/prismaClient";
import { getOrSet } from "../../helpers/cache";

export const getGenders = async (req: Request, res: Response) => {
  try {
    const genders = await getOrSet("ref:genders", () =>
      prisma.gender.findMany({ orderBy: { id: "asc" } }),
    );
    res
      .status(200)
      .send({ message: "Genders", data: genders, count: genders.length });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};