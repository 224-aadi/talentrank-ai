const state = {
  keywords: [],
  ruleMode: "all",
  resumes: [],
  results: [],
  filter: "all",
  searchQuery: "",
  minScore: 0,
  roleTemplate: "auto",
  blindReview: false,
  strictMode: true,
  decisions: {},
  auditLog: [],
};

const els = {
  jdFile: document.querySelector("#jdFile"),
  jdText: document.querySelector("#jdText"),
  jdWarning: document.querySelector("#jdWarning"),
  keywordInput: document.querySelector("#keywordInput"),
  addKeywordBtn: document.querySelector("#addKeywordBtn"),
  keywordChips: document.querySelector("#keywordChips"),
  allRulesBtn: document.querySelector("#allRulesBtn"),
  anyRulesBtn: document.querySelector("#anyRulesBtn"),
  resumeFiles: document.querySelector("#resumeFiles"),
  dropZone: document.querySelector("#dropZone"),
  fileCount: document.querySelector("#fileCount"),
  fileList: document.querySelector("#fileList"),
  scanBtn: document.querySelector("#scanBtn"),
  loadSampleBtn: document.querySelector("#loadSampleBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  resultsList: document.querySelector("#resultsList"),
  emptyState: document.querySelector("#emptyState"),
  statusFilter: document.querySelector("#statusFilter"),
  roleTemplate: document.querySelector("#roleTemplate"),
  searchQuery: document.querySelector("#searchQuery"),
  minScore: document.querySelector("#minScore"),
  minScoreLabel: document.querySelector("#minScoreLabel"),
  blindReview: document.querySelector("#blindReview"),
  strictMode: document.querySelector("#strictMode"),
  weightMatch: document.querySelector("#weightMatch"),
  weightSkills: document.querySelector("#weightSkills"),
  weightExperience: document.querySelector("#weightExperience"),
  weightEducation: document.querySelector("#weightEducation"),
  insightsGrid: document.querySelector("#insightsGrid"),
  metricTotal: document.querySelector("#metricTotal"),
  metricPassed: document.querySelector("#metricPassed"),
  metricRejected: document.querySelector("#metricRejected"),
};

const STOP_WORDS = new Set([
  "a", "about", "above", "across", "after", "all", "also", "an", "and", "any",
  "are", "as", "at", "be", "been", "by", "can", "collaborate", "company", "for",
  "from", "has", "have", "in", "into", "is", "it", "job", "more", "must", "of",
  "on", "or", "our", "role", "should", "that", "the", "their", "this", "to",
  "with", "will", "work", "you", "your",
]);

const SKILL_TERMS = [
  "accessibility", "accounting", "analytics", "aws", "azure", "budgeting",
  "compliance", "crm", "css", "data", "docker", "excel", "figma", "finance",
  "forecasting", "graphql", "hipaa", "html", "java", "javascript", "kubernetes",
  "leadership", "machine learning", "marketing", "node", "power bi", "python",
  "react", "recruiting", "redux", "reporting", "risk", "salesforce", "security",
  "sql", "statistics", "tableau", "typescript", "vendor management",
];

const SKILL_ALIASES = {
  "machine learning": ["ml", "modeling", "predictive model", "classification", "regression"],
  analytics: ["analysis", "insights", "eda", "analytical"],
  "generative ai": ["llm", "prompt engineering", "agents", "chatbot", "rag"],
  sql: ["postgresql", "mysql", "query", "database"],
  statistics: ["statistical", "probability", "calibration", "hypothesis"],
  python: ["pandas", "numpy", "pytorch", "tensorflow", "scikit-learn", "sklearn"],
  "data visualization": ["tableau", "power bi", "plotly", "dashboard", "visualization"],
};

const ROLE_TEMPLATES = {
  data: {
    detect: ["data", "analytics", "machine learning", "sql", "python", "statistics", "business intelligence"],
    boost: ["python", "sql", "statistics", "machine learning", "analytics", "data visualization", "sensor and IoT data", "predictive maintenance"],
  },
  software: {
    detect: ["software", "frontend", "backend", "full stack", "api", "react", "typescript", "java"],
    boost: ["javascript", "typescript", "react", "node", "aws", "docker", "security"],
  },
  sales: {
    detect: ["sales", "account", "pipeline", "quota", "crm", "customer"],
    boost: ["crm", "salesforce", "strategy", "reporting"],
  },
  finance: {
    detect: ["finance", "accounting", "budget", "forecast", "risk", "audit"],
    boost: ["accounting", "finance", "forecasting", "risk", "excel", "reporting"],
  },
  operations: {
    detect: ["operations", "process", "vendor", "supply", "logistics", "program"],
    boost: ["vendor management", "reporting", "analytics", "strategy", "excel"],
  },
};

const ROLE_SIGNAL_GROUPS = [
  {
    label: "analytical thinking",
    jd: ["analytical thinking", "root cause", "effective analysis", "alternative solutions"],
    resume: ["analytical thinking", "analysis", "analyzed", "root cause", "insight", "insights", "diagnostic"],
  },
  {
    label: "accuracy and attention to detail",
    jd: ["accuracy and attention to detail", "accuracy", "precision", "high levels of precision"],
    resume: ["accuracy", "attention to detail", "precision", "validated", "quality", "audited", "cleaned"],
  },
  {
    label: "requirements analysis",
    jd: ["requirements analysis", "required business functionality", "non-functionality requirements"],
    resume: ["requirements", "stakeholder", "specification", "business functionality", "user needs", "documentation"],
  },
  {
    label: "machine learning",
    jd: ["machine learning", "deep learning", "algorithms", "model training"],
    resume: ["machine learning", "deep learning", "model", "models", "algorithm", "regression", "classification", "prediction"],
  },
  {
    label: "model evaluation and selection",
    jd: ["model training", "evaluation", "selection", "fine-tuning", "developing new models"],
    resume: ["model evaluation", "evaluated", "selected", "fine tuned", "fine-tuning", "validation", "metrics", "regression"],
  },
  {
    label: "business statistics",
    jd: ["business statistics", "statistical tools", "statistics-based", "statistical modeling"],
    resume: ["statistics", "statistical", "regression", "hypothesis", "confidence", "variance", "probability"],
  },
  {
    label: "programming languages",
    jd: ["programming languages", "python", "write and modify programming", "programming"],
    resume: ["python", "r", "java", "javascript", "typescript", "programming", "coded", "script"],
  },
  {
    label: "query and database tools",
    jd: ["query and database", "sql", "database", "searching", "extracting", "formatting data"],
    resume: ["sql", "database", "query", "queries", "etl", "extract", "data pipeline", "pandas"],
  },
  {
    label: "data visualization",
    jd: ["data visualization", "business intelligence", "business insights", "reporting"],
    resume: ["tableau", "power bi", "dashboard", "visualization", "reporting", "insights", "charts"],
  },
  {
    label: "sensor and IoT data",
    jd: ["iot data", "time-series sensor data", "sensor data", "machine fault codes"],
    resume: ["sensor data", "sensor", "time series", "recordings", "telemetry", "signals", "fault", "logs"],
  },
  {
    label: "predictive maintenance",
    jd: ["predict equipment failure", "equipment failure", "remaining useful life", "risk models", "asset management"],
    resume: ["failure", "predict", "prediction", "anomaly", "anomalies", "risk", "maintenance", "regression detection"],
  },
  {
    label: "generative ai",
    jd: ["generative ai", "prompt engineering", "agents", "assistants", "chatbots"],
    resume: ["generative ai", "llm", "prompt", "agent", "chatbot", "assistant", "openai"],
  },
  {
    label: "cloud platforms",
    jd: ["cloud platforms", "cloud"],
    resume: ["aws", "azure", "gcp", "cloud", "databricks", "snowflake"],
  },
  {
    label: "telematics connectivity",
    jd: ["telematics", "cellular", "satellite", "wi-fi", "wifi", "bluetooth", "connectivity"],
    resume: ["telematics", "cellular", "satellite", "wi-fi", "wifi", "bluetooth", "connectivity"],
  },
  {
    label: "physics-based analytics",
    jd: ["physics-based analytics", "physics based"],
    resume: ["physics-based", "physics based", "physics", "simulation", "mechanical"],
  },
];

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(text) {
  return normalize(text).replace(/[\s.-]+/g, "");
}

function tokenize(text) {
  return normalize(text)
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function getImportantTerms(text, limit = 45) {
  const counts = new Map();
  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term]) => term);
}

