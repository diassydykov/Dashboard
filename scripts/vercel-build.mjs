import { spawnSync } from "node:child_process";

if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
  console.log("DIRECT_URL не задан — для миграций используется DATABASE_URL.");
}

if (!process.env.DATABASE_URL) {
  console.error("Нет DATABASE_URL. Добавьте её в Environment Variables на Vercel.");
  process.exit(1);
}

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
