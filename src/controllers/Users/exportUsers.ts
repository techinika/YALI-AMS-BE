import ExcelJS from "exceljs";
import prisma from "../../helpers/prismaClient";
import cloudinary from "../../helpers/cloudinary";
import { Request, Response } from "express";
import { Readable } from "stream";

function buildBaseRow(user: any) {
  return {
    "First Name": user.firstName,
    "Middle Name": user.middleName ?? "",
    "Last Name": user.lastName,
    "Email Address": user.email,
    "Phone Number": user.phoneNumber ?? "",
    "WhatsApp Number": user.whatsappNumber ?? "",
    Gender: user.gender?.name ?? "",
    Biography: user.bio ?? "",
    "Country of Residence": user.residentCountry?.name ?? "",
    "District of Residence": user.residentDistrict?.name ?? "",
    "Sector of Residence": user.residentSector?.name ?? "",
    "State/Province": user.state?.name ?? "",
    Cohort: user.cohort?.name ?? "",
    Track: user.track?.name ?? "",
    "Profile Picture Link": user.profileImage?.link ?? "",

    "Organization Name": "",
    "Organization Relation": "",
    "Position in Organization": "",
    "Organization Website": "",
    "Organization Country": "",
    "Working Sectors (User-specific)": "",
  };
}

const uploadBufferToCloudinary = (
  buffer: Buffer,
  filename: string
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: "exports",
        public_id: filename,
        format: "xlsx",
        use_filename: true,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    Readable.from(buffer).pipe(stream);
  });
};

export const exportMembersWithOrganizations = async (
  requestingUserId: string
) => {
  const users = await prisma.user.findMany({
    where: {},
    include: {
      gender: true,
      residentCountry: true,
      residentDistrict: true,
      residentSector: true,
      state: true,
      cohort: true,
      track: true,
      profileImage: true,

      userOrganizations: {
        include: {
          organization: {
            include: {
              country: true,
              workingSector: true,
            },
          },
        },
      },

      organizationWorkingSectors: {
        include: {
          workingSector: true,
          organization: true,
        },
      },
    },
  });

  const rows: any[] = [];

  users.forEach((user) => {
    if (user.userOrganizations.length === 0) {
      rows.push(buildBaseRow(user));
      return;
    }

    const orgs = user?.userOrganizations;

    if (!orgs || orgs.length === 0) {
      rows.push({
        ...buildBaseRow(user),

        "Organization Name": "",
        "Organization Relation": "",
        "Position in Organization": "",
        "Organization Website": "",
        "Organization Country": "",
        "Working Sectors (User-specific)": "",

        Status: user?.status ?? "",
        "Created At": new Date(user.createdAt).toLocaleString(),
        "Last Updated": new Date(user.updatedAt).toLocaleString(),
      });
      return;
    }

    orgs.forEach((uo, index) => {
      const org = uo.organization;

      const sectors = user.organizationWorkingSectors
        .filter((ows) => ows.organizationId === org?.id)
        .map((ows) => ows.workingSector?.name)
        .filter(Boolean)
        .join(", ");

      rows.push({
        ...buildBaseRow(user),

        "Organization Name": org?.name ?? "",
        "Organization Relation": uo.relation,
        "Position in Organization": uo.position ?? "",
        "Organization Website": org?.website ?? "",
        "Organization Country": org?.country?.name ?? "",
        "Working Sectors (User-specific)": sectors,

        Status: user?.status ?? "",
        "Created At":
          index === 0 ? new Date(user.createdAt).toLocaleString() : "",
        "Last Updated":
          index === 0 ? new Date(user.updatedAt).toLocaleString() : "",
      });
    });
  });

  if (rows.length === 0) {
    throw new Error("No users found to export");
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Members & Organizations");

  worksheet.columns = Object.keys(rows[0]).map((key) => ({
    header: key,
    key,
    width: 25,
  }));

  rows.forEach((row) => worksheet.addRow(row));

  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center" };
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const uploadResult = await uploadBufferToCloudinary(
    buffer,
    `members-export-${Date.now()}.xlsx`
  );

  return {
    url: uploadResult.secure_url,
    publicId: uploadResult.public_id,
  };
};

export const exportMembersController = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.user.id;

    const result = await exportMembersWithOrganizations(userId);

    res.json({
      success: true,
      downloadUrl: result.url,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to export members",
    });
  }
};