function includesPhrase(text, phrase) {
  const normalizedText = normalize(text);
  const normalizedPhrase = normalize(phrase);
  return normalizedText.includes(normalizedPhrase) || compact(text).includes(compact(phrase));
}

function getJobInputWarning(text) {
  const normalized = normalize(text);
  if (!normalized) return "";
  if (
    normalized.includes("final match assessment") ||
    normalized.includes("estimated ats match") ||
    normalized.includes("this resume mirrors") ||
    normalized.includes("what's honestly missing") ||
    normalized.includes("whats honestly missing")
  ) {
    return "This looks like a candidate match assessment, not the original job description. Real ATS matching should use the company's JD, including responsibilities, qualifications, and required skills.";
  }
  if (
    !normalized.includes("job description") &&
    !normalized.includes("what you will do") &&
    !normalized.includes("qualifications") &&
    !normalized.includes("responsibilities") &&
    !normalized.includes("skills and experiences") &&
    normalized.length < 1800
  ) {
    return "This job input is short or missing common JD sections. Scores may be less reliable than they would be with the full posting.";
  }
  return "";
}

function renderJobWarning() {
  const warning = getJobInputWarning(els.jdText.value);
  els.jdWarning.textContent = warning;
  els.jdWarning.hidden = !warning;
}

function hasAny(text, phrases) {
  return phrases.some((phrase) => includesPhrase(text, phrase));
}

function getActiveSignalGroups(jd) {
  return ROLE_SIGNAL_GROUPS.filter((group) => hasAny(jd, group.jd));
}

function resolveRoleTemplate(jd, selected = state.roleTemplate) {
  if (selected && selected !== "auto") return selected;
  const scores = Object.entries(ROLE_TEMPLATES).map(([key, template]) => [
    key,
    template.detect.filter((term) => includesPhrase(jd, term)).length,
  ]);
  const [best, score] = scores.sort((a, b) => b[1] - a[1])[0] || ["data", 0];
  return score ? best : "data";
}

