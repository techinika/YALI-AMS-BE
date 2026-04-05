import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractJson } from "./extractJSON";
import prisma from "./prismaClient";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const aiMatchmakingQueue = new Queue("ai-matchmaking", { connection });

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
        return { success: false, error: "Invalid JSON from AI" };
      }

      const { matchedUsers = [], matchedGroups = [], aiSummary = "" } = parsed as {
        matchedUsers: Array<{ userId: string; score?: number }>;
        matchedGroups: Array<{ groupId: string; score?: number }>;
        aiSummary: string;
      };

      await prisma.matchmakingRequest.update({
        where: { id: requestId },
        data: {
          status: "completed",
          aiNotes: "Parsed successfully",
          aiResponse: `Response parsed and matches recorded. We have ${matchedUsers.length} user matches and ${matchedGroups.length} group matches.`,
        },
      });

      const userMatchItems = matchedUsers.map((match) => ({
        requestId,
        matchType: "user",
        matchedUserId: match.userId,
        score: match.score ?? 0,
        reason: "",
      }));

      const groupMatchItems = matchedGroups.map((group) => ({
        requestId,
        matchType: "group",
        matchedGroupId: group.groupId,
        score: group.score ?? 0,
        reason: "",
      }));

      await prisma.matchmakingItem.createMany({
        data: [...userMatchItems, ...groupMatchItems],
      });

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

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
  });

  return worker;
};