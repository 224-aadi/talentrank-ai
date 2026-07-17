import mammoth from "mammoth";
import { ocrConfigured, runOcr } from "./ocr";
import { skillIds, termsFor } from "./skill-taxonomy";
import type { ParsedResumeTable, StructuredResumeProfile, WorkTimelineItem } from "./types";

export interface ParsedResumeFile {
  fileName: string;
  mimeType: string;
  text: string;
  parseConfidence: number;
  parser: string;
  warnings: string[];
  parsedJson: StructuredResumeProfile;
  storageKey?: string;
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
  const parserScore = parser === "pdf+ocr" ? 22 : parser === "pdf" || parser === "docx" ? 25 : 18;
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

function extractBullets(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /^(?:[-*•]|[0-9]+[.)])\s+/.test(line) || /^\b(?:built|led|owned|created|developed|implemented|analyzed|managed|designed|deployed|improved)\b/i.test(line))
    .map((line) => line.replace(/^(?:[-*•]|[0-9]+[.)])\s+/, ""))
    .filter((line) => line.length > 12)
    .slice(0, 40);
}

function extractDates(text: string) {
  const matches = text.match(/\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:(?:present|current)|(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(?:19|20)\d{2})|\b(?:19|20)\d{2}\b/gi);
  return [...new Set(matches || [])].slice(0, 30);
}

function splitColumns(line: string) {
  if (line.includes("|")) {
    return line.split("|").map((cell) => cell.trim()).filter(Boolean);
  }
  return line.split(/\s{2,}/).map((cell) => cell.trim()).filter(Boolean);
}

function extractTables(text: string): ParsedResumeTable[] {
  const tables: ParsedResumeTable[] = [];
  let current: string[][] = [];
  const flush = () => {
    if (current.length >= 2) {
      tables.push({
        headers: current[0],
        rows: current.slice(1),
      });
    }
    current = [];
  };

  for (const rawLine of text.split(/\n+/)) {
    const line = rawLine.trim();
    const cells = splitColumns(line);
    if (cells.length >= 3 && line.length < 180) {
      current.push(cells);
    } else {
      flush();
    }
  }
  flush();
  return tables.slice(0, 6);
}