function scoreSignalGroups(jd, resumeText) {
  const activeGroups = getActiveSignalGroups(jd);
  const matched = activeGroups.filter((group) => hasAny(resumeText, [...group.jd, ...group.resume]));
  const missing = activeGroups.filter((group) => !matched.includes(group));
  const optionalLabels = new Set(["telematics connectivity", "physics-based analytics", "generative ai", "cloud platforms"]);
  const coreMatched = matched.filter((group) => !optionalLabels.has(group.label));
  const coreTotal = activeGroups.filter((group) => !optionalLabels.has(group.label)).length;
  const score = activeGroups.length
    ? Math.round(((coreMatched.length * 1.15 + (matched.length - coreMatched.length) * 0.65) / Math.max(1, coreTotal * 1.15 + (activeGroups.length - coreTotal) * 0.65)) * 100)
    : 0;
  return {
    score: Math.min(100, score),
    matched: matched.map((group) => group.label),
    missing: missing.map((group) => group.label),
  };
}

function estimateExperience(text) {
  const matches = [...text.matchAll(/(\d{1,2})\+?\s*(?:years|yrs|year)/gi)];
  const literalYears = matches.length ? Math.max(...matches.map((match) => Number(match[1]))) : 0;
  const dateRangeMonths = estimateDateRangeMonths(text);
  return Math.min(20, Math.max(literalYears, Math.round(dateRangeMonths / 12)));
}

function estimateDateRangeMonths(text) {
  const months = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  };
  const normalized = normalize(text);
  const ranges = [...normalized.matchAll(/\b([a-z]{3,9})\s*(20\d{2})\s*[-]\s*([a-z]{3,9})\s*(20\d{2}|present|current)\b/g)];
  let total = 0;
  for (const range of ranges) {
    const startMonth = months[range[1]];
    const endMonth = months[range[3]];
    if (startMonth === undefined || endMonth === undefined) continue;
    const start = Number(range[2]) * 12 + startMonth;
    const endYear = /present|current/.test(range[4]) ? 2026 : Number(range[4]);
    const end = endYear * 12 + endMonth;
    if (end >= start) total += end - start + 1;
  }
  return Math.min(total, 240);
}

function getExperienceRequirement(text) {
  const normalized = normalize(text);
  const range = normalized.match(/(\d{1,2})\s*-\s*(\d{1,2})\s*(?:years|yrs|year)/);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    return { min, max, entryLevel: min === 0 && max <= 2 };
  }
  const required = normalized.match(/(\d{1,2})\+?\s*(?:years|yrs|year)/);
  if (!required) return { min: 0, max: 0, entryLevel: false };
  const years = Number(required[1]);
  return { min: years, max: years, entryLevel: years <= 1 };
}

function educationScore(text) {
  const normalized = normalize(text);
  const compacted = compact(text);
  const terms = ["phd", "master", "mba", "bachelor", "degree", "university", "college", "computer science", "engineering"];
  const hasDegreeAbbrev = /\bb\.?\s?s\.?\b|\bb\.?\s?a\.?\b|\bm\.?\s?s\.?\b|\bm\.?\s?a\.?\b/i.test(text) || compacted.includes("bscomputer") || compacted.includes("bscs");
  const hits = terms.filter((term) => includesPhrase(text, term)).length + (hasDegreeAbbrev ? 2 : 0);
  return Math.min(100, Math.round((hits / 5) * 100));
}

function getRoleSignals(text) {
  return SKILL_TERMS.filter((term) => {
    const aliases = SKILL_ALIASES[term] || [];
    return includesPhrase(text, term) || aliases.some((alias) => includesPhrase(text, alias));
  });
}

function parseName(fileName, text) {
  const firstLines = String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);
  const likely = firstLines.find((line) => {
    const words = line.split(/\s+/);
    return words.length >= 2 && words.length <= 4 && !/@|resume|curriculum|phone|summary/i.test(line);
  });
  return likely || fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
}

