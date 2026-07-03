import type { Category } from "@/lib/types";

const GAMING_KEYWORDS = [
  "gra ",
  "gry ",
  "gier ",
  "game",
  "gaming",
  "gamer",
  "steam",
  "playstation",
  "ps5",
  "ps4",
  "xbox",
  "nintendo",
  "switch",
  "esport",
  "e-sport",
  "fortnite",
  "minecraft",
  "rockstar",
  "cd projekt",
  "wiedźmin",
  "witcher",
  "gta ",
  "fifa",
  "ea sports",
  "ubisoft",
  "bethesda",
  "blizzard",
  "riot games",
  "league of legends",
  "counter-strike",
  "valorant",
  "forza",
  "horizon",
  "gothic",
  "dlc",
  "gameplay",
  "konsole",
  "konsol",
];

const TECH_KEYWORDS = [
  "nasa",
  "boeing",
  "starliner",
  "spacex",
  "iss",
  "kosmicz",
  "satelit",
  "rakiet",
  "netflix",
  "streaming",
  "disney+",
  "hbo",
  "hbo max",
  "apple tv",
  "prime video",
  "amazon prime",
  "sci-fi",
  "science fiction",
  "serial",
  "seriale",
  "miniserial",
  "telewizj",
  "odcink",
  "zwiastun",
  "binge",
  "anime",
  "remake",
  "blu-ray",
  "dvd",
  "ekranizac",
  "adaptacj",
  "platforma vod",
  "elektronik",
  "półprzewodnik",
  "semiconductor",
  "chip",
  "procesor",
  "cpu",
  "smartfon",
  "telefon",
  "laptop",
  "sprzęt komputer",
  "hardware",
  "ceny elektron",
  "benchmark",
  "transport",
  "kradzie",
  "logisty",
  "fabryk",
  "produkcj",
  "infrastruktur",
  "energi",
  "internet",
  "5g",
  "wifi",
  "router",
];

const AI_KEYWORDS = [
  " sztuczn",
  " ai ",
  "openai",
  "chatgpt",
  "claude",
  "llm",
  "model język",
  "machine learning",
  "uczenie maszyn",
  "deep learning",
  "neural",
  "gpt-",
  "gemini",
  "anthropic",
  "nvidia h100",
  "gpu do ai",
  "sprzęt ai",
  "gpu",
  "data center",
  "centrum danych",
];

const FINANCE_KEYWORDS = [
  "giełd",
  "akcj",
  "inwestyc",
  "bitcoin",
  "kryptowalut",
  "inflacj",
  "bank ",
  "nbp",
  "fed ",
  "ecb",
  "podatk",
  "fundusz",
];

const SPORT_KEYWORDS = [
  "mecz",
  "liga",
  "piłk",
  "futbol",
  "mistrzostw",
  "olimpijsk",
  "formula 1",
  "f1 ",
  "nba",
  "nfl",
  "transfer",
  "zawodnik",
  "trener",
];

const IT_KEYWORDS = [
  "devops",
  "kubernetes",
  "docker",
  "github",
  "gitlab",
  "pull request",
  "code review",
  "programow",
  "developer",
  "deweloper",
  "api ",
  "backend",
  "frontend",
  "typescript",
  "javascript",
  "python",
  "sql",
  "baza danych",
  "cyberbezpiecz",
  "ransomware",
  "cve-",
  "linux",
  "windows server",
];

function scoreKeywords(text: string, keywords: string[]): number {
  let score = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) score += 1;
  }
  return score;
}

function categoryFromUrl(url: string): Category | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("benchmark.pl")) return "tech";
    return null;
  } catch {
    return null;
  }
}

type InferCategoryInput = {
  sourceCategory: Category;
  sourceTitle: string;
  sourceUrl: string;
  headline: string;
  lead: string;
  tags: string[];
};

/**
 * Gaming RSS feeds (benchmark.pl, broad newsroom posts) often carry tech news.
 * Reclassify when content signals clearly point elsewhere.
 */
export function inferArticleCategory(input: InferCategoryInput): Category {
  const urlOverride = categoryFromUrl(input.sourceUrl);
  if (urlOverride) return urlOverride;

  if (input.sourceCategory !== "gaming") {
    return input.sourceCategory;
  }

  const text = [
    input.sourceTitle,
    input.headline,
    input.lead,
    ...input.tags,
  ]
    .join(" ")
    .toLowerCase();

  const gaming = scoreKeywords(text, GAMING_KEYWORDS);
  const scores: Array<{ category: Category; score: number }> = [
    { category: "tech", score: scoreKeywords(text, TECH_KEYWORDS) },
    { category: "ai", score: scoreKeywords(text, AI_KEYWORDS) },
    { category: "it", score: scoreKeywords(text, IT_KEYWORDS) },
    { category: "finance", score: scoreKeywords(text, FINANCE_KEYWORDS) },
    { category: "sport", score: scoreKeywords(text, SPORT_KEYWORDS) },
    { category: "gaming", score: gaming },
  ];

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const second = scores[1];

  if (best.score === 0) return input.sourceCategory;
  if (best.category === "gaming") return "gaming";

  // Require a clear signal: winner beats gaming and has at least one hit
  if (best.score >= gaming + 1 || (gaming === 0 && best.score >= 1)) {
    if (
      second &&
      second.score === best.score &&
      second.category !== best.category
    ) {
      if (gaming === 0) {
        const priority: Category[] = ["ai", "tech", "it", "finance", "sport"];
        for (const cat of priority) {
          if (
            scores.some((entry) => entry.category === cat && entry.score === best.score)
          ) {
            return cat;
          }
        }
      }
      return input.sourceCategory;
    }
    return best.category;
  }

  return input.sourceCategory;
}
