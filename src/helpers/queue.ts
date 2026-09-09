import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractJson } from "./extractJSON";
import prisma from "./prismaClient";
import { createAndEmitNotification } from "../sockets/notificationEmitter";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const aiMatchmakingQueue = new Queue("ai-matchmaking", { connection });

const clampScore = (score: unknown): number => {
  const n = Number(score);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
};

const sanitizeReason = (reason: unknown): string => {
  if (typeof reason !== "string") return "";
  return reason.slice(0, 200);
};

export const createAiMatchmakingWorker = () => {
  const worker = new Worker(
    "ai-matchmaking",
    async (job) => {
      const { requestId, userId, interests, description, user, members, groups } = job.data;

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
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY!);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        aiResponseText = result.response.text().trim();
      } catch (err) {
        console.error("Gemini error in worker:", err);
        await prisma.matchmakingRequest.update({
          where: { id: requestId },
          data: {
            status: "failed",
            aiResponse: "Gemini API error. " + (err instanceof Error ? err.message : ""),
          },
        });
        try {
          await createAndEmitNotification({
            receiverId: userId,
            title: "AI Matchmaking Failed",
            message:
              "Your matchmaking request could not be completed. Please try again.",
          });
        } catch (notifyErr) {
          console.error("Failed to send matchmaking failure notification:", notifyErr);
        }
        return { success: false, error: "Gemini API error" };
      }

      const parsed = extractJson(aiResponseText);

      if (!parsed || typeof parsed !== "object") {
        await prisma.matchmakingRequest.update({
          where: { id: requestId },
          data: {
            status: "failed",
            aiResponse: aiResponseText,
          },
        });
        try {
          await createAndEmitNotification({
            receiverId: userId,
            title: "AI Matchmaking Failed",
            message:
              "Your matchmaking request could not be completed. Please try again.",
          });
        } catch (notifyErr) {
          console.error("Failed to send matchmaking failure notification:", notifyErr);
        }
        return { success: false, error: "Invalid JSON from AI" };
      }

      const { matchedUsers = [], matchedGroups = [], aiSummary = "" } = parsed as {
        matchedUsers: Array<{ userId: string; score?: number; reason?: string }>;
        matchedGroups: Array<{ groupId: string; score?: number; reason?: string }>;
        aiSummary: string;
      };

      const validUserIds = new Set((members as Array<{ id: string }>).map((m) => m.id));
      const validGroupIds = new Set((groups as Array<{ id: string }>).map((g) => g.id));

      const sanitizedUsers = matchedUsers
        .filter((m) => validUserIds.has(m.userId))
        .slice(0, 6)
        .map((match) => ({
          requestId,
          matchType: "user",
          matchedUserId: match.userId,
          score: clampScore(match.score),
          reason: sanitizeReason(match.reason),
        }));

      const sanitizedGroups = matchedGroups
        .filter((g) => validGroupIds.has(g.groupId))
        .slice(0, 4)
        .map((group) => ({
          requestId,
          matchType: "group",
          matchedGroupId: group.groupId,
          score: clampScore(group.score),
          reason: sanitizeReason(group.reason),
        }));

      await prisma.matchmakingRequest.update({
        where: { id: requestId },
        data: {
          status: "completed",
          aiSummary: aiSummary ? String(aiSummary).slice(0, 255) : null,
          aiNotes: "Parsed successfully",
          aiResponse: `Response parsed and matches recorded. We have ${sanitizedUsers.length} user matches and ${sanitizedGroups.length} group matches.`,
        },
      });

      await prisma.matchmakingItem.createMany({
        data: [...sanitizedUsers, ...sanitizedGroups],
      });

      try {
        await createAndEmitNotification({
          receiverId: userId,
          title: "AI Matchmaking Completed",
          message: `We found ${matchedUsers.length} member matches and ${matchedGroups.length} group matches for you!`,
        });
      } catch (notifyErr) {
        console.error("Failed to send matchmaking completion notification:", notifyErr);
      }

      return {
        success: true,
        requestId,
        matchedUsers: matchedUsers.length,
        matchedGroups: matchedGroups.length,
        aiSummary,
      };
    },
    { connection, concurrency: 5 }
  );

  worker.on("failed", async (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
    try {
      const userId = job?.data?.userId as string | undefined;
      if (userId) {
        await createAndEmitNotification({
          receiverId: userId,
          title: "AI Matchmaking Failed",
          message:
            "Your matchmaking request could not be completed. Please try again.",
        });
      }
    } catch (notifyErr) {
      console.error("Failed to send matchmaking failure notification:", notifyErr);
    }
  });

  return worker;
};