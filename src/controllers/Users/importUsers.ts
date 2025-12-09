import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { generateToken } from "../../helpers/auth";
import sendEmail from "../../helpers/sendMail";

const prisma = new PrismaClient();

export const importUsers = async (req: Request, res: Response) => {
  try {
    const { data }: any = req.body;
    const errors = [];
    const processedUsers = [];

    if (data.length === 0) {
      return res.status(400).send({ message: "The uploaded file is empty." });
    }

    for (const row of data) {
      try {
        if (row["Email Address"] === "") {
          errors.push({
            message: "This user has no email, skipping!",
            row,
          });
          continue;
        }

        const existingUser = await prisma.user.findFirst({
          where: { email: row["Email Address"] },
        });

        if (existingUser) {
          errors.push({
            message: "This user already exists, skipping!",
            row,
          });
          continue;
        }

        const organizationEmployed = {
          name:
            row[
              "Organization that employ you (If you are currently employed)"
            ] || "",
          website:
            row["Website of an Organization that Employs you (If available)"] ||
            "",
          country: row["Organization Address (Country)"] || "",
          workingSector: row["Working Sector of your Employer"] || "",
          createdAt: new Date(),
        };
        const organizationFounded = {
          name: row["Organization/Initiative you started (If available)"] || "",
          website:
            row["Website or any online presence of your initiative"] || "",
          country: row["Country of the initiative (District/Sector)"] || "",
          workingSector:
            row[
              "Main Sector of intervention (Eg: Finance, Education, Agribusiness, Etc)"
            ] || "",
          createdAt: new Date(),
        };

        const user = {
          firstName: row["First Name"] ?? "",
          middleName: row["Middle Name"] || "",
          lastName: row["Last Name"] || "",
          email: row["Email Address"] || "",
          phoneNumber: String(row["Phone Number"] || ""),
          whatsappNumber: String(row["WhatsApp Number"] || ""),
          linkedin: row["LinkedIn Profile"] || "",
          instagram: row["Instagram Profile"] || "",
          facebook: row["Facebook Profile"] || "",
          twitter: row["X (Twitter) Account"] || "",
          genderName: row["Gender"] || "",
          bio: row["Biography"] ?? "",
          residentCountry: row["Country of Residence"] || "",
          state: row["State/Province (If not in Rwanda)"] || "",
          residentDistrict: row["District of Residence"] || "",
          residentSector: row["Sector of Residence"] || "",
          nearestLandmark: row["Nearest Landmark"] || "",
          cohort: row["Cohort"] || "",
          track: row["Track"] || "",
          organizationFounded:
            row["Organization/Initiative you started (If available)"] || "",
          positionInFounded:
            row["Your Position in Initiative you Started"] || "",
          organizationEmployed:
            row[
              "Organization that employ you (If you are currently employed)"
            ] || "",
          positionInEmployed: row["Your position in your employment"] || "",
          profileImageLink: row["Profile Picture Link"] || "",
          createdAt: row["Created At"]
            ? new Date(row["Created At"])
            : new Date(),
          updatedAt: row["Last Updated"]
            ? new Date(row["Last Updated"])
            : new Date(),
          roleId: "12",
        };

        const refreshToken = generateToken(user);

        const [OFWS, OEWS, EC, FC, UC, cohort, track, district, sector, state] =
          await Promise.all([
            prisma.workingSector.findFirst({
              where: { name: organizationFounded?.workingSector },
            }),
            prisma.workingSector.findFirst({
              where: { name: organizationEmployed?.workingSector },
            }),
            prisma.country.findFirst({
              where: { name: organizationEmployed?.country },
            }),
            prisma.country.findFirst({
              where: { name: organizationFounded?.country },
            }),
            prisma.country.findFirst({
              where: { name: user?.residentCountry },
            }),
            prisma.cohort.findFirst({
              where: { name: String(user?.cohort) },
            }),
            prisma.track.findFirst({
              where: { name: String(user?.track) },
            }),
            prisma.district.findFirst({
              where: { name: String(user?.residentDistrict) },
            }),
            prisma.sector.findFirst({
              where: {
                districtName: user?.residentDistrict,
                name: user?.residentSector,
              },
            }),
            prisma.state.findFirst({
              where: {
                countryCode: user?.residentCountry?.id,
                name: user?.state,
              },
            }),
          ]);

        const [OF, OE] = await Promise.all([
          prisma.organization.create({
            data: {
              name: organizationFounded?.name,
              workingSector: {
                connect: {
                  name: OFWS ? OFWS?.name : "Not Specified",
                },
              },
              district: {
                connect: {
                  name: "Not Specified",
                },
              },
              sector: {
                connect: {
                  id: "unspecified",
                },
              },
              country: {
                connect: {
                  id: FC?.id ? FC?.id : "unspecified",
                },
              },
              website: organizationFounded?.website,
            },
          }),
          prisma.organization.create({
            data: {
              name: organizationEmployed?.name,
              workingSector: {
                connect: {
                  name: OEWS ? OEWS?.name : "Not Specified",
                },
              },
              country: {
                connect: {
                  id: EC?.id ? EC?.id : "unspecified",
                },
              },
              website: organizationEmployed?.website,
            },
          }),
        ]);

        const US = await prisma.user.create({
          data: {
            firstName: user.firstName,
            middleName: user.middleName,
            lastName: user.lastName,
            email: user.email,
            residentCountry: {
              connect: {
                id: UC ? UC?.id : "unspecified",
              },
            },
            residentDistrict: {
              connect: {
                id: district?.id ? district?.id : "unspecified",
              },
            },
            residentSector: {
              connect: {
                id: sector?.id ? sector?.id : "unspecified",
              },
            },
            phoneNumber: user.phoneNumber,
            whatsappNumber: user.whatsappNumber,
            gender: {
              connect: {
                name: user.genderName ? user?.genderName : "Not Specified",
              },
            },
            nearestLandmark: user.nearestLandmark,
            cohort: { connect: { id: cohort?.id ? cohort?.id : 1 } },
            track: {
              connect: { id: track?.id ? track?.id : "unspecified" },
            },
            organizationFounded: {
              connect: { id: OF.id },
            },
            positionInFounded: user.positionInFounded,
            organizationEmployed: {
              connect: { id: OE.id },
            },
            state: {
              connect: {
                id: state?.id ? state?.id : "unspecified",
              },
            },
            role: {
              connect: {
                id: user?.roleId ? user?.roleId : "12",
              },
            },
            positionInEmployed: user.positionInEmployed,
            refreshToken: refreshToken,
            facebook: user?.facebook,
            instagram: user?.instagram,
            linkedin: user?.linkedin,
            twitter: user?.twitter,
            createdAt: new Date(),
          },
        });

        processedUsers.push(US);

        const email = await sendEmail({
          subject: "Your profile on YALI AMS created successfully!",
          name: US.firstName,
          message: `<div><p style="font-size: 16px; line-height: 1.5; color: #333;">
  Your profile has been successfully created on YALI Alumni Management System (AMS). Please use the link below to set your password:
</p>
<p style="font-size: 16px; line-height: 1.5;">
  <a href="${process.env.FRONTEND_URL}/reset-password/${US.refreshToken}" style="color: #0073e6; text-decoration: none;">
    Set your password
  </a>
</p>
<p style="font-size: 14px; color: #777;">
  If you did not request this, please contact Admin immediately.
</p></div>`,
          receiver: US.email,
        });

        await prisma.notifications.create({
          data: {
            title: "ACCOUNT: Your new account has been created!",
            message: `<p>Hi ${user?.firstName},<br><p>Welcome aboard! Your account has been created and now you can start engaging with others through chats, and update your  profile from time to time!</p><p>Here's what you can do:</p><ul><li>Participate in conversations,</li><li>Monitor and update your profile,</li></ul><p>Again, you are most welcome, if you have any question, don't hesitate to contact the admin!</p><div><a href='/dashboard/chat'>Join Conversation</a><a href='/dashboard/profile'>View Profile</a></div><p>We hope you keep having a great time.</p><p>Best Regards,<br>The Admin</p>`,
            receiverId: US?.id,
            opened: false,
            createdAt: new Date(),
          },
        });
      } catch (err: any) {
        errors.push({ message: err.message, row });
      }
    }

    return res.status(201).send({
      message: "Users uploaded and processed successfully!",
      processedUsers,
      errors,
    });
  } catch (error: any) {
    console.log(error);
    return res
      .status(500)
      .send({ message: "An error occurred during processing.", error });
  }
};
