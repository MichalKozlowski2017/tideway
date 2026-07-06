import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20250706120000_article_slug_redirects.sql"),
  "utf8",
);

const password = readFileSync(
  resolve(process.cwd(), "config/supabase.credentials.local"),
  "utf8",
)
  .split("\n")
  .find((line) => line.startsWith("DB password:"))
  ?.replace("DB password:", "")
  .trim();

if (!password) throw new Error("Missing DB password in config/supabase.credentials.local");

const client = new pg.Client({
  host: "db.ilzffbrlponaxfbhduzz.supabase.co",
  port: 5432,
  user: "postgres",
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

await client.connect();
await client.query(sql);
const { rows } = await client.query(
  "SELECT count(*)::int AS cnt FROM article_slug_redirects",
);
console.log(`Migration applied. article_slug_redirects rows: ${rows[0].cnt}`);
await client.end();
