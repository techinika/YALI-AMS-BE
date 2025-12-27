import { Request, Response } from "express";
import prisma from "../../helpers/prismaClient";

async function getOrganizations(req: Request, res: Response) {
  try {
    const organizations = await prisma.organization.findMany();
    return res
      .status(200)
      .json({ message: "Organizations", data: organizations });
  } catch (error: any) {
    return res.status(200).json({ message: error?.message, data: null });
  }
}

export const getOrganizationById = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid organization id" });
  }

  try {
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        country: true,
        state: true,
        district: true,
        sector: true,
        addedBy: true,
        organizationWorkingSectors: {
          include: {
            workingSector: true,
          },
        },
      },
    });

    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const workingSectors = organization.organizationWorkingSectors.map(
      (ows) => ows.workingSector
    );

    return res.json({
      data: {
        ...organization,
        workingSectors,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getOrganizationsForUser = async (req: Request, res: Response) => {
  const userId = req.params.id;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const userOrganizations = await prisma.user_Organization.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            country: true,
            state: true,
            district: true,
            sector: true,
            addedBy: true,
            organizationWorkingSectors: {
              where: {
                userId,
              },
              include: {
                workingSector: true,
              },
            },
          },
        },
      },
    });

    if (userOrganizations.length === 0) {
      return res.json({ data: [] });
    }

    const organizations = userOrganizations.map((uo) => {
      const org = uo.organization;

      const workingSectors = org?.organizationWorkingSectors.map(
        (ows) => ows.workingSector
      );

      return {
        ...org,
        relation: uo.relation,
        position: uo.position,
        user: uo.userId,
        connectId: uo.id,
        workingSectors,
      };
    });

    return res.json({ data: organizations });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getOrganizationsForUserById = async (
  req: Request,
  res: Response
) => {
  const userId = req.params.id;
  const orgId = Number(req.params.orgId);

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const userOrganizations = await prisma.user_Organization.findMany({
      where: { userId, organizationId: orgId },
      include: {
        organization: {
          include: {
            country: true,
            state: true,
            district: true,
            sector: true,
            addedBy: true,
            organizationWorkingSectors: {
              where: {
                userId,
                organizationId: orgId,
              },
              include: {
                workingSector: true,
              },
            },
          },
        },
      },
    });

    if (userOrganizations.length === 0) {
      return res.json({ data: [] });
    }

    const organizations = userOrganizations.map((uo) => {
      const org = uo.organization;

      const workingSectors = org?.organizationWorkingSectors.map(
        (ows) => ows.workingSector
      );

      return {
        ...org,
        relation: uo.relation,
        position: uo.position,
        user: uo.userId,
        connectId: uo.id,
        workingSectors,
      };
    });

    return res.json({ data: organizations });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export { getOrganizations };