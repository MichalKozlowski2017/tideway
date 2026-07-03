export type QuizQuestion = {
  prompt: string;
  options: [string, string, string];
  correctIndex: 0 | 1 | 2;
};

export type QuizStats = {
  attemptCount: number;
  averageScore: number;
  questionCount: number;
};

export function isQuizQuestion(value: unknown): value is QuizQuestion {
  if (!value || typeof value !== "object") return false;
  const q = value as QuizQuestion;
  return (
    typeof q.prompt === "string" &&
    Array.isArray(q.options) &&
    q.options.length === 3 &&
    q.options.every((o) => typeof o === "string" && o.length > 0) &&
    q.correctIndex >= 0 &&
    q.correctIndex <= 2
  );
}

export function parseQuizQuestions(summary: unknown): QuizQuestion[] | null {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return null;
  }
  const quiz = (summary as { quiz?: unknown }).quiz;
  if (!Array.isArray(quiz) || quiz.length < 5) return null;
  const questions = quiz.filter(isQuizQuestion);
  return questions.length >= 5 ? questions : null;
}
