import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../helpers/auth";
import { userStatusTypes } from "../Types/users";
import { isTokenRevoked } from "../helpers/tokenStore";
import prisma from "../helpers/prismaClient";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string | null;
  };
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = verifyToken(token) as { id: string };

    if (await isTokenRevoked(token)) {
      return res.status(401).json({ message: "Session expired, please log in again" });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.id,
        status: {
          not: userStatusTypes?.DELETED,
        },
      },
      select: {
        id: true,
        email: true,
        status: true,
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!user || user.status !== userStatusTypes?.ACTIVE) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role?.name ?? null,
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.role || req.user.role.toLowerCase() !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};
