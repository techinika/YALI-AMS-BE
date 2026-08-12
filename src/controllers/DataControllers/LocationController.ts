import { Request, Response } from "express";
import prisma from "../../helpers/prismaClient";
import { getOrSet } from "../../helpers/cache";

export const getCountries = async (req: Request, res: Response) => {
  try {
    const countries = await getOrSet("ref:countries", () =>
      prisma.country.findMany({ orderBy: { name: "asc" } }),
    );
    res.status(200).json({
      message: "Countries",
      data: countries,
      count: countries.length,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getStates = async (req: Request, res: Response) => {
  try {
    const states = await getOrSet("ref:states", () =>
      prisma.state.findMany({ orderBy: { name: "asc" } }),
    );
    res.status(200).json({
      message: "States",
      data: states,
      count: states.length,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getStatesByCountry = async (req: Request, res: Response) => {
  try {
    const countryCode = req.params.countryId;
    const states = await getOrSet(`ref:states:${countryCode}`, () =>
      prisma.state.findMany({
        where: { countryCode },
        orderBy: { name: "asc" },
      }),
    );
    res.status(200).json({
      message: "States",
      data: states,
      count: states.length,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getDistricts = async (req: Request, res: Response) => {
  try {
    const districts = await getOrSet("ref:districts", () =>
      prisma.district.findMany({ orderBy: { name: "asc" } }),
    );
    res.status(200).json({
      message: "Districts",
      data: districts,
      count: districts.length,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getDistrict = async (req: Request, res: Response) => {
  const districtId = req.params.districtId as string;
  try {
    const district = await getOrSet(`ref:district:${districtId}`, () =>
      prisma.district.findFirst({ where: { id: districtId } }),
    );
    res.status(200).json({ message: "District", data: district });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getSectors = async (req: Request, res: Response) => {
  try {
    const sectors = await getOrSet("ref:sectors", () =>
      prisma.sector.findMany({ orderBy: { name: "asc" } }),
    );
    res.status(200).json({
      message: "Sectors",
      data: sectors,
      count: sectors.length,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getSector = async (req: Request, res: Response) => {
  const sectorId = req.params.sectorId as string;
  try {
    const sector = await getOrSet(`ref:sector:${sectorId}`, () =>
      prisma.sector.findFirst({ where: { id: sectorId } }),
    );
    const district = sector
      ? await prisma.district.findFirst({ where: { name: sector.districtName } })
      : null;
    res.status(200).json({ message: "Sector", data: { ...sector, district } });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getSectorsByDistrict = async (req: Request, res: Response) => {
  const districtId = req.params.districtId;

  try {
    const district = await getOrSet(`ref:district:${districtId}`, () =>
      prisma.district.findFirst({ where: { id: districtId } }),
    );

    if (!district) {
      return res.status(404).json({ message: "District not found" });
    }

    const sectors = await getOrSet(`ref:sectors:district:${district.name}`, () =>
      prisma.sector.findMany({
        where: { districtName: district.name },
        orderBy: { name: "asc" },
      }),
    );

    return res.status(200).json({
      message: `Sectors in ${district.name}`,
      data: sectors,
      count: sectors.length,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
