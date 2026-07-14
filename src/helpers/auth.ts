import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { userStatusTypes } from "../Types/users";
import prisma from "./prismaClient";

if (!process.env.SECRET_KEY) {
  throw new Error(
    "FATAL: SECRET_KEY environment variable is not set. Refusing to start."
  );
}

const secret: string = process.env.SECRET_KEY;

export const UserExistsWithId = async (userId: string): Promise<any> => {
  let user = await prisma.user.findUnique({
    where: {
      id: userId,
      status: {
        not: userStatusTypes?.DELETED,
      },
    },
  });

  return user;
};

export const UserExistsWithEmail = async (userEmail: string): Promise<any> => {
  let user = await prisma.user.findUnique({
    where: {
      email: userEmail,
      status: {
        not: userStatusTypes?.DELETED,
      },
    },
  });
  return user;
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  const hashedPass = await bcrypt.hash(password, salt);
  return hashedPass;
};

export const passwordCompare = async (
  password: string,
  hashedPass: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPass);
};

export const generateToken = (user: any): string => {
  const payload = {
    id: user?.id,
  };

  return jwt.sign(payload, secret, {
    expiresIn: "24h",
  });
};

export const verifyToken = (token: string) => {
  const decoded = jwt.verify(token, secret);
  return decoded;
};
