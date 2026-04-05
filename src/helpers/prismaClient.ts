import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { activityLoggerExtension } from "../middleware/log";
import "dotenv/config";

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT ? Number(process.env.DATABASE_PORT) : 3306,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionLimit: Number(process.env.CONNECTION_LIMIT) || 20,
  allowPublicKeyRetrieval: true,
});

console.log("Connecting to MariaDB at: ", process.env.DATABASE_HOST);
console.log("Connecting to MariaDB at: ", adapter);

const prisma = new PrismaClient({ adapter }).$extends(activityLoggerExtension);

export default prisma;
