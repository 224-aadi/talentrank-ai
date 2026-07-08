import { spawnSync } from "node:child_process";

const steps = [
  ["node", ["scripts/check-deploy.mjs"]],
  ["npx", ["prisma", "generate"]],
  ["npx", ["prisma", "migrate", "deploy"]],
];

for (const [command, args] of steps) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log("\nRelease checks and migrations completed.");
