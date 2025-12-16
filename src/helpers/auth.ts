import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { userStatusTypes } from "../Types/users";
import prisma from "./prismaClient";

const secret: string = process.env.SECRET_KEY
  ? process.env.SECRET_KEY
  : "secret";

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

export const hashPassword = (password: string): string => {
  let salt = bcrypt.genSaltSync(10);
  let hashedPass = bcrypt.hashSync(password, salt);
  return hashedPass;
};

export const passwordCompare = (
  password: string,
  hashedPass: string
): boolean => {
  let answer = bcrypt.compareSync(password, hashedPass);
  return answer;
};

export const generateToken = (user: any): string => {
  const payload = {
    id: user?.id,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    email: user.email,
    role: user?.role,
    profilePicture: user?.profileImage,
  };

  return jwt.sign(payload, secret, {
    expiresIn: "24h",
  });
};

export const verifyToken = (token: string) => {
  const decoded = jwt.verify(token, secret);
  return decoded;
};
