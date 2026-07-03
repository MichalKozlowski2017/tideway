import { readFileSync } from "fs";
import { resolve } from "path";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  process.env[trimmed.slice(0, eq)] ??= trimmed.slice(eq + 1);
}

const pattern = process.argv[2] ?? "World Cup quiz";
console.log(`Quiz preview — szukam pending: "${pattern}"\n`);

const { previewGenerateByTitle } = await import("../lib/ai/generate.ts");
const result = await previewGenerateByTitle(pattern);

console.log("\n", JSON.stringify(result, null, 2));
if (result.slug) {
  console.log(`\nPodgląd: http://localhost:3000/artykul/${result.slug}`);
}
