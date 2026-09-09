import { Request, Response } from "express";
import prisma from "../../helpers/prismaClient";
import { getOrSet, invalidate } from "../../helpers/cache";

export const getCohorts = async (req: Request, res: Response) => {
  try {
    const cohorts = await getOrSet("ref:cohorts", () =>
      prisma.cohort.findMany({ orderBy: { name: "asc" } }),
    );
    res
      .status(200)
      .send({ message: "Cohorts", data: cohorts, count: cohorts.length });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const addCohorts = async (req: Request, res: Response) => {
  try {
    if (!req.body.name || !req.body.description) {
      return res
        .status(400)
        .send({ message: "Cohort Name and Description are required." });
    }
    const existingCohort = await prisma.cohort.findFirst({
      where: { name: req.body.name },
    });
    if (existingCohort) {
      return res.status(400).send({ message: "Cohort already exists." });
    }
    const cohort = await prisma.cohort.create({
      data: {
        name: req.body.name,
        description: req.body.description,
      },
    });

    await invalidate("ref:cohorts");

    return res.status(201).send({ message: "Cohort", data: cohort });
  } catch (error: any) {
    console.log(error);
    return res.status(500).json({ error: "Failed to add cohort" });
  }
};

export const deleteCohorts = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const cohort = await prisma.cohort.delete({
      where: { id: Number(id) },
    });
    await invalidate("ref:cohorts");
    res.status(200).send({ message: "Cohort deleted", data: cohort });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Failed to delete cohort" });
  }
};