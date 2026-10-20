import type { Metadata, Viewport } from "next";
import { Noto_Sans_Arabic } from "next/font/google";
import { Suspense } from "react";
import { EnvironmentBanner } from "@/components/layout/environment-banner";
import { LOCALE_BOOTSTRAP_SCRIPT } from "@/i18n/config";
import { LocaleProvider } from "@/i18n/provider";
import { TitleTranslator } from "@/i18n/title-translator";
import { Tr } from "@/i18n/client";
import "./globals.css";

/** Police de l'arabe, appliquée seulement en mode droite à gauche (voir globals.css). */
const arabic = Noto_Sans_Arabic({ subsets: ["arabic"], variable: "--font-arabic", display: "swap" });

export const metadata: Metadata = {
  title: { default: "GMAO", template: "%s · GMAO" },
  description: "Gestion de maintenance des engins, véhicules et équipements",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e2841",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `lang` et `dir` sont ajustés avant l'affichage selon le cookie de langue (script de <head>) : d'où suppressHydrationWarning.
    <html lang="fr" dir="ltr" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LOCALE_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className={`min-h-full ${arabic.variable}`}>
        {/* La langue vient d'un cookie (donnée de requête) : lue sous <Suspense>, sans bloquer la coquille statique. */}
        <Suspense fallback={null}>
          <LocaleProvider>
            <TitleTranslator />
            <EnvironmentBanner />
            <Tr>{children}</Tr>
          </LocaleProvider>
        </Suspense>
      </body>
    </html>
  );
}
