import { Request, Response } from "express";
import { userStatusTypes } from "../../Types/users";
import prisma from "../../helpers/prismaClient";

export const deleteUser = async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
        status: {
          not: userStatusTypes?.DELETED,
        },
      },
    });
    if (user) {
      const deleted = await prisma.user.update({
        where: { id: userId },
        data: {
          status: userStatusTypes?.DELETED,
          updatedAt: new Date(),
        },
      });
      if (deleted) {
        return res.status(201).json({ message: "User deleted successfully" });
      } else {
        return res.status(500).json({ message: "User delete failed" });
      }
    } else {
      return res.status(404).json({ error: "User not found!" });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
