import { spawnSync } from "node:child_process";

function run(command, args) {
  console.log(`$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

if (process.env.TALENTRANK_RUN_MIGRATIONS === "true") {
  run("node", ["scripts/release.mjs"]);
}

run("node", ["server.js"]);
