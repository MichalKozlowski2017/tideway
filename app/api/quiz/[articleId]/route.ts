import { NextRequest, NextResponse } from "next/server";
import { getQuizStats, recordQuizAttempt } from "@/lib/quiz/stats";
import { parseQuizQuestions } from "@/lib/quiz/types";
import { getSupabaseAdmin } from "@/lib/db/supabase";

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

  const supabase = getSupabaseAdmin();
  const { data: article, error } = await supabase
    .from("articles")
    .select("id, summary, is_published")
    .eq("id", articleId)
    .maybeSingle();

  if (error || !article?.is_published) {
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
