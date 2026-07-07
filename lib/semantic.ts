import { createId, listVectorRecords, upsertVectorRecords } from "./store";
import type { CandidatePoolItem, ResumeDocument, VectorRecord } from "./types";

const localDimensions = 128;
const defaultOpenAiDimensions = 256;

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
};

export type EmbeddingConfig = {
  provider: "local" | "openai";
  model: string;
  dimensions: number;
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

export function localEmbedText(text: string, dimensions = localDimensions) {
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

export function embeddingConfig(): EmbeddingConfig {
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      dimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS || defaultOpenAiDimensions),
    };
  }
  return {
    provider: "local",
    model: "talentrank-local-hash-v1",
    dimensions: localDimensions,
  };
}

function sectionTexts(resume: ResumeDocument): SemanticSection[] {
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

async function openAiEmbeddings(input: string[], config: EmbeddingConfig) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      input,
      model: config.model,
      dimensions: config.dimensions,
      encoding_format: "float",
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI embeddings failed: ${response.status} ${detail.slice(0, 180)}`);
  }
  const payload = await response.json() as { data: Array<{ embedding: number[] }> };
  return payload.data.map((item) => item.embedding);
}

async function embedTexts(input: string[], config = embeddingConfig()) {
  if (!input.length) return [];
  if (config.provider === "openai") {
    return await openAiEmbeddings(input, config);
  }
  return input.map((text) => localEmbedText(text, config.dimensions));
}

function vectorKey(record: Pick<VectorRecord, "resumeId" | "section" | "provider" | "model" | "dimensions">) {
  return `${record.resumeId}:${record.section}:${record.provider}:${record.model}:${record.dimensions}`;
}

export async function ensureVectorIndex(pool: CandidatePoolItem[]) {
  const config = embeddingConfig();
  const existing = await listVectorRecords();
  const existingKeys = new Set(existing.map(vectorKey));
  const missing: Array<{ candidateId: string; resumeId: string; section: SemanticSection }> = [];

  for (const item of pool) {
    for (const section of sectionTexts(item.resume)) {
      const key = vectorKey({
        resumeId: item.resume.id,
        section: section.label,
        provider: config.provider,
        model: config.model,
        dimensions: config.dimensions,
      });
      if (!existingKeys.has(key)) {
        missing.push({
          candidateId: item.candidate.id,
          resumeId: item.resume.id,
          section,
        });
      }
    }
  }

  if (missing.length) {
    const embeddings = await embedTexts(missing.map((item) => item.section.text), config);
    const timestamp = new Date().toISOString();
    await upsertVectorRecords(missing.map((item, index) => ({
      id: createId("vec"),
      candidateId: item.candidateId,
      resumeId: item.resumeId,
      section: item.section.label,
      text: item.section.text,
      embedding: embeddings[index],
      provider: config.provider,
      model: config.model,
      dimensions: embeddings[index]?.length || config.dimensions,
      createdAt: timestamp,
      updatedAt: timestamp,
    })));
  }

  const refreshed: VectorRecord[] = missing.length ? await listVectorRecords() : existing;
  const resumeIds = new Set(pool.map((item) => item.resume.id));
  return {
    config,
    records: refreshed.filter((record) =>
      resumeIds.has(record.resumeId)
      && record.provider === config.provider
      && record.model === config.model
      && record.dimensions === config.dimensions,
    ),
  };
}

export async function bestSemanticMatches(query: string, pool: CandidatePoolItem[]) {
  const { config, records } = await ensureVectorIndex(pool);
  const [queryVector] = await embedTexts([query], config);
  const bestByResume = new Map<string, VectorRecord & { similarity: number }>();

  for (const record of records) {
    const similarity = cosineSimilarity(queryVector, record.embedding);
    const current = bestByResume.get(record.resumeId);
    if (!current || similarity > current.similarity) bestByResume.set(record.resumeId, { ...record, similarity });
  }

  return {
    config,
    byResumeId: bestByResume,
  };
}
