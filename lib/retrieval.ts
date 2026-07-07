import type { CandidatePoolItem, EvidenceSnippet, RetrievalResult } from "./types";
import { bestSemanticMatch } from "./semantic";

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with",
]);

type ParsedQuery = {
  raw: string;
  groups: string[][];
  excluded: string[];
  positiveTerms: string[];
};

function normalize(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}+#.\s-]/gu, " ").replace(/\s+/g, " ").trim();
}

function tokenize(text: string) {
  return normalize(text)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function queryParts(query: string) {
  return query.match(/"[^"]+"|\S+/g)?.map((part) => part.replace(/^"|"$/g, "")) || [];
}

export function parseRetrievalQuery(query: string): ParsedQuery {
  const parts = queryParts(query);
  const groups: string[][] = [[]];
  const excluded: string[] = [];

  for (const part of parts) {
    const upper = part.toUpperCase();
    if (upper === "AND") continue;
    if (upper === "OR") {
      groups.push([]);
      continue;
    }
    if (part.startsWith("-") && part.length > 1) {
      excluded.push(part.slice(1));
      continue;
    }
    groups[groups.length - 1].push(part);
  }

  const cleanedGroups = groups.map((group) => group.filter(Boolean)).filter((group) => group.length);
  return {
    raw: query,
    groups: cleanedGroups,
    excluded,
    positiveTerms: [...new Set(cleanedGroups.flat())],
  };
}

function containsTerm(text: string, term: string) {
  const source = normalize(text);
  const target = normalize(term);
  if (!target) return true;
  if (target.includes(" ")) return source.includes(target);
  return new RegExp(`(^|[^a-z0-9+#])${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9+#]|$)`, "i").test(source);
}

function booleanMatched(text: string, parsed: ParsedQuery) {
  if (parsed.excluded.some((term) => containsTerm(text, term))) return false;
  if (!parsed.groups.length) return true;
  return parsed.groups.some((group) => group.every((term) => containsTerm(text, term)));
}

function snippetFor(text: string, term: string): EvidenceSnippet | null {
  const lines = text
    .split(/\n+|(?:\s•\s)|(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 28);
  const hit = lines.find((line) => containsTerm(line, term));
  return hit
    ? {
        label: term,
        requirement: "Retrieval hit",
        source: "candidate pool",
        strength: "exact",
        text: hit.slice(0, 260),
      }
    : null;
}

function documentFrequency(pool: CandidatePoolItem[], terms: string[]) {
  const df = new Map<string, number>();
  for (const term of terms) {
    df.set(
      term,
      pool.filter((item) => containsTerm(item.resume.rawText || "", term)).length,
    );
  }
  return df;
}

function bm25(text: string, terms: string[], avgDocLength: number, df: Map<string, number>, docCount: number) {
  const tokens = tokenize(text);
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  const k1 = 1.4;
  const b = 0.72;
  const lengthNorm = 1 - b + b * (tokens.length / Math.max(1, avgDocLength));

  return terms.reduce((score, term) => {
    const termTokens = tokenize(term);
    const frequency = termTokens.length > 1
      ? containsTerm(text, term) ? 1 : 0
      : counts.get(termTokens[0] || term) || 0;
    if (!frequency) return score;
    const idf = Math.log(1 + (docCount - (df.get(term) || 0) + 0.5) / ((df.get(term) || 0) + 0.5));
    return score + idf * ((frequency * (k1 + 1)) / (frequency + k1 * lengthNorm));
  }, 0);
}

export function retrieveCandidates(pool: CandidatePoolItem[], query: string, limit = 20, mode: "lexical" | "semantic" | "hybrid" = "hybrid"): RetrievalResult[] {
  const parsed = parseRetrievalQuery(query);
  const fallbackTerms = pool.length ? [] : tokenize(query).slice(0, 8);
  const terms = parsed.positiveTerms.length ? parsed.positiveTerms : fallbackTerms;
  const avgDocLength = pool.length
    ? pool.reduce((sum, item) => sum + tokenize(item.resume.rawText || "").length, 0) / pool.length
    : 1;
  const df = documentFrequency(pool, terms);

  return pool
    .map((item) => {
      const text = item.resume.rawText || "";
      const passedBoolean = booleanMatched(text, parsed);
      const matchedTerms = terms.filter((term) => containsTerm(text, term));
      const rejectedTerms = parsed.excluded.filter((term) => containsTerm(text, term));
      const bm25Score = bm25(text, terms, avgDocLength, df, pool.length);
      const semanticMatch = bestSemanticMatch(query, item.resume);
      const semanticScore = Math.max(0, Math.round(semanticMatch.similarity * 100));
      const structuredBoost = terms.filter((term) => item.resume.parsedJson?.skills.some((skill) => containsTerm(skill, term))).length * 0.8;
      const lexicalScore = bm25Score + structuredBoost + (passedBoolean ? 2 : 0);
      const retrievalScore = Math.round(
        (mode === "semantic"
          ? semanticScore / 8
          : mode === "lexical"
            ? lexicalScore
            : lexicalScore * 0.62 + semanticScore / 8 * 0.38) * 10,
      ) / 10;
      return {
        ...item,
        retrievalScore,
        bm25Score: Math.round(bm25Score * 10) / 10,
        semanticScore,
        topSemanticSection: semanticMatch.label,
        booleanMatched: passedBoolean,
        matchedTerms,
        rejectedTerms,
        snippets: [
          ...matchedTerms.flatMap((term) => {
            const snippet = snippetFor(text, term);
            return snippet ? [snippet] : [];
          }),
          ...(semanticMatch.text
            ? [{
                label: semanticMatch.label,
                requirement: "Semantic section",
                source: "candidate pool",
                strength: "transferable" as const,
                text: semanticMatch.text.slice(0, 260),
              }]
            : []),
        ].slice(0, 4),
      };
    })
    .filter((item) => mode === "semantic" || item.booleanMatched)
    .sort((a, b) => b.retrievalScore - a.retrievalScore)
    .slice(0, limit);
}