function extractProfile(fileName, text) {
  const normalized = normalize(text);
  const emails = String(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const phones = String(text).match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
  const skills = [...new Set([...getRoleSignals(text), ...getActiveSignalGroups(text).map((group) => group.label)])];
  const degree =
    (includesPhrase(text, "phd") && "PhD") ||
    (includesPhrase(text, "master") && "Master") ||
    ((/\bb\.?\s?s\.?\b/i.test(text) || compact(text).includes("bscomputer")) && "Bachelor") ||
    (includesPhrase(text, "bachelor") && "Bachelor") ||
    (includesPhrase(text, "degree") && "Degree") ||
    "Not detected";
  const gpaMatch = normalized.match(/\bgpa[:\s]*([0-4](?:\.\d{1,2})?)\b/) || normalized.match(/\b([0-4]\.\d{1,2})\s*\/\s*4\.0\b/);
  const experienceMonths = estimateDateRangeMonths(text);
  const quantifiedBullets = (String(text).match(/\d+(?:\.\d+)?%?|\d+k\+?|\d+\+/gi) || []).length;
  const sections = ["education", "skills", "experience", "projects"].filter((section) => normalized.includes(section));
  return {
    name: parseName(fileName, text),
    email: emails[0] || "",
    phone: phones[0] || "",
    degree,
    gpa: gpaMatch?.[1] || "",
    skills,
    sections,
    experienceMonths,
    quantifiedBullets,
    parseCompleteness: Math.min(100, Math.round((sections.length / 4) * 35 + (skills.length ? 30 : 0) + (degree !== "Not detected" ? 20 : 0) + (emails.length ? 10 : 0) + (quantifiedBullets ? 5 : 0))),
  };
}

function extractEvidence(text, labels) {
  const chunks = String(text)
    .replace(/\s+/g, " ")
    .split(/(?:\s•\s|\n|(?<=[.!?])\s+)/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 35);
  const evidence = [];
  for (const label of labels) {
    const group = ROLE_SIGNAL_GROUPS.find((item) => item.label === label);
    const phrases = group ? [...group.jd, ...group.resume] : [label, ...(SKILL_ALIASES[label] || [])];
    const match = chunks.find((chunk) => hasAny(chunk, phrases));
    if (match) evidence.push({ label, text: match.slice(0, 220) });
  }
  return evidence.slice(0, 4);
}

function getRiskFlags(result, profile, jdWarning, options = {}) {
  const flags = [];
  if (result.status === "rejected") flags.push("Failed knockout rule");
  if (jdWarning) flags.push("Job input quality warning");
  if (profile.parseCompleteness < 55) flags.push("Low parse completeness");
  if (result.breakdown.skills < 55) flags.push("Weak skill evidence");
  if (result.breakdown.match < 55) flags.push("Low JD alignment");
  if (result.missingSignals.length >= 4) flags.push("Several competency gaps");
  if (options.strictMode && !result.evidence?.length) flags.push("No grounded evidence");
  return flags.slice(0, 5);
}

function getVerdict(score, status, flags) {
  if (status === "rejected") return "Auto-reject";
  if (score >= 82 && flags.length <= 2) return "Strong match";
  if (score >= 68) return "Recruiter review";
  if (score >= 50) return "Needs evidence";
  return "Low match";
}

function getWeights() {
  const raw = {
    match: Number(els.weightMatch.value || 42),
    skills: Number(els.weightSkills.value || 30),
    experience: Number(els.weightExperience.value || 18),
    education: Number(els.weightEducation.value || 10),
  };
  const total = Object.values(raw).reduce((sum, value) => sum + value, 0) || 1;
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, value / total]));
}

function scoreTemplateBoost(roleFamily, matchedSignals) {
  const template = ROLE_TEMPLATES[roleFamily];
  if (!template) return 0;
  const hits = template.boost.filter((term) => matchedSignals.some((signal) => includesPhrase(signal, term) || includesPhrase(term, signal))).length;
  return Math.min(8, hits * 1.5);
}

function tokenizeSearchQuery(query) {
  return [...String(query || "").matchAll(/"([^"]+)"|(\S+)/g)].map((match) => match[1] || match[2]);
}

function matchesBooleanSearch(text, query) {
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) return true;
  const clauses = normalizedQuery
    .split(/\s+OR\s+/i)
    .map((clause) => tokenizeSearchQuery(clause).filter((term) => !/^AND$/i.test(term)))
    .filter(Boolean);
  return clauses.some((terms) => {
    const positive = terms.filter((term) => !term.startsWith("-"));
    const negative = terms.filter((term) => term.startsWith("-")).map((term) => term.slice(1));
    return positive.every((term) => includesPhrase(text, term)) && negative.every((term) => !includesPhrase(text, term));
  });
}

function getConfidence(profile, result, jdWarning) {
  const penalty = (jdWarning ? 18 : 0) + (result.error ? 18 : 0) + (result.wordCount < 120 ? 12 : 0);
  const evidenceBonus = Math.min(15, result.matchedSignals.length * 2);
  return Math.max(35, Math.min(96, Math.round(profile.parseCompleteness * 0.55 + evidenceBonus + 30 - penalty)));
}

