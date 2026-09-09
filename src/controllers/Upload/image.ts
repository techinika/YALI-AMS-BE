import fs from "fs";
import prisma from "../../helpers/prismaClient";
import cloudinary from "../../helpers/cloudinary";
import { AuthenticatedRequest } from "../../middleware/auth";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const uploadToCloudinary = (filePath: string) => {
  return cloudinary.uploader.upload(filePath, {
    resource_type: "image",
  });
};

const removeTempFile = (tempFilePath?: string) => {
  if (!tempFilePath) return;
  try {
    fs.unlinkSync(tempFilePath);
  } catch (err) {
    console.error("Failed to remove temp file:", err);
  }
};

export const uploadImage = async (req: AuthenticatedRequest, res: any) => {
  const { files, user } = req as any;
  const profileImage = files?.profileImage;

  if (!profileImage) {
    return res.status(400).send({ message: "No file uploaded." });
  }

  const creatorId = user?.id;
  if (!creatorId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (!ALLOWED_MIME_TYPES.has(profileImage.mimetype)) {
    removeTempFile(profileImage.tempFilePath);
    return res.status(400).json({
      message: "Invalid file type. Only jpeg, png, webp, and gif images are allowed.",
    });
  }

  if (profileImage.truncated || profileImage.size > MAX_FILE_BYTES) {
    removeTempFile(profileImage.tempFilePath);
    return res.status(413).json({ message: "File too large. Maximum size is 10MB." });
  }

  try {
    const result: any = await uploadToCloudinary(profileImage.tempFilePath);
    removeTempFile(profileImage.tempFilePath);

    const image = await prisma.image.create({
      data: {
        name: profileImage.name,
        link: result?.secure_url,
        creatorId,
        createdAt: new Date(),
      },
    });

    return res.status(200).send({
      image,
      message: "File uploaded successfully!",
      name: profileImage.name,
    });
  } catch (error: any) {
    removeTempFile(profileImage.tempFilePath);
    console.error(error?.message ?? error);
    return res
      .status(500)
      .json({ error: "Internal Server Error", message: error?.message });
  }
};