import type { RoleTemplate } from "./types";

export type SkillFamily = Exclude<RoleTemplate, "auto">;

export type SkillNode = {
  id: string;
  label: string;
  family: SkillFamily;
  aliases: string[];
  adjacent: string[];
  senioritySignals: string[];
  weight: number;
};

export const skillGraph: SkillNode[] = [
  {
    id: "python",
    label: "Python",
    family: "data",
    aliases: ["pandas", "numpy", "scipy", "jupyter", "sklearn", "scikit-learn"],
    adjacent: ["machine learning", "analytics", "statistics", "etl"],
    senioritySignals: ["production python", "package", "automation", "pipeline"],
    weight: 1.1,
  },
  {
    id: "sql",
    label: "SQL",
    family: "data",
    aliases: ["postgresql", "mysql", "snowflake", "bigquery", "query", "database"],
    adjacent: ["analytics", "etl", "data modeling", "dashboard"],
    senioritySignals: ["optimized query", "data warehouse", "schema", "dbt"],
    weight: 1.15,
  },
  {
    id: "machine learning",
    label: "Machine Learning",
    family: "data",
    aliases: ["ml", "model", "models", "regression", "classification", "prediction", "xgboost", "random forest"],
    adjacent: ["statistics", "python", "model evaluation", "feature engineering"],
    senioritySignals: ["deployed model", "model monitoring", "experiment tracking", "production model"],
    weight: 1.25,
  },
  {
    id: "statistics",
    label: "Statistics",
    family: "data",
    aliases: ["statistical", "probability", "hypothesis", "ab test", "a/b test", "calibration"],
    adjacent: ["analytics", "machine learning", "forecasting"],
    senioritySignals: ["causal", "confidence interval", "significance", "experimental design"],
    weight: 1,
  },
  {
    id: "analytics",
    label: "Analytics",
    family: "data",
    aliases: ["analysis", "insights", "eda", "analytical", "requirements analysis"],
    adjacent: ["sql", "data visualization", "statistics"],
    senioritySignals: ["stakeholder", "executive", "decision", "business impact"],
    weight: 1,
  },
  {
    id: "data visualization",
    label: "Data Visualization",
    family: "data",
    aliases: ["tableau", "power bi", "plotly", "dashboard", "looker"],
    adjacent: ["analytics", "sql", "reporting"],
    senioritySignals: ["self-service", "kpi", "executive dashboard", "metrics layer"],
    weight: 0.9,
  },
  {
    id: "generative ai",
    label: "Generative AI",
    family: "software",
    aliases: ["llm", "prompt", "agent", "chatbot", "rag", "openai", "langchain"],
    adjacent: ["machine learning", "python", "api"],
    senioritySignals: ["evaluation", "guardrails", "retrieval", "latency"],
    weight: 1.15,
  },
  {
    id: "typescript",
    label: "TypeScript",
    family: "software",
    aliases: ["javascript", "ts", "js", "node", "node.js"],
    adjacent: ["react", "api", "frontend", "backend"],
    senioritySignals: ["architecture", "typed", "monorepo", "design system"],
    weight: 1,
  },
  {
    id: "react",
    label: "React",
    family: "software",
    aliases: ["next.js", "nextjs", "frontend", "ui", "component"],
    adjacent: ["typescript", "design system", "api"],
    senioritySignals: ["performance", "accessibility", "state management", "server components"],
    weight: 0.95,
  },
  {
    id: "cloud infrastructure",
    label: "Cloud Infrastructure",
    family: "software",
    aliases: ["aws", "azure", "gcp", "docker", "kubernetes", "terraform"],
    adjacent: ["backend", "devops", "security"],
    senioritySignals: ["scaling", "observability", "ci/cd", "reliability"],
    weight: 1.05,
  },
  {
    id: "internet of things",
    label: "Internet of Things",
    family: "software",
    aliases: ["iot", "connected devices", "embedded systems", "edge devices", "sensor networks", "telematics"],
    adjacent: ["cloud infrastructure", "api", "data pipeline", "embedded software"],
    senioritySignals: ["device telemetry", "fleet monitoring", "edge computing", "sensor integration"],
    weight: 1.05,
  },
  {
    id: "crm",
    label: "CRM",
    family: "sales",
    aliases: ["salesforce", "hubspot", "pipeline", "account", "quota"],
    adjacent: ["customer success", "revenue", "forecasting"],
    senioritySignals: ["enterprise", "territory", "renewal", "stakeholder"],
    weight: 1,
  },
  {
    id: "financial modeling",
    label: "Financial Modeling",
    family: "finance",
    aliases: ["forecasting", "valuation", "excel", "risk", "accounting"],
    adjacent: ["analytics", "statistics", "budgeting"],
    senioritySignals: ["board", "variance", "scenario", "capital"],
    weight: 1,
  },
  {
    id: "operations",
    label: "Operations",
    family: "operations",
    aliases: ["process", "logistics", "supply", "vendor", "workflow"],
    adjacent: ["analytics", "automation", "project management"],
    senioritySignals: ["sla", "capacity", "continuous improvement", "cost reduction"],
    weight: 1,
  },
];

export const skillIds = skillGraph.map((skill) => skill.id);

export function aliasesFor(skillId: string) {
  return skillGraph.find((skill) => skill.id === skillId)?.aliases || [];
}

export function termsFor(skillId: string) {
  const skill = skillGraph.find((item) => item.id === skillId);
  return skill ? [skill.id, skill.label, ...skill.aliases] : [skillId];
}

export function adjacentFor(skillId: string) {
  return skillGraph.find((skill) => skill.id === skillId)?.adjacent || [];
}

export function roleSkills(role: RoleTemplate) {
  if (role === "auto") return skillGraph;
  return skillGraph.filter((skill) => skill.family === role);
}

export function skillWeight(skillId: string, role: RoleTemplate) {
  const skill = skillGraph.find((item) => item.id === skillId);
  if (!skill) return 1;
  return skill.weight * (role === "auto" || role === skill.family ? 1 : 0.82);
}

export function seniorityTerms() {
  return [...new Set(skillGraph.flatMap((skill) => skill.senioritySignals))];
}
