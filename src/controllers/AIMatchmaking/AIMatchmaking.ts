import { Request, Response } from "express";
import prisma from "../../helpers/prismaClient";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractJson } from "../../helpers/extractJSON";
import { userStatusTypes } from "../../Types/users";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY!);

export const createMatchmakingRequest = async (req: Request, res: Response) => {
  const { interests, description, userId } = req.body;

  if (!userId || !interests) {
    return res.status(400).json({
      message: "userId, interests, and description are required.",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organizations: true },
    });

    const members = await prisma.user.findMany({
      where: {
        status: {
          not: userStatusTypes?.DELETED,
        },
      },
      include: {
        userOrganizations: {
          include: {
            organization: {
              include: {
                organizationWorkingSectors: true,
              },
            },
          },
        },
      },
    });

    const groups = await prisma.group.findMany();

    const requestRecord = await prisma.matchmakingRequest.create({
      data: {
        userId,
        interests,
        description:
          description ??
          "No description provided. Please use only interests provided to find matching users.",
        status: "pending",
      },
    });

    const prompt = `Act as a professional networking matchmaker for a leadership and entrepreneurship community.

### USER REQUEST DETAILS
- Interests: ${interests}
- Aspirations: ${description}
- User Profile Object: ${JSON.stringify(user)}

### MATCHING DATASET
You are given:
1. A list of existing users and the organizations they belong to:
${JSON.stringify(members)}

2. A list of existing community groups:
${JSON.stringify(groups)}

### YOUR GOAL
Analyze how compatible the requesting user is with the other available users and groups.

### MATCHING RULES
- Consider shared interests, aspirations, background, expertise, and organizational alignment.
- Prioritize users working in similar industries or pursuing complementary goals.
- Only return matches that **exist in the provided dataset**. Do NOT invent user IDs or group IDs.
- Give preference to users or groups that the requester is NOT already connected to.

### OUTPUT REQUIREMENTS
Return ONLY a **valid JSON object**, no commentary or explanation outside JSON.

### RETURN FORMAT
{
  "matchedUsers": [
    {
      "userId": "uuid",
      "score": number,            // 0–100 compatibility
      "reason": "Short explanation not exceeding 200 characters"
    }
  ],
  "matchedGroups": [
    {
      "groupId": "uuid",
      "score": number,            // 0–100 relevance
      "reason": "Short explanation not exceeding 200 characters"
    }
  ],
  "aiSummary": "One-paragraph summary of why these matches fit the user not exceeding 255 characters."
}

### LIMITS
- Max 6 matched users.
- Max 4 matched groups.
- Every score must be realistic and based on given data.
- All IDs MUST come only from the data provided.`;

    let aiResponseText = "";

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const result = await model.generateContent(prompt);

      aiResponseText = result.response.text().trim();
    } catch (err) {
      console.error("Gemini error:", err);

      await prisma.matchmakingRequest.update({
        where: { id: requestRecord.id },
        data: {
          status: "failed",
          aiResponse:
            "Gemini API error. " + (err instanceof Error ? err.message : ""),
        },
      });

      return res.status(500).json({
        message: "Failed to complete AI matchmaking.",
      });
    }

    const parsed = extractJson(aiResponseText);

    if (!parsed || typeof parsed !== "object") {
      await prisma.matchmakingRequest.update({
        where: { id: requestRecord.id },
        data: {
          status: "failed",
          aiResponse: aiResponseText,
        },
      });

      return res.status(500).json({
        message: "AI returned invalid JSON Response.",
        raw: aiResponseText,
      });
    }

    const { matchedUsers = [], matchedGroups = [], aiSummary = "" } = parsed;

    await prisma.matchmakingRequest.update({
      where: { id: requestRecord.id },
      data: {
        status: "completed",
        aiNotes: "Parsed successfully",
        aiResponse: `Response parsed and matches recorded, matches will be added to the database. We have ${matchedUsers.length} user matches and ${matchedGroups.length} group matches.`,
      },
    });

    let finalMatchedUsers = [];
    let finalMatchedGroups = [];

    for (const match of matchedUsers) {
      await prisma.matchmakingItem.create({
        data: {
          requestId: requestRecord.id,
          matchType: "user",
          matchedUserId: match.userId,
          score: match.score ?? 0,
          reason: "",
        },
      });

      const member = await prisma.user.findFirst({
        where: { id: match?.userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          bio: true,
          profileImage: true,
        },
      });

      finalMatchedUsers.push(member);
    }

    for (const group of matchedGroups) {
      const match = await prisma.matchmakingItem.create({
        data: {
          requestId: requestRecord.id,
          matchType: "group",
          matchedGroupId: group.groupId,
          score: group.score ?? 0,
          reason: "",
        },
      });

      if (!match.matchedGroupId) {
        continue;
      }

      const grp = await prisma.group.findFirst({
        where: { id: match.matchedGroupId },
        include: {
          members: true,
        },
      });

      if (grp) {
        finalMatchedGroups.push(grp);
      }
    }

    return res.status(201).json({
      message: "Matchmaking request completed",
      requestId: requestRecord.id,
      matches: {
        users: finalMatchedUsers,
        groups: finalMatchedGroups,
        reason: aiSummary,
      },
      aiSummary,
    });
  } catch (error) {
    console.error("Matchmaking error:", error);

    return res.status(500).json({
      message: "Internal server error.",
      error: error instanceof Error ? error.message : "",
    });
  }
};
