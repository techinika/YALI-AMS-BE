import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { activityLoggerExtension } from "../middleware/log";
import "dotenv/config";

const rawPool = Number(process.env.CONNECTION_LIMIT);
const connectionLimit = Number.isFinite(rawPool)
  ? Math.min(50, Math.max(5, Math.floor(rawPool)))
  : 20;

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT ? Number(process.env.DATABASE_PORT) : 3306,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionLimit,
  allowPublicKeyRetrieval: true,
});

const prisma = new PrismaClient({ adapter }).$extends(activityLoggerExtension);

export default prisma;
