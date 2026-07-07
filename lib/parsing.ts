import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { skillIds, termsFor } from "./skill-taxonomy";
import type { StructuredResumeProfile } from "./types";

export interface ParsedResumeFile {
  fileName: string;
  mimeType: string;
  text: string;
  parseConfidence: number;
  parser: string;
  warnings: string[];
  parsedJson: StructuredResumeProfile;
}

const maxFileBytes = 8 * 1024 * 1024;
const sectionAliases: Record<string, string[]> = {
  education: ["education", "academic background"],
  experience: ["experience", "work experience", "professional experience", "employment"],
  skills: ["skills", "technical skills", "core skills", "competencies"],
  projects: ["projects", "selected projects", "academic projects"],
  certifications: ["certifications", "certificates", "licenses"],
};

function extension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function confidenceFor(text: string, parser: string, warnings: string[]) {
  const lengthScore = Math.min(35, Math.round(text.length / 120));
  const sectionScore = ["education", "experience", "skills", "projects"].filter((section) =>
    text.toLowerCase().includes(section),
  ).length * 10;
  const parserScore = parser === "pdf" || parser === "docx" ? 25 : 18;
  return Math.max(30, Math.min(98, parserScore + lengthScore + sectionScore - warnings.length * 8));
}

function cleanText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalized(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}+#.\s-]/gu, " ").replace(/\s+/g, " ").trim();
}

function sectionName(line: string) {
  const cleaned = line.replace(/[:|•\-]+$/g, "").trim().toLowerCase();
  if (cleaned.length > 34) return "";
  for (const [section, aliases] of Object.entries(sectionAliases)) {
    if (aliases.includes(cleaned)) return section;
  }
  return "";
}

function extractSections(text: string) {
  const sections: Record<string, string[]> = {};
  let current = "summary";
  for (const rawLine of text.split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const nextSection = sectionName(line);
    if (nextSection) {
      current = nextSection;
      sections[current] ||= [];
      continue;
    }
    sections[current] ||= [];
    sections[current].push(line);
  }
  return sections;
}

function includesSkill(text: string, skill: string) {
  const source = normalized(text);
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9+#])${escaped}([^a-z0-9+#]|$)`, "i").test(source);
}

function inferSkills(text: string, sections: Record<string, string[]>) {
  const skillText = [text, ...(sections.skills || [])].join("\n");
  return skillIds.filter((skill) => termsFor(skill).some((term) => includesSkill(skillText, term))).sort();
}

function linesWith(text: string, pattern: RegExp, limit = 8) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 12 && pattern.test(line))
    .slice(0, limit);
}

export function extractStructuredProfile(text: string): StructuredResumeProfile {
  const sections = extractSections(text);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0];
  const links = [...new Set(text.match(/(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|portfolio\.|kaggle\.com)[^\s,)]+/gi) || [])];
  const quantifiedEvidence = linesWith(text, /(\d+%|\$\d+|\b\d+x\b|\b\d+\+?\s*(?:users|records|rows|models|dashboards|hours|minutes|years|projects)\b)/i, 10);
  const senioritySignals = linesWith(text, /\b(?:led|owned|managed|mentored|architected|launched|deployed|production|stakeholder|observability|scaling|executive|reliability)\b/i, 8);

  return {
    contact: {
      email,
      phone,
      links,
    },
    sections,
    skills: inferSkills(text, sections),
    education: sections.education || linesWith(text, /\b(?:university|college|bachelor|master|phd|degree|gpa)\b/i, 6),
    experience: sections.experience || linesWith(text, /\b(?:intern|analyst|engineer|assistant|manager|developer|consultant)\b/i, 8),
    projects: sections.projects || linesWith(text, /\b(?:project|built|developed|implemented|trained|analyzed)\b/i, 8),
    certifications: sections.certifications || linesWith(text, /\b(?:certified|certification|certificate|license)\b/i, 6),
    quantifiedEvidence,
    senioritySignals,
  };
}

async function parsePdf(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return cleanText(parsed.text || "");
  } finally {
    await parser.destroy();
  }
}

async function parseDocx(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await mammoth.extractRawText({ buffer });
  return cleanText(parsed.value || "");
}

export async function parseResumeFile(file: File): Promise<ParsedResumeFile> {
  const ext = extension(file.name);
  const mimeType = file.type || "application/octet-stream";
  const warnings: string[] = [];
  if (file.size > maxFileBytes) {
    throw new Error(`${file.name} is too large. Maximum supported size is 8MB.`);
  }

  let parser = "text";
  let text = "";

  if (ext === "pdf" || mimeType === "application/pdf") {
    parser = "pdf";
    text = await parsePdf(file);
  } else if (ext === "docx" || mimeType.includes("wordprocessingml")) {
    parser = "docx";
    text = await parseDocx(file);
  } else if (["txt", "md", "csv"].includes(ext) || mimeType.startsWith("text/") || !ext) {
    parser = "text";
    text = cleanText(await file.text());
  } else {
    throw new Error(`${file.name} is not supported yet. Upload PDF, DOCX, TXT, MD, or CSV.`);
  }

  if (!text) {
    throw new Error(`${file.name} did not yield readable text.`);
  }
  if (text.length < 250) warnings.push("Very little text extracted");
  if (!/education|experience|skills|project/i.test(text)) warnings.push("Common resume sections not detected");

  return {
    fileName: file.name,
    mimeType,
    text,
    parser,
    warnings,
    parsedJson: extractStructuredProfile(text),
    parseConfidence: confidenceFor(text, parser, warnings),
  };
}
