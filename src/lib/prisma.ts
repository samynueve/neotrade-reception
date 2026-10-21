import { PrismaClient } from "@prisma/client";

// Instance unique (évite d'ouvrir une connexion par rechargement à chaud en dev)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
