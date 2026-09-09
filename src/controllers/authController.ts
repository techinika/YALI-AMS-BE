import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { generateToken, generateResetToken, hashPassword, verifyToken } from "../helpers/auth";
import { revokeToken, isTokenRevoked } from "../helpers/tokenStore";
import sendEmail from "../helpers/sendMail";
import { userStatusTypes } from "../Types/users";
import prisma from "../helpers/prismaClient";
import { AuthenticatedRequest } from "../middleware/auth";
import { z } from "zod";

const PASSWORD_MIN_LENGTH = 8;

const changePasswordSchema = z.object({
  pastPassword: z.string().min(1, "Current password is required"),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

const requestLinkSchema = z.object({
  email: z.string().email("Invalid email format"),
});

const excludeSensitiveFields = (user: any) => {
  const { password, refreshToken, token, ...safeUser } = user;
  return safeUser;
};

interface AuthController {
  login(req: Request, res: Response): Promise<Response>;
  logout(req: Request, res: Response): Promise<Response>;
  requestLink(req: Request, res: Response): Promise<Response>;
  resetPassword(req: Request, res: Response): Promise<Response>;
  changePassword(req: Request, res: Response): Promise<Response>;
  extendSession(req: Request, res: Response): Promise<Response>;
}

const AuthController: AuthController = {
  login: async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { email, password } = parsed.data;
    try {
      const user = await prisma.user.findUnique({
        where: {
          email,
          status: {
            not: userStatusTypes?.DELETED,
          },
        },
        include: {
          gender: true,
          residentCountry: true,
          residentDistrict: true,
          residentSector: true,
          cohort: true,
          role: true,
          track: true,
          profileImage: true,
        },
      });
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      if (user.status !== userStatusTypes?.ACTIVE) {
        return res.status(403).json({
          error: "Account is not active. Please contact support.",
        });
      }
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = generateToken(user);

      const updatedUser = await prisma.user.update({
        where: {
          id: user.id,
          status: {
            not: userStatusTypes?.DELETED,
          },
        },
        data: { token },
      });

      if (updatedUser) {
        return res
          .status(200)
          .json({ status: 200, message: "Login successful", token, user: excludeSensitiveFields(user) });
      } else {
        return res.status(500).json({ status: 500, message: "Login failed" });
      }
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },

  extendSession: async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const presentedToken = authHeader.split(" ")[1];

    try {
      let decoded: { id: string };
      try {
        decoded = verifyToken(presentedToken) as { id: string };
      } catch {
        return res
          .status(401)
          .json({ message: "Session expired, please log in again" });
      }

      if (await isTokenRevoked(presentedToken)) {
        return res
          .status(401)
          .json({ message: "Session expired, please log in again" });
      }

      const user = await prisma.user.findUnique({
        where: {
          id: decoded.id,
          status: {
            not: userStatusTypes?.DELETED,
          },
        },
        include: {
          role: true,
        },
      });

      if (!user || user.status !== userStatusTypes?.ACTIVE) {
        return res
          .status(401)
          .json({ message: "Session expired, please log in again" });
      }

      const token = generateToken(user);

      await prisma.user.update({
        where: { id: user.id },
        data: { token },
      });

      return res.status(200).json({
        status: 200,
        message: "Session extended",
        token,
        user: excludeSensitiveFields(user),
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },

  changePassword: async (req: AuthenticatedRequest, res: Response) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { pastPassword, password } = parsed.data;
    const userId = req.user?.id;
    try {
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
          status: {
            not: userStatusTypes?.DELETED,
          },
        },
      });
      if (!user) {
        return res.status(401).json({ error: "User do not exist" });
      }
      const passwordMatch = await bcrypt.compare(pastPassword, user.password);
      if (!passwordMatch) {
        return res
          .status(401)
          .json({ error: "Enter correct password, or use forgot password!" });
      }

      const newPassword = await hashPassword(password);

      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : undefined;
      await revokeToken(token);

      const updatedUser = await prisma.user.update({
        where: {
          id: user.id,
          status: {
            not: userStatusTypes?.DELETED,
          },
        },
        data: { password: newPassword, token: null, refreshToken: null },
      });

      if (updatedUser) {
        return res.status(200).json({
          status: 200,
          message: "Password change is successful, please log in again.",
        });
      } else {
        return res
          .status(500)
          .json({ status: 500, message: "Password change failed" });
      }
    } catch (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },

  logout: async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    try {
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : undefined;
      await revokeToken(token);

      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });
      if (!user) {
        return res.status(401).json({ error: "User do not exist!" });
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { token: null, refreshToken: null },
      });

      if (updatedUser) {
        return res
          .status(200)
          .json({ status: 200, message: "Logout successful" });
      } else {
        return res.status(500).json({ status: 500, message: "Logout failed" });
      }
    } catch (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },

  requestLink: async (req, res) => {
    const parsed = requestLinkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { email } = parsed.data;
    try {
      const user = await prisma.user.findUnique({
        where: {
          email,
          status: {
            not: userStatusTypes?.DELETED,
          },
        },
        include: {
          role: true,
          track: true,
          profileImage: true,
        },
      });
      if (user) {
        const refreshToken = generateResetToken(user);
        const updatedUser = await prisma.user.update({
          where: {
            id: user.id,
            status: {
              not: userStatusTypes?.DELETED,
            },
          },
          data: { refreshToken },
        });

        if (updatedUser) {
          const email = await sendEmail({
            receiver: user.email,
            subject: "Reset Password",
            name: user?.firstName,
            message: `<div><p style="font-size: 16px; line-height: 1.5; color: #333;">
              We received a request to reset your password. Please click on the link below to reset your password:
            </p>
            <p style="font-size: 16px; line-height: 1.5;">
              <a href="${process.env.FRONTEND_URL}/reset-password/${updatedUser.refreshToken}" style="color: #0073e6; text-decoration: none;">
                Reset Password
              </a>
            </p>
            <p style="font-size: 14px; color: #777;">
              If you did not request this password reset, please ignore this email.
            </p></div>`,
          });
          if (email.status === 200) {
            return res.status(201).json({
              message: "Link sent successfully, check your email!",
              ...email,
            });
          } else {
            return res.status(500).json({
              message: "Failed to send the email, try again!",
              ...email,
            });
          }
        } else {
          return res.status(500).json({
            message: "Failed to reset the password, try again!",
          });
        }
      } else {
        return res.status(404).json({ message: "User is not found!" });
      }
    } catch (error: any) {
      console.error("requestLink error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },

  resetPassword: async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { token, newPassword } = parsed.data;
    try {
      let dataFromToken: any;
      try {
        dataFromToken = await verifyToken(token);
      } catch (err) {
        return res.status(401).json({ error: "Invalid or expired reset token" });
      }
      if (!dataFromToken?.id) {
        return res.status(401).json({ error: "Invalid or expired reset token" });
      }
      const user = await prisma.user.findUnique({
        where: {
          id: dataFromToken?.id,
          status: {
            not: userStatusTypes?.DELETED,
          },
        },
      });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (user.refreshToken !== token) {
        return res.status(401).json({ error: "Invalid or expired reset token" });
      }
      const hashedPassword = await hashPassword(newPassword);
      await prisma.user.update({
        where: {
          id: user.id,
          status: {
            not: userStatusTypes?.DELETED,
          },
        },
        data: {
          password: hashedPassword,
          refreshToken: null,
          status: userStatusTypes?.ACTIVE,
        },
      });

      const email = await sendEmail({
        receiver: user.email,
        subject: "Password Reset Successful",
        name: user?.firstName,
        message: `
  <div><p style="font-size: 16px; line-height: 1.5; color: #333;">
  Your password has been successfully changed. If you did not make this change, please contact Admin immediately.
</p>
<p style="font-size: 16px; line-height: 1.5;">
  You can now log in to your account using your new password by clicking the link below:
</p>
<p style="font-size: 16px; line-height: 1.5;">
  <a href="${process.env.FRONTEND_URL}" style="color: #0073e6; text-decoration: none;">
    Log in to your account
  </a>
</p>
<p style="font-size: 14px; color: #777;">
  If you have any questions or encounter any issues, feel free to reach out to us.
</p></div>
`,
      });

      if (email.status === 200) {
        return res.status(201).json({
          message: "Your password has been changed successfully!",
        });
      } else {
        return res.status(500).json({
          message: "Failed to send the email!",
          ...email,
        });
      }
    } catch (error: any) {
      return res.status(500).json({ error: "Internal Server Error" });
    }
  },
};

export default AuthController;
