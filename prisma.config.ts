import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "prisma/config";

if (existsSync(".env.local")) loadEnvFile(".env.local");
else if (existsSync(".env")) loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  engine: "classic",
  datasource: {
    // Runtime serverless usa o pooler transacional; migrações preferem a
    // conexão de sessão/direta para manter continuidade de sessão. O valor
    // neutro permite `prisma generate` no postinstall; migrações sem uma URL
    // configurada ainda falham ao tentar abrir a conexão, como devem.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "postgresql://postgres:placeholder@localhost:5432/postgres",
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
