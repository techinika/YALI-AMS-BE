import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { sendMailSync } from "./mailer";

export const emailConnection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  }
);

export const emailQueue = new Queue("emails", { connection: emailConnection });

export const isEmailQueueReady = (): boolean =>
  emailConnection.status === "ready";

export interface EmailJobData {
  receiver: string;
  subject: string;
  html: string;
  text?: string;
}

export const enqueueEmail = async (data: EmailJobData): Promise<void> => {
  await emailQueue.add("send", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  });
};

export const createEmailWorker = () => {
  const worker = new Worker(
    "emails",
    async (job) => {
      const { receiver, subject, html, text } = job.data as EmailJobData;
      const info = await sendMailSync({ to: receiver, subject, html, text });
      if (info?.messageId) {
        console.log(`[email] sent "${subject}" to ${receiver} (${info.messageId})`);
      }
    },
    { connection: emailConnection, concurrency: 3 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[email] job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[email] worker error:", err.message);
  });

  return worker;
};