import { Prisma, PrismaClient } from "@prisma/client";

const RETRYABLE_READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

const RETRYABLE_DATABASE_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);

function isRetryableConnectionError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE_DATABASE_CODES.has(error.code);
  }
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("tls connection") ||
    message.includes("can't reach database server") ||
    message.includes("connection terminated") ||
    message.includes("server has closed the connection");
}

function waitForRetry() {
  return new Promise<void>((resolve) => setTimeout(resolve, 150));
}

export async function retryDatabaseRead<T>(query: () => Promise<T>) {
  try {
    return await query();
  } catch (error) {
    if (!isRetryableConnectionError(error)) throw error;
    await waitForRetry();
    return query();
  }
}

function createDatabaseClient(): PrismaClient {
  return new PrismaClient({ errorFormat: "minimal" }).$extends({
    name: "retry-transient-reads",
    query: {
      async $allOperations({ operation, args, query }) {
        if (!RETRYABLE_READ_OPERATIONS.has(operation)) return query(args);
        return retryDatabaseRead(() => query(args));
      },
    },
  }) as unknown as PrismaClient;
}

type DatabaseClient = PrismaClient;
const globalForPrisma = globalThis as unknown as { prisma?: DatabaseClient };

export const db = globalForPrisma.prisma ?? createDatabaseClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
