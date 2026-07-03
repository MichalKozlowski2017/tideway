"use client";

import { useCallback, useState } from "react";
import type { Locale } from "@/lib/types";
import type { QuizQuestion, QuizStats } from "@/lib/quiz/types";

const COPY = {
  pl: {
    question: "Pytanie",
    of: "z",
    next: "Dalej",
    finish: "Zobacz wynik",
    result: "Twój wynik",
    correct: "poprawnych",
    retry: "Spróbuj ponownie",
    avg: "Średnia innych graczy",
    attempts: "prób",
    noStats: "Bądź pierwszą osobą, która rozwiąże ten quiz!",
    pickAnswer: "Wybierz odpowiedź",
  },
  en: {
    question: "Question",
    of: "of",
    next: "Next",
    finish: "See results",
    result: "Your score",
    correct: "correct",
    retry: "Try again",
    avg: "Average score",
    attempts: "attempts",
    noStats: "Be the first to complete this quiz!",
    pickAnswer: "Pick an answer",
  },
} as const;

type Phase = "question" | "results";

export function QuizPlayer({
  articleId,
  locale,
  questions,
  initialStats,
}: {
  articleId: string;
  locale: Locale;
  questions: QuizQuestion[];
  initialStats: QuizStats | null;
}) {
  const t = COPY[locale];
  const total = questions.length;

  const [phase, setPhase] = useState<Phase>("question");
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [stats, setStats] = useState<QuizStats | null>(initialStats);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const current = questions[index];

  const countScore = useCallback(
    (picks: number[]) =>
      picks.reduce(
        (sum, pick, i) =>
          sum + (pick === questions[i]?.correctIndex ? 1 : 0),
        0,
      ),
    [questions],
  );

  const score = finalScore ?? countScore(answers);

  const submitScore = useCallback(
    async (result: number) => {
      const storageKey = `quiz-submitted-${articleId}`;
      if (typeof window !== "undefined" && sessionStorage.getItem(storageKey)) {
        return;
      }

      try {
        const res = await fetch(`/api/quiz/${articleId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ score: result, total }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as QuizStats;
        setStats(data);
        sessionStorage.setItem(storageKey, "1");
      } catch {
        /* non-blocking */
      }
    },
    [articleId, total],
  );

  const reset = () => {
    setPhase("question");
    setIndex(0);
    setSelected(null);
    setAnswers([]);
    setFinalScore(null);
  };

  const pick = (optionIndex: number) => {
    if (selected !== null) return;
    setSelected(optionIndex);
  };

  const advance = () => {
    if (selected === null) return;
    const nextAnswers = [...answers, selected];
    setAnswers(nextAnswers);

    if (index + 1 >= total) {
      const result = countScore(nextAnswers);
      setAnswers(nextAnswers);
      setFinalScore(result);
      setPhase("results");
      void submitScore(result);
      return;
    }

    setIndex(index + 1);
    setSelected(null);
  };

  if (phase === "results") {
    const pct = Math.round((score / total) * 100);
    return (
      <section className="mt-10 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-950/5">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-violet-600">
            {t.result}
          </p>
          <p className="mt-4 text-6xl font-bold tabular-nums text-zinc-900">
            {score}
            <span className="text-3xl font-semibold text-zinc-400">/{total}</span>
          </p>
          <p className="mt-2 text-lg text-zinc-500">
            {pct}% {t.correct}
          </p>
        </div>

        {stats && stats.attemptCount > 0 ? (
          <div className="mt-8 rounded-xl bg-violet-50 px-5 py-4 text-center ring-1 ring-violet-100">
            <p className="text-sm text-violet-800">
              {t.avg}:{" "}
              <span className="font-semibold">
                {stats.averageScore}/{stats.questionCount}
              </span>
              <span className="text-violet-600">
                {" "}
                ({stats.attemptCount} {t.attempts})
              </span>
            </p>
          </div>
        ) : (
          <p className="mt-8 text-center text-sm text-zinc-400">{t.noStats}</p>
        )}

        <button
          type="button"
          onClick={reset}
          className="mt-8 w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          {t.retry}
        </button>
      </section>
    );
  }

  return (
    <section className="mt-10">
      <div className="mb-6 flex items-center justify-between text-sm text-zinc-500">
        <span>
          {t.question} {index + 1} {t.of} {total}
        </span>
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-violet-500 transition-all duration-300"
            style={{ width: `${((index + (selected !== null ? 1 : 0)) / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-950/5 md:p-8">
        <h2 className="text-xl font-semibold leading-snug text-zinc-900 md:text-2xl">
          {current.prompt}
        </h2>

        <ul className="mt-6 space-y-3">
          {current.options.map((option, optionIndex) => {
            const isPicked = selected === optionIndex;
            const isCorrect = optionIndex === current.correctIndex;
            let style =
              "border-zinc-200 bg-white text-zinc-800 hover:border-violet-300 hover:bg-violet-50/50";

            if (selected !== null) {
              if (isCorrect) {
                style = "border-emerald-400 bg-emerald-50 text-emerald-900";
              } else if (isPicked) {
                style = "border-red-300 bg-red-50 text-red-900";
              } else {
                style = "border-zinc-100 bg-zinc-50 text-zinc-400";
              }
            }

            return (
              <li key={option}>
                <button
                  type="button"
                  disabled={selected !== null}
                  onClick={() => pick(optionIndex)}
                  className={`w-full rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition md:text-base ${style}`}
                >
                  {option}
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          disabled={selected === null}
          onClick={advance}
          className="mt-6 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-medium text-white transition enabled:hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
        >
          {index + 1 >= total ? t.finish : t.next}
        </button>

        {selected === null && (
          <p className="mt-3 text-center text-xs text-zinc-400">{t.pickAnswer}</p>
        )}
      </div>
    </section>
  );
}
