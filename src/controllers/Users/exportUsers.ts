import ExcelJS from "exceljs";
import prisma from "../../helpers/prismaClient";
import cloudinary from "../../helpers/cloudinary";
import { Request, Response } from "express";
import { Readable } from "stream";
import { userStatusTypes } from "../../Types/users";

function buildBaseRow(user: any, include: boolean) {
  return {
    "First Name": include ? user.firstName : "-",
    "Middle Name": include ? user.middleName ?? "-" : "-",
    "Last Name": include ? user.lastName : "-",
    "Email Address": include ? user.email : "-",
    "Phone Number": include ? user.phoneNumber ?? "-" : "-",
    "WhatsApp Number": include ? user.whatsappNumber ?? "-" : "-",
    Gender: include ? user.gender?.name ?? "-" : "-",
    Biography: include ? user.bio ?? "-" : "-",
    "Country of Residence": include ? user.residentCountry?.name ?? "-" : "-",
    "District of Residence": include ? user.residentDistrict?.name ?? "-" : "-",
    "Sector of Residence": include ? user.residentSector?.name ?? "-" : "-",
    "State/Province": include ? user.state?.name ?? "-" : "-",
    Cohort: include ? user.cohort?.name ?? "-" : "-",
    Track: include ? user.track?.name ?? "-" : "-",
    "Nearest Landmark": include ? user.nearestLandmark ?? "-" : "-",

    "Organization Name": "-",
    "Organization Relation": "-",
    "Position in Organization": "-",
    "Organization Website": "-",
    "Organization Country": "-",
    "Working Sectors (User-specific)": "-",

    Status: include ? user?.status : "-",
    "Created At": "",
    "Last Updated": "",
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
        expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    Readable.from(buffer).pipe(stream);
  });
};

export const exportMembersWithOrganizations = async () => {
  const users = await prisma.user.findMany({
    where: {
      status: {
        not: userStatusTypes?.DELETED,
      },
    },
    orderBy: { createdAt: "asc" },
    include: {
      gender: true,
      residentCountry: true,
      residentDistrict: true,
      residentSector: true,
      state: true,
      cohort: true,
      track: true,

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
    const orgs = user?.userOrganizations;

    if (!orgs || orgs.length === 0) {
      rows.push({
        ...buildBaseRow(user, true),

        "Organization Name": "",
        "Organization Relation": "",
        "Position in Organization": "",
        "Organization Website": "",
        "Organization Country": "",
        "Working Sectors (User-specific)": "",

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
        ...buildBaseRow(user, index === 0),

        "Organization Name": org?.name ?? "",
        "Organization Relation": uo.relation,
        "Position in Organization": uo.position ?? "",
        "Organization Website": org?.website ?? "",
        "Organization Country": org?.country?.name ?? "",
        "Working Sectors (User-specific)": sectors,

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

    const result = await exportMembersWithOrganizations();

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
