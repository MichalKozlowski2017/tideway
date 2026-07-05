import { getSupabaseAdmin } from "@/lib/db/supabase";

export type RawItemsCleanupResult = {
  deletedPending: number;
  deletedTerminal: number;
  deletedProcessing: number;
};

export async function cleanupRawItems(): Promise<RawItemsCleanupResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("cleanup_raw_items");

  if (error) throw error;

  const result = data as {
    deleted_pending: number;
    deleted_terminal: number;
    deleted_processing: number;
  };

  return {
    deletedPending: result.deleted_pending,
    deletedTerminal: result.deleted_terminal,
    deletedProcessing: result.deleted_processing,
  };
}