function scoreResumeAgainstJob(jd, resumeText, options = {}) {
  const hardRules = options.keywords || [];
  const ruleMode = options.ruleMode || "all";
  const fileName = options.fileName || "Resume.txt";
  const weights = options.weights || { match: 0.42, skills: 0.3, experience: 0.18, education: 0.1 };
  const roleFamily = resolveRoleTemplate(jd, options.roleTemplate || "auto");
  const strictMode = options.strictMode ?? true;
  const profile = extractProfile(fileName, resumeText);
  const jdWarning = getJobInputWarning(jd);
  const jdTerms = getImportantTerms(jd);
  const jdSignals = getRoleSignals(jd);
  const signalGroups = scoreSignalGroups(jd, resumeText);
  const resumeTerms = new Set(tokenize(resumeText));
  const matchedTerms = jdTerms.filter((term) => resumeTerms.has(term) || includesPhrase(resumeText, term));
  const lexicalScore = jdTerms.length ? Math.round((matchedTerms.length / jdTerms.length) * 100) : 0;
  const termScore = Math.round(lexicalScore * 0.35 + signalGroups.score * 0.65);

  const matchedSignals = jdSignals.filter((signal) => includesPhrase(resumeText, signal));
  const keywordSkillScore = jdSignals.length
    ? Math.round((matchedSignals.length / jdSignals.length) * 100)
    : Math.min(100, getRoleSignals(resumeText).length * 10);
  const skillScore = Math.max(keywordSkillScore, signalGroups.score);

  const experienceRequirement = getExperienceRequirement(jd);
  const resumeYears = estimateExperience(resumeText);
  const experienceScore = experienceRequirement.entryLevel
    ? 100
    : experienceRequirement.min
      ? Math.min(100, Math.round((resumeYears / experienceRequirement.min) * 100))
      : Math.max(hasAny(resumeText, ["intern", "research assistant", "project", "hackathon", "coursework"]) ? 70 : 0, Math.min(100, resumeYears * 12));
  const eduScore = Math.min(100, educationScore(resumeText));

  const presentRules = hardRules.filter((keyword) => includesPhrase(resumeText, keyword));
  const missingRules = hardRules.filter((keyword) => !includesPhrase(resumeText, keyword));
  const passedRules =
    !hardRules.length ||
    (ruleMode === "all" ? missingRules.length === 0 : presentRules.length > 0);

  const semanticScore = Math.max(termScore, Math.round(skillScore * 0.65));
  const ruleBonus = hardRules.length ? 8 : 0;
  const mergedSignals = [...new Set([...matchedSignals, ...signalGroups.matched])];
  const roleBoost = scoreTemplateBoost(roleFamily, mergedSignals);
  const evidence = extractEvidence(resumeText, mergedSignals);
  const score = passedRules
    ? Math.min(100, Math.round(semanticScore * weights.match + skillScore * weights.skills + experienceScore * weights.experience + eduScore * weights.education + ruleBonus + roleBoost))
    : 0;
  const partialResult = {
    status: passedRules ? "passed" : "rejected",
    score,
    breakdown: {
      match: termScore,
      skills: skillScore,
      experience: experienceScore,
      education: eduScore,
    },
    matchedSignals: mergedSignals,
    missingSignals: signalGroups.missing,
    wordCount: tokenize(resumeText).length,
    evidence,
  };
  const riskFlags = getRiskFlags(partialResult, profile, jdWarning, { strictMode });

  return {
    fileName,
    name: profile.name,
    status: partialResult.status,
    score,
    verdict: getVerdict(score, partialResult.status, riskFlags),
    confidence: getConfidence(profile, partialResult, jdWarning),
    roleFamily,
    roleBoost,
    breakdown: partialResult.breakdown,
    matchedTerms: matchedTerms.slice(0, 12),
    matchedSignals: partialResult.matchedSignals,
    missingSignals: partialResult.missingSignals,
    evidence,
    profile,
    riskFlags,
    presentRules,
    missingRules,
    years: resumeYears,
    wordCount: partialResult.wordCount,
    searchableText: `${resumeText} ${profile.skills.join(" ")} ${partialResult.matchedSignals.join(" ")} ${profile.degree}`,
  };
}

function scoreResume(resume) {
  return {
    id: resume.id,
    ...scoreResumeAgainstJob(els.jdText.value, resume.text, {
      keywords: state.keywords,
      ruleMode: state.ruleMode,
      weights: getWeights(),
      roleTemplate: state.roleTemplate,
      strictMode: state.strictMode,
      fileName: resume.file.name,
    }),
    error: resume.error,
  };
}

window.__talentRankScoreText = scoreResumeAgainstJob;

async function readFileAsText(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "pdf") return readPdf(file);
  if (ext === "docx") return readDocx(file);
  return file.text();
}

async function readPdf(file) {
  const pdfjsLib =
    window.pdfjsLib ||
    (await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs"));
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs";
  window.pdfjsLib = pdfjsLib;
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  return pages.join("\n");
}

async function readDocx(file) {
  if (!window.mammoth) {
    return fallbackFileText(file, "DOCX parser is still loading. Try Score again in a moment.");
  }
  const data = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer: data });
  return result.value;
}

async function fallbackFileText(file, message) {
  if (/\.(txt|md)$/i.test(file.name)) return file.text();
  throw new Error(message);
}

async function addResumeFiles(files) {
  const incoming = [...files];
  for (const file of incoming) {
    const id = `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`;
    state.resumes.push({ id, file, text: "", status: "pending" });
  }
  renderFiles();
  await hydrateResumeText();
}

async function hydrateResumeText() {
  for (const resume of state.resumes.filter((item) => !item.text && !item.error)) {
    try {
      resume.text = await readFileAsText(resume.file);
      resume.status = "ready";
    } catch (error) {
      resume.text = "";
      resume.error = error.message;
      resume.status = "error";
    }
  }
  renderFiles();
}

async function loadJobFile(file) {
  try {
    els.jdText.value = await readFileAsText(file);
    renderJobWarning();
  } catch (error) {
    alert(error.message);
  }
}

function addKeyword(value) {
  const keyword = value.trim();
  if (!keyword) return;
  if (!state.keywords.some((item) => item.toLowerCase() === keyword.toLowerCase())) {
    state.keywords.push(keyword);
  }
  els.keywordInput.value = "";
  renderKeywords();
}

function removeKeyword(keyword) {
  state.keywords = state.keywords.filter((item) => item !== keyword);
  renderKeywords();
}

