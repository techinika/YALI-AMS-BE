import { PrismaClient } from "@prisma/client";
import { attachActivityLogger } from "../middleware/log";

const prisma = new PrismaClient();

attachActivityLogger(prisma);

export default prisma;
