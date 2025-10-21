import { PrismaClient } from "./generated/prisma/index.js";

const prisma = new PrismaClient({ log: ["info", "warn", "error"] });

export default prisma;