function runScan() {
  renderJobWarning();
  if (!els.jdText.value.trim()) {
    alert("Add a job description before scoring.");
    return;
  }
  if (!state.resumes.length) {
    alert("Upload at least one resume before scoring.");
    return;
  }
  state.results = state.resumes.map(scoreResume).sort((a, b) => {
    if (a.status !== b.status) return a.status === "passed" ? -1 : 1;
    return b.score - a.score;
  });
  persistEvaluationSnapshot(state.results);
  renderResults();
}

function renderKeywords() {
  els.keywordChips.innerHTML = state.keywords
    .map(
      (keyword) => `
        <span class="chip">
          ${escapeHtml(keyword)}
          <button type="button" data-remove-keyword="${escapeHtml(keyword)}" title="Remove keyword">x</button>
        </span>
      `,
    )
    .join("");
}

function renderFiles() {
  els.fileCount.textContent = `${state.resumes.length} ${state.resumes.length === 1 ? "file" : "files"}`;
  els.fileList.innerHTML = state.resumes
    .map(
      (resume) => `
        <li>
          <span title="${escapeHtml(resume.file.name)}">${escapeHtml(resume.file.name)}</span>
          <small>${resume.error ? "Parser issue" : resume.status === "ready" ? "Ready" : "Loading"}</small>
          <button type="button" data-remove-file="${resume.id}" title="Remove file">x</button>
        </li>
      `,
    )
    .join("");
  updateMetrics();
}

function renderResults() {
  const filtered = state.results.filter((result) => {
    const statusMatch = state.filter === "all" || result.status === state.filter;
    const scoreMatch = result.status === "rejected" || result.score >= state.minScore;
    const queryMatch = matchesBooleanSearch(result.searchableText, state.searchQuery);
    return statusMatch && scoreMatch && queryMatch;
  });
  els.emptyState.style.display = filtered.length ? "none" : "grid";
  els.resultsList.innerHTML = filtered.map(candidateTemplate).join("");
  renderInsights(filtered);
  updateMetrics();
}

function renderInsights(filteredResults = state.results) {
  const passed = filteredResults.filter((result) => result.status === "passed");
  const strong = passed.filter((result) => result.score >= 80);
  const decided = Object.keys(state.decisions).length;
  const avgScore = passed.length ? Math.round(passed.reduce((sum, result) => sum + result.score, 0) / passed.length) : 0;
  const avgConfidence = filteredResults.length
    ? Math.round(filteredResults.reduce((sum, result) => sum + (result.confidence || 0), 0) / filteredResults.length)
    : 0;
  const parseHealth = filteredResults.length
    ? Math.round(filteredResults.reduce((sum, result) => sum + (result.profile?.parseCompleteness || 0), 0) / filteredResults.length)
    : 0;
  const reviewHoursSaved = Math.max(0, Math.round((state.results.length * 8 - passed.length * 3) / 60 * 10) / 10);
  const cards = [
    ["Shortlist", `${passed.length}/${state.results.length}`],
    ["Strong", strong.length],
    ["Avg score", avgScore],
    ["Confidence", `${avgConfidence}%`],
    ["Parse health", `${parseHealth}%`],
    ["Review saved", `${reviewHoursSaved}h`],
    ["Query hits", filteredResults.length],
    ["Knockouts", state.results.filter((result) => result.status === "rejected").length],
    ["Decisions", decided],
    ["Audit events", state.auditLog.length],
  ];
  els.insightsGrid.innerHTML = cards
    .map(([label, value]) => `<div class="insight-card"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`)
    .join("");
}

function recordDecision(candidateId, decision) {
  const candidate = state.results.find((result) => result.id === candidateId);
  if (!candidate) return;
  const event = {
    at: new Date().toISOString(),
    candidateId,
    candidateName: candidate.name,
    decision,
    score: candidate.score,
    verdict: candidate.verdict,
    model: "TalentRank hybrid-v0.4",
    roleFamily: candidate.roleFamily,
  };
  state.decisions[candidateId] = event;
  state.auditLog.push(event);
  persistAuditEvent({
    type: "candidate.decision",
    candidateId,
    candidateName: candidate.name,
    decision,
    score: candidate.score,
    verdict: candidate.verdict,
    roleFamily: candidate.roleFamily,
    metadata: {
      confidence: candidate.confidence,
      riskFlags: candidate.riskFlags,
      matchedSignals: candidate.matchedSignals,
      missingSignals: candidate.missingSignals,
    },
  });
  renderResults();
}

async function persistAuditEvent(event) {
  if (location.protocol === "file:") return;
  try {
    await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch (error) {
    console.warn("Audit persistence failed", error);
  }
}

async function persistEvaluationSnapshot(results) {
  if (location.protocol === "file:" || !results.length) return;
  const passed = results.filter((result) => result.status === "passed");
  const strong = passed.filter((result) => result.score >= 80);
  try {
    await fetch("/api/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "TalentRank hybrid-v0.4",
        candidateCount: results.length,
        shortlistCount: passed.length,
        strongMatchCount: strong.length,
        avgScore: passed.length ? Math.round(passed.reduce((sum, result) => sum + result.score, 0) / passed.length) : 0,
        avgConfidence: Math.round(results.reduce((sum, result) => sum + (result.confidence || 0), 0) / results.length),
        parseHealth: Math.round(results.reduce((sum, result) => sum + (result.profile?.parseCompleteness || 0), 0) / results.length),
        falseKnockoutReviewCount: results.filter((result) => result.status === "rejected" && result.breakdown.skills >= 75).length,
      }),
    });
  } catch (error) {
    console.warn("Evaluation persistence failed", error);
  }
}

