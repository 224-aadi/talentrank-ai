import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TalentRankAI — Explainable AI Resume Screening",
  description: "Rank candidates with explainable AI. Upload job descriptions and resumes, get evidence-backed scores, blind review, and compliance guardrails.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
