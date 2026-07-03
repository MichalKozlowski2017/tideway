import { getSupabaseAdmin } from "@/lib/db/supabase";
import type { QuizStats } from "@/lib/quiz/types";

export async function getQuizStats(articleId: string): Promise<QuizStats | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("score, total_questions")
    .eq("article_id", articleId);

  if (error || !data?.length) return null;

  const attemptCount = data.length;
  const scoreSum = data.reduce((sum, row) => sum + row.score, 0);
  const questionCount = data[0]?.total_questions ?? 0;

  return {
    attemptCount,
    averageScore: Math.round((scoreSum / attemptCount) * 10) / 10,
    questionCount,
  };
}

export async function recordQuizAttempt(params: {
  articleId: string;
  score: number;
  totalQuestions: number;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("quiz_attempts").insert({
    article_id: params.articleId,
    score: params.score,
    total_questions: params.totalQuestions,
  });
  if (error) throw error;
}
