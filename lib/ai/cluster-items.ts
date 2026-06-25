import type { RawItem, Source } from "@/lib/types";

type ClusterItem = RawItem & {
  sources: Pick<Source, "category" | "locale" | "type" | "config">;
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "oraz",
  "jest",
  "się",
  "nie",
  "jak",
  "dla",
  "czy",
  "już",
  "ale",
  "tylko",
  "przez",
  "pod",
  "nad",
  "bez",
  "ich",
  "jego",
  "jej",
  "tego",
  "ten",
  "ta",
  "to",
  "nowy",
  "nowa",
  "nowe",
]);

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  );
}

function titleSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (!tokensA.size || !tokensB.size) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return intersection / union;
}

function isSynthesisCandidate(item: ClusterItem): boolean {
  return item.sources.type === "rss";
}

export function findSynthesisCluster(
  items: ClusterItem[],
  excludeIds: Set<string>,
): ClusterItem[] | null {
  const available = items.filter(
    (item) => !excludeIds.has(item.id) && isSynthesisCandidate(item),
  );

  for (const anchor of available) {
    const cluster: ClusterItem[] = [anchor];

    for (const other of available) {
      if (other.id === anchor.id) continue;
      if (other.sources.category !== anchor.sources.category) continue;
      if (titleSimilarity(anchor.title, other.title) < 0.38) continue;

      cluster.push(other);
      if (cluster.length >= 3) break;
    }

    if (cluster.length >= 2) return cluster;
  }

  return null;
}
