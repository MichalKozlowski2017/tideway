import { getSql } from "@/lib/db/client";
import type { QuizStats } from "@/lib/quiz/types";

export async function getQuizStats(articleId: string): Promise<QuizStats | null> {
  const sql = getSql();
  const data = (await sql.query(
    `SELECT score, total_questions FROM quiz_attempts WHERE article_id = $1`,
    [articleId],
  )) as Array<{ score: number; total_questions: number }>;

  if (!data.length) return null;

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
  const sql = getSql();
  await sql.query(
    `INSERT INTO quiz_attempts (article_id, score, total_questions)
     VALUES ($1, $2, $3)`,
    [params.articleId, params.score, params.totalQuestions],
  );
}
