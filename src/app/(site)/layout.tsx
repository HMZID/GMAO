import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { deploymentEnvironment } from "@/server/domain/deployment";
import { Tr } from "@/i18n/client";

const display = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-site-display", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-site-mono", display: "swap" });

/** Référencement en production seulement : l'environnement de développement et les postes locaux restent invisibles. */
const indexable = deploymentEnvironment(process.env.VERCEL_ENV) === "production";

export const metadata: Metadata = {
  robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
};

/** Site commercial : pages publiques, charte « chantier » distincte de l'application. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${mono.variable} site-focus min-h-screen bg-paper font-[family-name:var(--font-site-display)] text-asphalt`}>
      <Tr>{children}</Tr>
    </div>
  );
}
