import { Request, Response } from "express";
import prisma from "../../helpers/prismaClient";

export const getGenders = async (req: Request, res: Response) => {
  try {
    const genders = await prisma.gender.findMany();
    res
      .status(200)
      .send({ message: "Genders", data: genders, count: genders.length });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
