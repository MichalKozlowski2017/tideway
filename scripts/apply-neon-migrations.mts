/**
 * One-shot: apply supabase/migrations + seed to Neon.
 * Usage: DATABASE_URL=... npx tsx scripts/apply-neon-migrations.mts
 */
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL");
}

const sql = neon(databaseUrl);
const migrationsDir = resolve(process.cwd(), "supabase/migrations");

async function execSql(label: string, text: string) {
  // Split on semicolons carefully enough for our migration files
  // (no dollar-quoted strings that contain bare `;` outside blocks — our files use $$ … $$).
  const statements = splitSqlStatements(text);
  for (const statement of statements) {
    const trimmed = statement.trim();
    if (!trimmed || trimmed.startsWith("--")) continue;
    try {
      await sql.query(trimmed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${label}: ${message}\n---\n${trimmed.slice(0, 400)}`);
    }
  }
}

function splitSqlStatements(text: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inDollar = false;
  let dollarTag = "";

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (!inDollar && ch === "$") {
      const rest = text.slice(i);
      const match = rest.match(/^\$([a-zA-Z_]*)\$/);
      if (match) {
        inDollar = true;
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length - 1;
        continue;
      }
    }

    if (inDollar && text.startsWith(dollarTag, i)) {
      current += dollarTag;
      i += dollarTag.length - 1;
      inDollar = false;
      dollarTag = "";
      continue;
    }

    if (!inDollar && ch === ";") {
      statements.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim()) statements.push(current);
  return statements;
}

const files = (await readdir(migrationsDir))
  .filter((name) => name.endsWith(".sql"))
  .sort();

console.log("Creating auth.role() stub for Supabase-compatible policies…");
await execSql(
  "auth stub",
  `
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE OR REPLACE FUNCTION auth.role()
  RETURNS text
  LANGUAGE sql
  STABLE
  AS $$ SELECT 'service_role'::text $$;
  `,
);

for (const file of files) {
  const path = resolve(migrationsDir, file);
  const body = await readFile(path, "utf8");
  console.log(`Applying ${file}…`);
  await execSql(file, body);
}

const seedPath = resolve(process.cwd(), "supabase/seed.sql");
const seed = await readFile(seedPath, "utf8");
console.log("Applying seed.sql…");
await execSql("seed.sql", seed);

const [{ count }] = await sql`select count(*)::int as count from sources`;
console.log(`Done. sources count = ${count}`);
