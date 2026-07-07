import type { ResumeDocument } from "./types";

const dimensions = 128;

const semanticStopWords = new Set([
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
  "will",
  "you",
  "your",
]);

export type SemanticSection = {
  label: string;
  text: string;
  vector: number[];
};

function normalize(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}+#.\s-]/gu, " ").replace(/\s+/g, " ").trim();
}

function tokens(text: string) {
  return normalize(text)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !semanticStopWords.has(token));
}

function hash(value: string) {
  let output = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    output ^= value.charCodeAt(index);
    output = Math.imul(output, 16777619);
  }
  return output >>> 0;
}

function ngrams(items: string[]) {
  const grams = [...items];
  for (let index = 0; index < items.length - 1; index += 1) grams.push(`${items[index]} ${items[index + 1]}`);
  for (let index = 0; index < items.length - 2; index += 1) grams.push(`${items[index]} ${items[index + 1]} ${items[index + 2]}`);
  return grams;
}

export function embedText(text: string) {
  const vector = Array.from({ length: dimensions }, () => 0);
  for (const gram of ngrams(tokens(text))) {
    const bucket = hash(gram) % dimensions;
    const sign = hash(`${gram}:sign`) % 2 === 0 ? 1 : -1;
    vector[bucket] += sign * (gram.includes(" ") ? 1.4 : 1);
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

export function cosineSimilarity(left: number[], right: number[]) {
  return left.reduce((sum, value, index) => sum + value * (right[index] || 0), 0);
}

function sectionTexts(resume: ResumeDocument) {
  const parsed = resume.parsedJson;
  if (!parsed) return [{ label: "resume", text: resume.rawText || "" }];

  const sections = [
    { label: "skills", text: parsed.skills.join(", ") },
    { label: "experience", text: parsed.experience.join("\n") },
    { label: "projects", text: parsed.projects.join("\n") },
    { label: "education", text: parsed.education.join("\n") },
    { label: "quantified evidence", text: parsed.quantifiedEvidence.join("\n") },
    { label: "seniority", text: parsed.senioritySignals.join("\n") },
  ].filter((section) => section.text.trim().length > 24);

  return sections.length ? sections : [{ label: "resume", text: resume.rawText || "" }];
}

export function semanticSections(resume: ResumeDocument): SemanticSection[] {
  return sectionTexts(resume).map((section) => ({
    ...section,
    vector: embedText(section.text),
  }));
}

export function bestSemanticMatch(query: string, resume: ResumeDocument) {
  const queryVector = embedText(query);
  return semanticSections(resume)
    .map((section) => ({
      label: section.label,
      text: section.text,
      similarity: cosineSimilarity(queryVector, section.vector),
    }))
    .sort((a, b) => b.similarity - a.similarity)[0] || { label: "resume", text: resume.rawText || "", similarity: 0 };
}
