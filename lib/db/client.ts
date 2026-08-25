import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export type Sql = NeonQueryFunction<false, false>;

let sqlClient: Sql | null = null;

export function hasDatabaseConfig(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getSql(): Sql {
  if (!sqlClient) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("Missing environment variable: DATABASE_URL");
    }
    sqlClient = neon(url);
  }
  return sqlClient;
}

/** @deprecated Use hasDatabaseConfig */
export const hasSupabaseConfig = hasDatabaseConfig;
