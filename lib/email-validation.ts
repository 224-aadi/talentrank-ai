const emailPattern = /^[A-Z0-9._%+-]+@(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,}$/i;

const commonDomainTypos: Record<string, string> = {
  "gmai.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmal.com": "gmail.com",
  "hotnail.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outllok.com": "outlook.com",
  "yaho.com": "yahoo.com",
  "yhaoo.com": "yahoo.com",
};

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validateSignupEmail(value: string) {
  const email = normalizeEmail(value);
  const [local, domain] = email.split("@");
  if (!email) return "Enter your work email.";
  if (!emailPattern.test(email) || !local || !domain) return "Enter a valid email address.";
  if (email.includes("..")) return "Email addresses cannot contain consecutive dots.";
  if (local.startsWith(".") || local.endsWith(".")) return "Enter a valid email address.";
  if (commonDomainTypos[domain]) return `Did you mean ${local}@${commonDomainTypos[domain]}?`;
  return "";
}