function extractWorkTimeline(text: string, sections: Record<string, string[]>): WorkTimelineItem[] {
  const source = (sections.experience || text.split(/\n+/)).map((line) => line.trim()).filter(Boolean);
  const timeline: WorkTimelineItem[] = [];
  const rangePattern = /\b((?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(?:19|20)\d{2})\s*(?:-|–|—|to)\s*((?:present|current)|(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(?:19|20)\d{2})\b/i;

  for (let index = 0; index < source.length; index += 1) {
    const line = source[index];
    const match = line.match(rangePattern);
    if (!match) continue;
    const previous = source[index - 1] || "";
    const next = source[index + 1] || "";
    const titleLine = line.replace(match[0], "").replace(/[|,;]+$/g, "").trim() || previous;
    const [title, organization] = titleLine.includes(" at ")
      ? titleLine.split(/\s+at\s+/i, 2)
      : titleLine.includes(" | ")
        ? titleLine.split(/\s+\|\s+/, 2)
        : [titleLine || next, undefined];
    timeline.push({
      title: title?.trim() || undefined,
      organization: organization?.trim() || undefined,
      start: match[1],
      end: match[2],
      raw: line,
    });
  }
  return timeline.slice(0, 12);
}

function countMatches(text: string, patterns: RegExp[]) {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

export function validateResumeContent(fileName: string, text: string, profile = extractStructuredProfile(text)) {
  const source = normalized(text);
  const contactScore = Number(Boolean(profile.contact.email)) + Number(Boolean(profile.contact.phone)) + Number(profile.contact.links.length > 0);
  const sectionScore = countMatches(source, [
    /\beducation\b/,
    /\bexperience\b|\bemployment\b|\bwork history\b/,
    /\bskills?\b|\btechnical skills?\b|\bcompetencies\b/,
    /\bprojects?\b|\bcertifications?\b/,
  ]);
  const roleScore = countMatches(source, [
    /\b(engineer|developer|analyst|manager|consultant|designer|scientist|accountant|specialist|intern)\b/,
    /\b(university|college|bachelor|master|phd|degree|gpa)\b/,
    /\b(led|built|created|developed|implemented|analyzed|managed|designed|deployed|improved)\b/,
  ]);
  const structureScore = Number((profile.bullets?.length || 0) >= 2) + Number((profile.dates?.length || 0) >= 1);
  const score = contactScore + sectionScore + roleScore + structureScore;

  if (text.length < 180 || score < 4) {
    throw new Error(`${fileName} does not look like a resume. Upload a resume with work history, education, skills, projects, or contact details.`);
  }
}

export function validateJobDescriptionContent(fileName: string, text: string) {
  const source = normalized(text);
  const requirementScore = countMatches(source, [
    /\b(job description|role|position|opening|department|team)\b/,
    /\b(responsibilities|what you'?ll do|duties|scope|about the role)\b/,
    /\b(requirements|qualifications|must have|preferred|minimum qualifications)\b/,
    /\b(experience|years|degree|bachelor|master|certification)\b/,
    /\b(skills|proficiency|knowledge|familiarity|expertise)\b/,
    /\b(apply|candidate|hiring|recruiting|employment)\b/,
  ]);
  const resumeOnlySignals = countMatches(source, [
    /\bresume\b|\bcurriculum vitae\b/,
    /\bgpa\b|\bgraduated\b/,
    /\blinkedin\.com|github\.com/,
  ]);

  if (text.length < 160 || requirementScore < 3 || (resumeOnlySignals >= 2 && requirementScore < 4)) {
    throw new Error(`${fileName} does not look like a job description. Upload or paste a JD with role responsibilities, requirements, qualifications, or required skills.`);
  }
}

function layoutWarnings(text: string, tables: ParsedResumeTable[], timeline: WorkTimelineItem[]) {
  const warnings: string[] = [];
  const longLines = text.split(/\n+/).filter((line) => line.length > 180).length;
  if (longLines > 4) warnings.push("Several unusually long lines detected; resume layout may have collapsed during extraction");
  if (!tables.length && /\s{4,}/.test(text)) warnings.push("Column-like spacing detected but no stable table structure was recovered");
  if (!timeline.length && /\b(?:experience|employment|work history)\b/i.test(text)) warnings.push("Experience section detected but no date-based work timeline was recovered");
  return warnings;
}

function ensurePdfRuntimePolyfills() {
  const runtime = globalThis as typeof globalThis & {
    DOMMatrix?: typeof DOMMatrix;
    ImageData?: typeof ImageData;
    Path2D?: typeof Path2D;
  };

  if (!runtime.DOMMatrix) {
    runtime.DOMMatrix = class DOMMatrix {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;
      is2D = true;
      isIdentity = true;

      constructor(init?: string | number[]) {
        if (Array.isArray(init)) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = [
            init[0] ?? 1,
            init[1] ?? 0,
            init[2] ?? 0,
            init[3] ?? 1,
            init[4] ?? 0,
            init[5] ?? 0,
          ];
        }
        this.isIdentity = this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
      }

      multiplySelf() {
        return this;
      }

      preMultiplySelf() {
        return this;
      }

      translateSelf(x = 0, y = 0) {
        this.e += x;
        this.f += y;
        this.isIdentity = false;
        return this;
      }

      scaleSelf(scaleX = 1, scaleY = scaleX) {
        this.a *= scaleX;
        this.d *= scaleY;
        this.isIdentity = false;
        return this;
      }
    } as typeof DOMMatrix;
  }

  if (!runtime.ImageData) {
    runtime.ImageData = class ImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;

      constructor(data: Uint8ClampedArray, width: number, height?: number) {
        this.data = data;
        this.width = width;
        this.height = height ?? Math.floor(data.length / 4 / width);
      }
    } as typeof ImageData;
  }

  if (!runtime.Path2D) {
    runtime.Path2D = class Path2D {} as typeof Path2D;
  }
}

export function extractStructuredProfile(text: string): StructuredResumeProfile {
  const sections = extractSections(text);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0];
  const links = [...new Set(text.match(/(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|portfolio\.|kaggle\.com)[^\s,)]+/gi) || [])];
  const quantifiedEvidence = linesWith(text, /(\d+%|\$\d+|\b\d+x\b|\b\d+\+?\s*(?:users|records|rows|models|dashboards|hours|minutes|years|projects)\b)/i, 10);
  const senioritySignals = linesWith(text, /\b(?:led|owned|managed|mentored|architected|launched|deployed|production|stakeholder|observability|scaling|executive|reliability)\b/i, 8);
  const bullets = extractBullets(text);
  const dates = extractDates(text);
  const tables = extractTables(text);
  const workTimeline = extractWorkTimeline(text, sections);

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
    bullets,
    dates,
    tables,
    workTimeline,
    layoutWarnings: layoutWarnings(text, tables, workTimeline),
  };
}

async function parsePdf(file: File) {
  ensurePdfRuntimePolyfills();
  const { PDFParse } = await import("pdf-parse");
  const buffer = Buffer.from(await file.arrayBuffer());
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    const text = cleanText(parsed.text || "");
    if (text.length >= 80) return { text, parser: "pdf", warnings: [] };
    const ocr = await runOcr(file);
    const ocrText = cleanText(ocr.text);
    if (ocrText) {
      return {
        text: ocrText,
        parser: "pdf+ocr",
        warnings: [`OCR fallback used via ${ocr.provider}.`, ...ocr.warnings],
      };
    }
    return {
      text,
      parser: "pdf",
      warnings: [
        ocrConfigured()
          ? "PDF yielded very little embedded text and OCR did not return readable content"
          : "Likely scanned PDF detected; configure OCR_API_URL for OCR fallback",
        ...ocr.warnings,
      ],
    };
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
    const parsedPdf = await parsePdf(file);
    parser = parsedPdf.parser;
    text = parsedPdf.text;
    warnings.push(...parsedPdf.warnings);
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
    throw new Error(`${file.name} did not yield readable text. ${warnings.join(" ")}`.trim());
  }
  if (text.length < 250) warnings.push("Very little text extracted");
  if (!/education|experience|skills|project/i.test(text)) warnings.push("Common resume sections not detected");
  const parsedJson = extractStructuredProfile(text);

  return {
    fileName: file.name,
    mimeType,
    text,
    parser,
    warnings,
    parsedJson,
    parseConfidence: confidenceFor(text, parser, warnings),
  };
}
