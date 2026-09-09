import { Request, Response } from "express";
import { generateResetToken } from "../../helpers/auth";
import sendEmail from "../../helpers/sendMail";
import { escapeHtml } from "../../helpers/sendMail";
import { userStatusTypes } from "../../Types/users";
import prisma from "../../helpers/prismaClient";

const MAX_IMPORT_SIZE = 500;
const BATCH_SIZE = 10;
const DEFAULT_COHORT_ID = 1;
const DEFAULT_ROLE_ID = "12";

const cell = (row: any, key: string) => String(row?.[key] ?? "").trim();

export const importUsers = async (req: Request, res: Response) => {
  try {
    const { data }: any = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).send({ message: "The uploaded file is empty." });
    }

    if (data.length > MAX_IMPORT_SIZE) {
      return res
        .status(400)
        .send({
          message: `Import limited to ${MAX_IMPORT_SIZE} users per batch. You uploaded ${data.length}.`,
        });
    }

    const errors: any[] = [];
    const processedUsers: any[] = [];

    const [genders, workingSectors, countries, cohorts, tracks, districts, sectors, states] =
      await Promise.all([
        prisma.gender.findMany(),
        prisma.workingSector.findMany(),
        prisma.country.findMany(),
        prisma.cohort.findMany(),
        prisma.track.findMany(),
        prisma.district.findMany(),
        prisma.sector.findMany(),
        prisma.state.findMany(),
      ]);

    const genderByName = new Map(genders.map((g) => [g.name.toLowerCase(), g.name]));
    const workingSectorIdByName = new Map(
      workingSectors.map((w) => [w.name.toLowerCase(), w.id])
    );
    const countryIdByName = new Map(countries.map((c) => [c.name.toLowerCase(), c.id]));
    const countryIdByCode = new Map(countries.map((c) => [c.id, c.id]));
    const cohortByName = new Map(
      cohorts.filter((c) => c.name).map((c) => [c.name!.toLowerCase(), c.id])
    );
    const trackIdByName = new Map(tracks.map((t) => [t.name.toLowerCase(), t.id]));
    const districtByName = new Map(
      districts.map((d) => [d.name.toLowerCase(), d.name])
    );
    const sectorIdByName = new Map(
      sectors.map((s) => [`${s.districtName.toLowerCase()}|${s.name.toLowerCase()}`, s.id])
    );
    const stateIdByName = new Map<string, string>();
    for (const st of states) {
      const countryId = st.countryCode ? countryIdByCode.get(st.countryCode) : undefined;
      if (countryId) {
        stateIdByName.set(`${countryId}|${st.name.toLowerCase()}`, st.id);
      }
    }

    const emails = data
      .map((row: any) => cell(row, "Email Address").toLowerCase())
      .filter(Boolean);

    const existingEmails = new Set<string>(
      (
        await prisma.user.findMany({
          where: {
            email: { in: emails },
            status: { not: userStatusTypes?.DELETED },
          },
          select: { email: true },
        })
      ).map((u) => u.email)
    );

    const seenEmails = new Set<string>();

    const processRow = async (row: any) => {
      const email = cell(row, "Email Address").toLowerCase();

      if (!email) {
        return { ok: false, error: "This user has no email, skipping!" };
      }

      if (seenEmails.has(email)) {
        return { ok: false, error: "Duplicate email in file, skipping!" };
      }
      seenEmails.add(email);

      if (existingEmails.has(email)) {
        return { ok: false, error: "This user already exists, skipping!" };
      }

      const firstName =
        typeof row["First Name"] !== "undefined" && row["First Name"] !== null
          ? String(row["First Name"]).trim()
          : "";

      const employedOrg = {
        name: cell(row, "Organization that employ you (If you are currently employed)"),
        website: cell(row, "Website of an Organization that Employs you (If available)"),
        countryName: cell(row, "Organization Address (Country)"),
        workingSectorName: cell(row, "Working Sector of your Employer"),
        position: cell(row, "Your position in your employment"),
      };

      const foundedOrg = {
        name: cell(row, "Organization/Initiative you started (If available)"),
        website: cell(row, "Website or any online presence of your initiative"),
        countryName: cell(row, "Country of the initiative (District/Sector)"),
        workingSectorName: cell(
          row,
          "Main Sector of intervention (Eg: Finance, Education, Agribusiness, Etc)"
        ),
        position: cell(row, "Your Position in Initiative you Started"),
      };

      const residentCountryName = cell(row, "Country of Residence").toLowerCase();
      const residentDistrictName = cell(row, "District of Residence").toLowerCase();
      const residentSectorName = cell(row, "Sector of Residence").toLowerCase();
      const stateName = cell(row, "State/Province (If not in Rwanda)").toLowerCase();
      const cohortName = cell(row, "Cohort").toLowerCase();
      const trackName = cell(row, "Track").toLowerCase();
      const genderValue = cell(row, "Gender").toLowerCase();

      const residentCountryId = residentCountryName
        ? countryIdByName.get(residentCountryName)
        : undefined;
      const employedCountryId = employedOrg.countryName
        ? countryIdByName.get(employedOrg.countryName.toLowerCase())
        : undefined;
      const foundedCountryId = foundedOrg.countryName
        ? countryIdByName.get(foundedOrg.countryName.toLowerCase())
        : undefined;
      const districtName = residentDistrictName
        ? districtByName.get(residentDistrictName)
        : undefined;
      const sectorId = residentSectorName && districtName
        ? sectorIdByName.get(`${districtName.toLowerCase()}|${residentSectorName}`)
        : undefined;
      const stateId = residentCountryId && stateName
        ? stateIdByName.get(`${residentCountryId}|${stateName}`)
        : undefined;
      const cohortId = cohortName ? cohortByName.get(cohortName) : undefined;
      const trackId = trackName ? trackIdByName.get(trackName) : undefined;
      const employedSectorId = employedOrg.workingSectorName
        ? workingSectorIdByName.get(employedOrg.workingSectorName.toLowerCase())
        : undefined;
      const foundedSectorId = foundedOrg.workingSectorName
        ? workingSectorIdByName.get(foundedOrg.workingSectorName.toLowerCase())
        : undefined;
      const genderName = genderValue
        ? genderByName.get(genderValue) ?? "Not Specified"
        : "Not Specified";

      const userId = crypto.randomUUID();
      const refreshToken = generateResetToken({ id: userId });

      let US: any;
      try {
        US = await prisma.user.create({
          data: {
            id: userId,
            firstName,
            middleName: cell(row, "Middle Name"),
            lastName: cell(row, "Last Name"),
            email,
            phoneNumber: String(row["Phone Number"] ?? ""),
            whatsappNumber: String(row["WhatsApp Number"] ?? ""),
            linkedin: cell(row, "LinkedIn Profile"),
            instagram: cell(row, "Instagram Profile"),
            facebook: cell(row, "Facebook Profile"),
            twitter: cell(row, "X (Twitter) Account"),
            bio: row["Biography"] ?? "",
            residentCountry: residentCountryId
              ? { connect: { id: residentCountryId } }
              : undefined,
            residentDistrict: districtName
              ? { connect: { name: districtName } }
              : undefined,
            residentSector: sectorId
              ? { connect: { id: sectorId } }
              : undefined,
            state: stateId ? { connect: { id: stateId } } : undefined,
            cohort: {
              connect: { id: cohortId ? cohortId : DEFAULT_COHORT_ID },
            },
            track: trackId ? { connect: { id: trackId } } : undefined,
            gender: {
              connect: { name: genderName },
            },
            role: {
              connect: { id: DEFAULT_ROLE_ID },
            },
            nearestLandmark: cell(row, "Nearest Landmark"),
            status: userStatusTypes?.INACTIVE,
            refreshToken: refreshToken,
            createdAt: new Date(),
          },
        });
      } catch (err: any) {
        return { ok: false, error: err.message };
      }

      const orgCreates: Promise<any>[] = [
        foundedOrg.name
          ? prisma.organization.create({
              data: {
                name: foundedOrg.name,
                website: foundedOrg.website,
                country: foundedCountryId
                  ? { connect: { id: foundedCountryId } }
                  : undefined,
              },
            })
          : Promise.resolve(null),
        employedOrg.name
          ? prisma.organization.create({
              data: {
                name: employedOrg.name,
                website: employedOrg.website,
                country: employedCountryId
                  ? { connect: { id: employedCountryId } }
                  : undefined,
              },
            })
          : Promise.resolve(null),
      ];

      const [foundedOrgRecord, employedOrgRecord] = await Promise.all(orgCreates);

      const sideWrites: Promise<any>[] = [];

      if (foundedOrgRecord) {
        sideWrites.push(
          prisma.user_Organization.create({
            data: {
              organizationId: foundedOrgRecord.id,
              userId: US.id,
              relation: "founded",
              position: foundedOrg.position || null,
            },
          })
        );
        if (foundedSectorId) {
          sideWrites.push(
            prisma.organization_WorkingSector.create({
              data: {
                organizationId: foundedOrgRecord.id,
                workingSectorId: foundedSectorId,
                userId: US.id,
              },
            })
          );
        }
      }

      if (employedOrgRecord) {
        sideWrites.push(
          prisma.user_Organization.create({
            data: {
              organizationId: employedOrgRecord.id,
              userId: US.id,
              relation: "employed",
              position: employedOrg.position || null,
            },
          })
        );
        if (employedSectorId) {
          sideWrites.push(
            prisma.organization_WorkingSector.create({
              data: {
                organizationId: employedOrgRecord.id,
                workingSectorId: employedSectorId,
                userId: US.id,
              },
            })
          );
        }
      }

      sideWrites.push(
        sendEmail({
          subject: "Your profile on YALI AMS created successfully!",
          name: firstName,
          message: `<div><p style="font-size: 16px; line-height: 1.5; color: #333;">
  Your profile has been successfully created on YALI Alumni Management System (AMS). Please use the link below to set your password:
</p>
<p style="font-size: 16px; line-height: 1.5;">
  <a href="${process.env.FRONTEND_URL}/reset-password/${refreshToken}" style="color: #0073e6; text-decoration: none;">
    Set your password
  </a>
</p>
<p style="font-size: 14px; color: #777;">
  If you did not request this, please contact Admin immediately.
</p></div>`,
          receiver: email,
        }),
        prisma.notifications.create({
          data: {
            title: "ACCOUNT: Your new account has been created!",
            message: `<p>Hi ${escapeHtml(firstName)},<br><p>Welcome aboard! Your account has been created and now you can start engaging with others through chats, and update your  profile from time to time!</p><p>Here's what you can do:</p><ul><li>Participate in conversations,</li><li>Monitor and update your profile,</li></ul><p>Again, you are most welcome, if you have any question, don't hesitate to contact the admin!</p><div><a href='/dashboard/chat'>Join Conversation</a><a href='/dashboard/profile'>View Profile</a></div><p>We hope you keep having a great time.</p><p>Best Regards,<br>The Admin</p>`,
            receiverId: US.id,
            opened: false,
            createdAt: new Date(),
          },
        })
      );

      try {
        await Promise.all(sideWrites);
      } catch (err: any) {
        return { ok: true, user: US, partial: err.message };
      }

      return { ok: true, user: US };
    };

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map((row: any) => processRow(row)));

      batch.forEach((row: any, idx: number) => {
        const result = results[idx];
        if (result.ok) {
          processedUsers.push(result.user);
          if (result.partial) {
            errors.push({
              message: `User created (${result.user.email}) but some follow-up actions failed: ${result.partial}`,
            });
          }
        } else {
          errors.push({
            message: result.error,
            row,
          });
        }
      });
    }

    const safeUsers = processedUsers.map((u: any) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      status: u.status,
    }));

    return res.status(201).send({
      message: "Users uploaded and processed successfully!",
      processedUsers: safeUsers,
      errors,
    });
  } catch (error: any) {
    console.log(error);
    return res
      .status(500)
      .send({ message: "An error occurred during processing.", error });
  }
};