import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig, env } from "prisma/config";

if (existsSync(".env.local")) loadEnvFile(".env.local");
else if (existsSync(".env")) loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  engine: "classic",
  datasource: {
    // Runtime serverless usa o pooler transacional; migrações preferem a
    // conexão de sessão/direta para manter continuidade de sessão.
    url: process.env.DIRECT_URL ?? env("DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