function candidateTemplate(candidate, index) {
  const isRejected = candidate.status === "rejected";
  const rank = isRejected ? "Rejected" : `#${index + 1}`;
  const displayName = state.blindReview ? `Candidate ${index + 1}` : candidate.name;
  const displayFile = state.blindReview ? "Identity hidden" : candidate.fileName;
  const selectedDecision = state.decisions[candidate.id]?.decision || "";
  const profileBits = [
    candidate.profile?.degree,
    candidate.profile?.gpa ? `GPA ${candidate.profile.gpa}` : "",
    `${candidate.confidence}% confidence`,
    candidate.verdict,
    candidate.roleFamily ? `${candidate.roleFamily} template` : "",
  ].filter(Boolean);
  return `
    <article class="candidate-card ${isRejected ? "is-rejected" : ""}">
      <div class="score-ring" style="--score:${candidate.score}%"><span>${candidate.score}</span></div>
      <div class="candidate-main">
        <div class="candidate-head">
          <div>
            <h4>${escapeHtml(displayName)}</h4>
            <div class="candidate-meta">
              <span>${escapeHtml(displayFile)}</span>
              <span>${candidate.wordCount} terms</span>
              <span>${candidate.years || 0}+ yrs</span>
              ${profileBits.map((bit) => `<span>${escapeHtml(bit)}</span>`).join("")}
            </div>
          </div>
          <span class="rank-badge ${isRejected ? "reject-badge" : ""}">${rank}</span>
        </div>
        <div class="bars">
          ${barTemplate("JD match", candidate.breakdown.match)}
          ${barTemplate("Skills", candidate.breakdown.skills)}
          ${barTemplate("Experience", candidate.breakdown.experience)}
          ${barTemplate("Education", candidate.breakdown.education)}
        </div>
        ${
          isRejected
            ? `<p class="missing-rules"><strong>Missing rule:</strong> ${escapeHtml(candidate.missingRules.join(", ") || "Required keyword rule not met")}</p>`
            : `<p class="matched-terms"><strong>Matched:</strong> ${escapeHtml(candidate.matchedSignals.slice(0, 10).join(", ") || candidate.matchedTerms.join(", ") || "Limited direct keyword overlap")}</p>`
        }
        ${
          candidate.missingSignals?.length
            ? `<p class="matched-terms"><strong>Gaps:</strong> ${escapeHtml(candidate.missingSignals.slice(0, 6).join(", "))}</p>`
            : ""
        }
        ${
          candidate.evidence?.length
            ? `<div class="evidence-block">
                ${candidate.evidence.map((item) => `
                  <div>
                    <strong>${escapeHtml(item.label)}</strong>
                    <span>${escapeHtml(item.text)}</span>
                  </div>
                `).join("")}
              </div>`
            : ""
        }
        ${
          candidate.riskFlags?.length
            ? `<div class="risk-flags">${candidate.riskFlags.map((flag) => `<span>${escapeHtml(flag)}</span>`).join("")}</div>`
            : ""
        }
        <div class="decision-row" data-candidate-id="${escapeHtml(candidate.id)}">
          ${["shortlist", "hold", "reject", "interview"].map((decision) => `
            <button type="button" data-decision="${decision}" class="${selectedDecision === decision ? "is-selected" : ""}">
              ${decision}
            </button>
          `).join("")}
        </div>
        ${candidate.error ? `<p class="missing-rules"><strong>Parser:</strong> ${escapeHtml(candidate.error)}</p>` : ""}
      </div>
    </article>
  `;
}

function barTemplate(label, value) {
  const bounded = Math.max(0, Math.min(100, value));
  return `
    <div class="bar-row">
      <span>${label}</span>
      <div class="bar-track"><i style="--width:${bounded}%"></i></div>
      <b>${bounded}</b>
    </div>
  `;
}

function updateMetrics() {
  const passed = state.results.filter((result) => result.status === "passed").length;
  const rejected = state.results.filter((result) => result.status === "rejected").length;
  els.metricTotal.textContent = state.resumes.length;
  els.metricPassed.textContent = passed;
  els.metricRejected.textContent = rejected;
}

