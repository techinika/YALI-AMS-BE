import { Request, Response } from "express";
import sendEmail from "../../helpers/sendMail";
import { generateResetToken } from "../../helpers/auth";
import { userStatusTypes } from "../../Types/users";
import prisma from "../../helpers/prismaClient";

export const inviteUser = async (req: Request, res: Response) => {
  const { email, firstName } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (!firstName) {
    return res.status(400).json({ error: "First name is required" });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser && existingUser.status !== userStatusTypes?.DELETED) {
      return res
        .status(409)
        .json({ error: "A user with this email already exists." });
    }

    let targetUser;
    let inviteToken;

    if (existingUser && existingUser.status === userStatusTypes?.DELETED) {
      // 3. RE-INVITE: Update the existing deleted record
      inviteToken = generateResetToken(existingUser);
      targetUser = await prisma.user.update({
        where: { email },
        data: {
          firstName,
          lastName: "",
          middleName: "",
          status: userStatusTypes?.INVITED,
          refreshToken: inviteToken,
          password: "", // Reset password to ensure they must use the token
          // Reset other fields as necessary
        },
      });
    } else {
      // 4. NEW INVITE: Create a brand new record
      targetUser = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName: "",
          middleName: "",
          phoneNumber: "",
          whatsappNumber: "",
          bio: "",
          facebook: "",
          instagram: "",
          linkedin: "",
          twitter: "",
          password: "",
          status: userStatusTypes?.INVITED,
          createdAt: new Date(),
        },
      });
      inviteToken = generateResetToken(targetUser);
      targetUser = await prisma.user.update({
        where: { id: targetUser.id },
        data: { refreshToken: inviteToken },
      });
    }

    await sendEmail({
      subject: "Your YALI AMS Account Invitation",
      name: firstName,
      message: `
        <div>
          <p>You have been invited to join YALI Alumni Management System (AMS).</p>
          <p>Please click the link below to set your password and complete your profile:</p>
          <p>
            <a href="${process.env.FRONTEND_URL}/reset-password/${targetUser.refreshToken}">
              Complete Your Registration
            </a>
          </p>
          <p>If this wasn't you, please contact admin.</p>
        </div>
      `,
      receiver: email,
    });

    return res.status(201).json({
      message: "Invitation sent successfully",
      user: {
        id: targetUser.id,
        email: targetUser.email,
        firstName: targetUser.firstName,
        status: targetUser.status,
      },
    });
  } catch (err) {
    console.error("Invite user error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const reInviteUser = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const existing = await prisma.user.findFirst({
      where: {
        id: userId,
        status: {
          not: userStatusTypes?.DELETED,
        },
      },
    });
    if (!existing) {
      return res.status(404).json({ error: "This user does not exist." });
    }

    await sendEmail({
      subject: "REMINDER: Your YALI AMS Account Invitation",
      name: existing.firstName,
      message: `
        <div>
          <p>You have been invited to join YALI Alumni Management System (AMS).</p>
          <p>Please click the link below to set your password and complete your profile to get started:</p>
          <p>
            <a href="${process.env.FRONTEND_URL}/reset-password/${existing.refreshToken}">
              Complete Your Registration
            </a>
          </p>
          <p>If this wasn't you, please contact admin.</p>
        </div>
      `,
      receiver: existing.email,
    });

    return res.status(201).json({
      message: "Invitation sent successfully again.",
      user: {
        id: existing.id,
        email: existing.email,
        firstName: existing.firstName,
        status: existing.status,
      },
    });
  } catch (err) {
    console.error("Invite user error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
