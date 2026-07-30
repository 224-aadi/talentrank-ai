import assert from "node:assert/strict";
import test from "node:test";
import { runOcr } from "../lib/ocr.ts";
import { parseCandidateName } from "../lib/matching.ts";
import { extractStructuredProfile, validateResumeContent } from "../lib/parsing.ts";

const ocrResumeText = [
  "ALEX MORGAN",
  "B.TECH ECE GRADUATE | FPGA DESIGN | VERILOG HDL | EMBEDDED SYSTEMS | IOT",
  "alex.morgan@example.com | +1 555 234 9876 | linkedin.com/in/alex-morgan",
  "PROFILE",
  "Electronics and Communication Engineering graduate with hands-on experience in IoT, embedded systems, FPGA design, Arduino, Python, MATLAB, and Embedded C.",
  "EDUCATION",
  "B.Tech in Electronics and Communication Engineering 2022 - 2026",
  "EXPERIENCE",
  "Very Large Scale Integration Internship Jan 2026 - May 2026",
  "Developed and implemented an FPGA-based dual-axis solar tracking prototype.",
  "Internet of Things Internship Jun 2025 - Jul 2025",
  "Built a smart medical diagnostic kit using IoT concepts.",
  "PROJECTS",
  "FPGA-Based Dual Axis Solar Tracking System",
  "Medical Diagnostic Kit using IoT",
  "IoT-Based Weather Monitoring System",
  "SKILLS",
  "Python MATLAB Verilog HDL FPGA Embedded C IoT Raspberry Pi",
  "CERTIFICATIONS & TRAINING",
].join("\n");

test("legacy OCR.space settings parse the provider response and retry weak extraction", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    provider: process.env.OCR_PROVIDER,
    apiUrl: process.env.OCR_API_URL,
    apiKey: process.env.OCR_API_KEY,
    spaceKey: process.env.OCR_SPACE_API_KEY,
    engine: process.env.OCR_SPACE_ENGINE,
  };
  const engines: string[] = [];

  try {
    process.env.OCR_PROVIDER = "generic";
    process.env.OCR_API_URL = "https://api.ocr.space/parse/image";
    process.env.OCR_API_KEY = "test-key";
    delete process.env.OCR_SPACE_API_KEY;
    process.env.OCR_SPACE_ENGINE = "2";
    globalThis.fetch = async (_input, init) => {
      const body = init?.body as FormData;
      const engine = String(body.get("OCREngine"));
      engines.push(engine);
      return new Response(JSON.stringify({
        ParsedResults: [{ ParsedText: engine === "2" ? "" : ocrResumeText }],
        IsErroredOnProcessing: false,
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await runOcr(new File(["%PDF-test"], "resume.pdf", { type: "application/pdf" }));

    assert.equal(result.provider, "ocrspace");
    assert.equal(result.text, ocrResumeText);
    assert.deepEqual(engines, ["2", "1"]);
    assert.match(result.warnings.join(" "), /retried with engine 1/i);
  } finally {
    globalThis.fetch = originalFetch;
    setOrDelete("OCR_PROVIDER", originalEnv.provider);
    setOrDelete("OCR_API_URL", originalEnv.apiUrl);
    setOrDelete("OCR_API_KEY", originalEnv.apiKey);
    setOrDelete("OCR_SPACE_API_KEY", originalEnv.spaceKey);
    setOrDelete("OCR_SPACE_ENGINE", originalEnv.engine);
  }
});

test("OCR-style resume text is accepted and a non-resume document is rejected", () => {
  const profile = extractStructuredProfile(ocrResumeText);
  assert.doesNotThrow(() => validateResumeContent("scanned-resume.pdf", ocrResumeText, profile));
  assert.equal(parseCandidateName("1783794238143.pdf", ocrResumeText), "ALEX MORGAN");

  const invoiceText = [
    "INVOICE 1042",
    "Example Vendor LLC",
    "billing@example.com",
    "+1 555 234 9876",
    "Invoice date 2026",
    "Payment due within 30 days",
    "Consulting services $1,250",
    "Software subscription $500",
    "Amount due $1,750",
    "Thank you for your business. This invoice records products and services purchased by the customer and includes payment instructions, tax details, billing references, and account information.",
  ].join("\n");

  assert.throws(
    () => validateResumeContent("invoice.pdf", invoiceText),
    /does not look like a resume/i,
  );
});

test("a one-word OCR header is retained as the candidate name", () => {
  const singleNameResume = [
    "ALEX",
    "B.TECH ECE GRADUATE | FPGA DESIGN | EMBEDDED SYSTEMS | IOT",
    "alex@example.com",
    "PROFILE",
    "Embedded systems student with hands-on project experience.",
    "EDUCATION",
    "Senior Secondary (XII), CBSE",
  ].join("\n");

  assert.equal(parseCandidateName("1783794238143.pdf", singleNameResume), "ALEX");
});

function setOrDelete(name: string, value?: string) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
