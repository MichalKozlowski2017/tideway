import { NextRequest, NextResponse } from "next/server";
import { getQuizStats, recordQuizAttempt } from "@/lib/quiz/stats";
import { parseQuizQuestions } from "@/lib/quiz/types";
import { getSql } from "@/lib/db/client";

type RouteContext = { params: Promise<{ articleId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { articleId } = await context.params;
  const stats = await getQuizStats(articleId);
  if (!stats) {
    return NextResponse.json({
      attemptCount: 0,
      averageScore: 0,
      questionCount: 0,
    });
  }
  return NextResponse.json(stats);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { articleId } = await context.params;

  let body: { score?: number; total?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const score = body.score;
  const total = body.total;
  if (
    typeof score !== "number" ||
    typeof total !== "number" ||
    !Number.isInteger(score) ||
    !Number.isInteger(total) ||
    score < 0 ||
    total < 1 ||
    score > total
  ) {
    return NextResponse.json({ error: "Invalid score" }, { status: 400 });
  }

  const sql = getSql();
  const rows = (await sql.query(
    `SELECT id, summary, is_published FROM articles WHERE id = $1 LIMIT 1`,
    [articleId],
  )) as Array<{ id: string; summary: unknown; is_published: boolean }>;
  const article = rows[0];

  if (!article?.is_published) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const questions = parseQuizQuestions(article.summary);
  if (!questions || questions.length !== total) {
    return NextResponse.json({ error: "Quiz mismatch" }, { status: 400 });
  }

  await recordQuizAttempt({
    articleId,
    score,
    totalQuestions: total,
  });

  const stats = await getQuizStats(articleId);
  return NextResponse.json(
    stats ?? { attemptCount: 1, averageScore: score, questionCount: total },
  );
}
