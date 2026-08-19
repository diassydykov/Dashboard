import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
}

if (!process.env.DATABASE_URL) {
  console.error(
    "Нет DATABASE_URL / POSTGRES_PRISMA_URL. Подключите Supabase в Vercel Marketplace или задайте переменные вручную.",
  );
  process.exit(1);
}

console.log("Prisma: DATABASE_URL задан, запускаем generate + migrate deploy.");

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["prisma", "generate"]);
run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["next", "build"]);
