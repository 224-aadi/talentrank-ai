const genericTitleWords = new Set([
  "job",
  "description",
  "role",
  "position",
  "opening",
  "department",
  "team",
  "overview",
  "summary",
]);

const knownAcronyms: Record<string, { label: string; blocker: RegExp }> = {
  iot: {
    label: "Internet of Things (IoT)",
    blocker: /\binductive output tube\b|\belectron tube\b|\brf tube\b/i,
  },
  api: {
    label: "API",
    blocker: /\bactive pharmaceutical ingredient\b/i,
  },
  ml: {
    label: "Machine Learning",
    blocker: /\bmilliliter\b/i,
  },
  ai: {
    label: "Artificial Intelligence",
    blocker: /\bappreciative inquiry\b/i,
  },
};

function cleanLine(line: string) {
  return line
    .replace(/^[#*\-\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(value: string) {
  return cleanLine(value)
    .replace(/\s*[-|•]\s*(?:job description|role overview|position summary).*$/i, "")
    .replace(/\s*\([^)]*(?:remote|hybrid|onsite|full[-\s]?time|part[-\s]?time|contract)[^)]*\)\s*$/i, "")
    .replace(/[.:;\s]+$/g, "")
    .trim();
}

function titleCase(value: string) {
  const keepUpper = new Set(["AI", "API", "CRM", "ERP", "HR", "ML", "QA", "SQL", "UI", "UX"]);
  return value
    .split(/\s+/)
    .map((word) => {
      const stripped = word.replace(/[^a-z0-9]/gi, "");
      if (stripped.toUpperCase() === "IOT") return word.replace(stripped, "IoT");
      if (keepUpper.has(stripped.toUpperCase())) return word.replace(stripped, stripped.toUpperCase());
      const cased = stripped.charAt(0).toUpperCase() + stripped.slice(1).toLowerCase();
      return word.replace(stripped, cased);
    })
    .join(" ");
}

function looksLikeTitle(value: string) {
  const title = cleanTitle(value);
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 9) return false;
  if (words.some((word) => genericTitleWords.has(word.toLowerCase()))) return false;
  if (/[.!?]$/.test(title)) return false;
  return /\b(engineer|developer|architect|analyst|scientist|manager|specialist|designer|consultant|administrator|lead|director|intern)\b/i.test(title);
}

export function inferJobTitle(text: string, fallback = "Untitled role") {
  const lines = text
    .split(/\n+/)
    .map(cleanLine)
    .filter((line) => line.length >= 4 && line.length <= 120);

  for (const line of lines.slice(0, 30)) {
    const labeled = line.match(/^(?:job\s*title|position|role|opening|title)\s*[:\-]\s*(.+)$/i);
    if (labeled?.[1] && looksLikeTitle(labeled[1])) return titleCase(cleanTitle(labeled[1]));
  }

  for (const line of lines.slice(0, 18)) {
    if (looksLikeTitle(line)) return titleCase(cleanTitle(line));
  }

  return fallback;
}

export function normalizeRecruitingSignal(signal: string, jobText: string) {
  let normalized = signal;
  const jobHasInternetOfThings = /\binternet of things\b|\biot\b|\bconnected devices?\b|\btelematics\b|\bedge devices?\b|\bsensor networks?\b/i.test(jobText);
  if (jobHasInternetOfThings && /\binductive output tube\b|\belectron tube\b/i.test(normalized)) {
    return knownAcronyms.iot.label;
  }

  for (const [acronym, definition] of Object.entries(knownAcronyms)) {
    const hasAcronym = new RegExp(`\\b${acronym}\\b`, "i").test(jobText) || new RegExp(`\\b${acronym}\\b`, "i").test(normalized);
    if (hasAcronym && !definition.blocker.test(jobText) && !normalized.includes(definition.label)) {
      normalized = normalized.replace(new RegExp(`\\b${acronym}\\b`, "gi"), definition.label);
    }
  }

  return normalized;
}
