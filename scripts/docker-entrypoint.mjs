import { spawnSync } from "node:child_process";

function run(command, args) {
  console.log(`$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

if (process.env.TALENTRANK_RUN_MIGRATIONS === "true") {
  // The client is generated during the image build. Regenerating it here runs
  // as the unprivileged `nextjs` user against root-owned image files and can
  // prevent the container from ever reaching the HTTP server.
  run("node", ["scripts/release.mjs", "--migrate-only"]);
}

run("node", ["server.js"]);
