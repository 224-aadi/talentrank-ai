import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TalentRank AI",
  description: "Explainable AI resume screening and ATS ranking for modern recruiting teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
