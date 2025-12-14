import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createNewOrganization = async (req: Request, res: Response) => {
    
}