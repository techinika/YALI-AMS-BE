import { Request, Response } from "express";
import prisma from "../../helpers/prismaClient";
import { getOrSet, invalidate } from "../../helpers/cache";

export const getTracks = async (req: Request, res: Response) => {
  try {
    const tracks = await getOrSet("ref:tracks", () =>
      prisma.track.findMany({ orderBy: { name: "asc" } }),
    );
    res
      .status(200)
      .send({ message: "Tracks", data: tracks, count: tracks.length });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const addTrack = async (req: Request, res: Response) => {
  try {
    const track = await prisma.track.create({
      data: {
        name: req.body.name,
      },
    });
    await invalidate("ref:tracks");
    res.status(201).send({ message: "Track", data: track });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Failed to add track" });
  }
};

export const deleteTracks = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const track = await prisma.track.delete({
      where: { id: id },
    });
    await invalidate("ref:tracks");
    res.status(200).send({ message: "Track deleted", data: track });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Failed to delete track" });
  }
};