function exportCsv() {
  if (!state.results.length) {
    alert("Run a score before exporting.");
    return;
  }
  const rows = [
    ["Rank", "Name", "File", "Status", "Recruiter Decision", "Verdict", "Confidence", "Score", "JD Match", "Skills", "Experience", "Education", "Role Family", "Degree", "GPA", "Missing Hard Rules", "Matched Signals", "Missing Signals", "Risk Flags", "Matched Terms"],
    ...state.results.map((result, index) => [
      result.status === "passed" ? index + 1 : "",
      result.name,
      result.fileName,
      result.status,
      state.decisions[result.id]?.decision || "",
      result.verdict,
      result.confidence,
      result.score,
      result.breakdown.match,
      result.breakdown.skills,
      result.breakdown.experience,
      result.breakdown.education,
      result.roleFamily,
      result.profile.degree,
      result.profile.gpa,
      result.missingRules.join("; "),
      result.matchedSignals.join("; "),
      result.missingSignals.join("; "),
      result.riskFlags.join("; "),
      result.matchedTerms.join("; "),
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "talentrank-results.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadSample() {
  els.jdText.value = `Senior Frontend Engineer

We need a React and TypeScript engineer with 5+ years of experience building accessible, data-rich SaaS tools. The role requires JavaScript, CSS, analytics dashboards, API integration, collaboration with design, and strong product judgment. Experience with healthcare compliance and HIPAA is required.`;
  state.keywords = ["React", "TypeScript", "HIPAA"];
  state.ruleMode = "all";
  els.allRulesBtn.classList.add("is-selected");
  els.anyRulesBtn.classList.remove("is-selected");
  state.resumes = [
    {
      id: "sample-1",
      file: { name: "Maya Shah Resume.txt", size: 1320, lastModified: Date.now() },
      text: `Maya Shah
Senior Frontend Engineer with 7 years of experience building React, TypeScript, JavaScript, CSS, and analytics products. Led accessibility work for healthcare dashboards and HIPAA compliant workflows. Built API integrations and collaborated closely with design and product teams. Bachelor degree in Computer Science.`,
      status: "ready",
    },
    {
      id: "sample-2",
      file: { name: "Jordan Lee Resume.txt", size: 980, lastModified: Date.now() },
      text: `Jordan Lee
Frontend developer with 5 years of experience in Vue, JavaScript, CSS, and ecommerce analytics. Built responsive dashboards, improved performance, and worked with design systems. Bachelor degree in Information Systems.`,
      status: "ready",
    },
    {
      id: "sample-3",
      file: { name: "Priya Nair Resume.txt", size: 1150, lastModified: Date.now() },
      text: `Priya Nair
Full stack engineer with 6 years of experience using React, TypeScript, Node, SQL, API integrations, and healthcare reporting. Delivered patient engagement tools with HIPAA compliance and accessibility reviews. Master degree in Software Engineering.`,
      status: "ready",
    },
  ];
  state.results = [];
  renderKeywords();
  renderFiles();
  renderJobWarning();
  renderResults();
}

els.jdFile.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) loadJobFile(file);
});

els.jdText.addEventListener("input", renderJobWarning);

els.addKeywordBtn.addEventListener("click", () => addKeyword(els.keywordInput.value));
els.keywordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addKeyword(els.keywordInput.value);
  }
});

els.keywordChips.addEventListener("click", (event) => {
  const keyword = event.target.dataset.removeKeyword;
  if (keyword) removeKeyword(keyword);
});

els.allRulesBtn.addEventListener("click", () => {
  state.ruleMode = "all";
  els.allRulesBtn.classList.add("is-selected");
  els.anyRulesBtn.classList.remove("is-selected");
});

els.anyRulesBtn.addEventListener("click", () => {
  state.ruleMode = "any";
  els.anyRulesBtn.classList.add("is-selected");
  els.allRulesBtn.classList.remove("is-selected");
});

els.resumeFiles.addEventListener("change", (event) => addResumeFiles(event.target.files));

els.fileList.addEventListener("click", (event) => {
  const id = event.target.dataset.removeFile;
  if (!id) return;
  state.resumes = state.resumes.filter((resume) => resume.id !== id);
  state.results = state.results.filter((result) => result.id !== id);
  renderFiles();
  renderResults();
});

["dragenter", "dragover"].forEach((eventName) => {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("is-dragging");
  });
});

els.dropZone.addEventListener("drop", (event) => addResumeFiles(event.dataTransfer.files));
els.scanBtn.addEventListener("click", async () => {
  await hydrateResumeText();
  runScan();
});
els.loadSampleBtn.addEventListener("click", loadSample);
els.exportBtn.addEventListener("click", exportCsv);
els.statusFilter.addEventListener("change", (event) => {
  state.filter = event.target.value;
  renderResults();
});
els.roleTemplate.addEventListener("change", (event) => {
  state.roleTemplate = event.target.value;
  if (state.results.length) runScan();
});
els.searchQuery.addEventListener("input", (event) => {
  state.searchQuery = event.target.value;
  renderResults();
});
els.minScore.addEventListener("input", (event) => {
  state.minScore = Number(event.target.value);
  els.minScoreLabel.textContent = state.minScore;
  renderResults();
});
[els.weightMatch, els.weightSkills, els.weightExperience, els.weightEducation].forEach((input) => {
  input.addEventListener("input", () => {
    if (state.results.length) runScan();
  });
});
els.blindReview.addEventListener("change", (event) => {
  state.blindReview = event.target.checked;
  renderResults();
});
els.strictMode.addEventListener("change", (event) => {
  state.strictMode = event.target.checked;
  if (state.results.length) runScan();
});
els.resultsList.addEventListener("click", (event) => {
  const decision = event.target.dataset.decision;
  const row = event.target.closest(".decision-row");
  if (!decision || !row) return;
  recordDecision(row.dataset.candidateId, decision);
});

renderKeywords();
renderFiles();
renderJobWarning();
renderInsights();
renderResults();
