import type { Category } from "@/lib/types";

const GAMING_HOST_FRAGMENTS = [
  "gry-online.pl",
  "eurogamer.",
  "polygon.com",
  "pcgamer.com",
  "gamespot.com",
  "ign.com",
  "rockpapershotgun.com",
  "kotaku.com",
  "destructoid.com",
  "gamesSpot.com",
];

const GAMING_KEYWORDS = [
  " gra ",
  " gry ",
  " gier ",
  " grę ",
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
  " rpg",
  "mmorpg",
  "gamespass",
  "gamescom",
  "e3 ",
  "steam deck",
  "mass effect",
  "archetype",
  "bioware",
];

const TECH_KEYWORDS = [
  "nasa",
  "boeing",
  "starliner",
  "spacex",
  "iss",
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
  "blu-ray",
  "dvd",
  "ekranizac",
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
    if (GAMING_HOST_FRAGMENTS.some((fragment) => host.includes(fragment.toLowerCase()))) {
      return "gaming";
    }
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
 * Gaming RSS feeds sometimes carry non-gaming news (e.g. benchmark.pl).
 * Dedicated gaming hosts stay in gaming; only reclassify on a clear signal.
 */
export function inferArticleCategory(input: InferCategoryInput): Category {
  const urlOverride = categoryFromUrl(input.sourceUrl);
  // Dedicated gaming outlets should not flip to tech/ai on weak keywords
  // like "kosmiczne" (space RPG) matching leftover tech/sci-fi stems.
  if (urlOverride === "gaming") return "gaming";
  if (urlOverride) return urlOverride;

  if (input.sourceCategory !== "gaming") {
    return input.sourceCategory;
  }

  const text = ` ${[
    input.sourceTitle,
    input.headline,
    input.lead,
    ...input.tags,
  ]
    .join(" ")
    .toLowerCase()} `;

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

  // Stricter than before: leave gaming only with a clear margin over gaming signals
  if (best.score >= gaming + 2 || (gaming === 0 && best.score >= 2)) {
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
