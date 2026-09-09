import { Request, Response } from "express";
import sendEmail, { escapeHtml } from "../../helpers/sendMail";
import { notificationTypes } from "../notificationController";
import { safeConnect } from "../../helpers/safeConnect";
import { userStatusTypes } from "../../Types/users";
import { resolveGenderName } from "../../helpers/gender";
import prisma from "../../helpers/prismaClient";

export const updateUser = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { user } = req.body;

  try {    const existing = await prisma.user.findUnique({
      where: {
        id: userId,
        status: {
          not: userStatusTypes?.DELETED,
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ message: "User does not exist!" });
    }

    const userUpdateData: any = {
      firstName: user?.firstName ?? existing.firstName,
      middleName: user?.middleName ?? existing.middleName,
      lastName: user?.lastName ?? existing.lastName,
      email: user?.email ?? existing.email,
      phoneNumber: user?.phoneNumber ?? existing.phoneNumber,
      whatsappNumber: user?.whatsappNumber ?? existing.whatsappNumber,
      nearestLandmark: user?.nearestLandmark ?? existing.nearestLandmark,
      bio: user?.bio ?? existing.bio,

      facebook: user?.facebook ?? existing.facebook,
      instagram: user?.instagram ?? existing.instagram,
      linkedin: user?.linkedin ?? existing.linkedin,
      twitter: user?.twitter ?? existing.twitter,
    };

    if (user?.residentDistrictId)
      userUpdateData.residentDistrict = safeConnect(user.residentDistrictId);

    if (user?.residentCountryId)
      userUpdateData.residentCountry = safeConnect(user.residentCountryId);

    if (user?.residentSectorId)
      userUpdateData.residentSector = safeConnect(user.residentSectorId);

    if (user?.state) userUpdateData.state = safeConnect(user.state);

    if (user?.cohortId) userUpdateData.cohort = safeConnect(user.cohortId);

    if (user?.trackId) userUpdateData.track = safeConnect(user.trackId);

    if (user?.genderName) {
      const genderName = await resolveGenderName(user.genderName);
      if (genderName) userUpdateData.genderName = genderName;
    }

    if (user?.profileImageId)
      userUpdateData.profileImage = safeConnect(user.profileImageId);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: userUpdateData,
    });

    const notificationToSend = await prisma.notificationSetup.findFirst({
      where: { usage: notificationTypes.UPDATED },
    });

    if (notificationToSend) {
      const notification = {
        title: "UPDATED: Your account has been updated!",
        message: notificationToSend.message.replace(
          /\[name\]/g,
          updatedUser.firstName
        ),
        receiverId: updatedUser.id,
        opened: false,
        createdAt: new Date(),
      };

      await prisma.notifications.create({ data: notification });

      await sendEmail({
        subject: notification.title,
        name: updatedUser.firstName,
        message: notificationToSend.message.replace(
          /\[name\]/g,
          escapeHtml(updatedUser.firstName)
        ),
        receiver: updatedUser.email,
      });
    }

    return res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
