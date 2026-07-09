import { readFileSync } from "fs";
import { resolve } from "path";
import { runGenerateBatches } from "../lib/generation/batch-runner.ts";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  process.env[trimmed.slice(0, eq)] ??= trimmed.slice(eq + 1);
}

const argRuns = Number(process.argv[2]);
const envRuns = Number(process.env.GENERATE_RUNS);
const runs =
  Number.isFinite(argRuns) && argRuns > 0
    ? argRuns
    : Number.isFinite(envRuns) && envRuns > 0
      ? envRuns
      : 2;

console.log("Tideway generate — start…");
console.log(`Batchy: ${runs} (panel: http://localhost:3000/local)\n`);

const summary = await runGenerateBatches({
  runs,
  onEvent: (event) => {
    if (event.type === "run_start") {
      console.log(`--- Run ${event.run}/${event.total} ---`);
    }
    if (event.type === "run_done") {
      console.log(`Run ${event.run} done:`, event.result, "\n");
    }
  },
});

console.log(JSON.stringify(summary, null, 2));
