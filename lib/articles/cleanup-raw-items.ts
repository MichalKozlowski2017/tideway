import { getSql } from "@/lib/db/client";

export type RawItemsCleanupResult = {
  deletedPending: number;
  deletedTerminal: number;
  deletedProcessing: number;
};

export async function cleanupRawItems(): Promise<RawItemsCleanupResult> {
  const sql = getSql();
  const rows = await sql.query(`SELECT cleanup_raw_items() AS result`);
  const result = (rows[0] as { result: {
    deleted_pending: number;
    deleted_terminal: number;
    deleted_processing: number;
  } }).result;

  return {
    deletedPending: result.deleted_pending,
    deletedTerminal: result.deleted_terminal,
    deletedProcessing: result.deleted_processing,
  };
}
