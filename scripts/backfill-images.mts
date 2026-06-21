import { readFileSync } from "fs";
import { resolve } from "path";

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  process.env[trimmed.slice(0, eq)] ??= trimmed.slice(eq + 1);
}

console.log("Tideway — backfill obrazów artykułów…\n");

const { backfillArticleImages } = await import("../lib/articles/backfill-images.ts");

const result = await backfillArticleImages({ concurrency: 5 });
console.log("\n", JSON.stringify(result, null, 2));
