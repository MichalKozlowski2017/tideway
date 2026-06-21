import { readFileSync } from "fs";
import { resolve } from "path";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  process.env[trimmed.slice(0, eq)] ??= trimmed.slice(eq + 1);
}

console.log("Tideway generate — start…");
console.log("(Produkcja: 1 batch co 30 min. Lokalnie: 2 batche testowe.)\n");

const { generatePendingArticles } = await import("../lib/ai/generate.ts");

let totalGenerated = 0;
let totalTokens = 0;
const runs = 2;

for (let i = 0; i < runs; i += 1) {
  console.log(`--- Run ${i + 1}/${runs} ---`);
  const result = await generatePendingArticles();
  totalGenerated += result.generated;
  totalTokens += result.tokensUsed;
  console.log(`Run ${i + 1} done:`, result, "\n");
  if (result.generated === 0) break;
}

console.log(
  JSON.stringify({ totalGenerated, totalTokens, runs }, null, 2),
);
