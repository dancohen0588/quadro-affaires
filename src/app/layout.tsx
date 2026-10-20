import type { Metadata } from "next";
import "./globals.css";
import { fontReference, fontTexte, fontTitre } from "./fonts";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { default: "Quadro Affaires", template: "%s · Quadro Affaires" },
  description: "Suivi des affaires des showrooms Quadro.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={cn(fontTitre.variable, fontTexte.variable, fontReference.variable)}>
      <body>{children}</body>
    </html>
  );
}
