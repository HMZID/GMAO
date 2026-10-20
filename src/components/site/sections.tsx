import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { parseRichText, type RichInline } from "@/server/domain/site";
import type { PublicSiteItem } from "@/server/services/site";

/** Titre de rubrique : repère numéroté en chasse fixe, titre condensé, chapeau facultatif. */
export function SectionHeading({
  index,
  label,
  title,
  text,
  dark = false,
  center = false,
}: {
  index: string;
  label: string;
  title: string;
  text?: string;
  dark?: boolean;
  center?: boolean;
}) {
  return (
    <div className={`max-w-3xl ${center ? "mx-auto text-center" : ""}`}>
      <p className={`site-label ${dark ? "text-signal" : "text-asphalt-500"}`}>
        [ {index} — {label} ]
      </p>
      <h2 className={`site-display mt-4 text-4xl sm:text-5xl lg:text-6xl ${dark ? "text-white" : ""}`}>{title}</h2>
      {text ? <p className={`mt-5 text-lg ${dark ? "text-white/70" : "text-asphalt-500"}`}>{text}</p> : null}
    </div>
  );
}

export function FaqList({ items }: { items: PublicSiteItem[] }) {
  return (
    <div className="divide-y-2 divide-asphalt border-y-2 border-asphalt">
      {items.map((q) => (
        <details key={q.id} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-bold [&::-webkit-details-marker]:hidden">
            {q.title}
            <Plus className="h-6 w-6 shrink-0 transition-transform group-open:rotate-45" aria-hidden />
          </summary>
          {q.body ? <p className="max-w-3xl pb-6 text-asphalt-500">{q.body}</p> : null}
        </details>
      ))}
    </div>
  );
}

/** Appel final : rayures de balisage, titre et bouton vers la demande d'essai. */
export function FinalCta({ title, text, cta }: { title: string; text: string; cta: string }) {
  return (
    <section className="bg-asphalt text-white">
      <div className="site-hazard h-3" aria-hidden />
      <div className="site-blueprint">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-8 px-4 py-20 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h2 className="site-display text-5xl sm:text-7xl">{title}</h2>
            <p className="mt-5 text-lg text-white/70">{text}</p>
          </div>
          <Link href="/essai-gratuit" className="site-btn site-btn-signal shrink-0 text-lg">
            {cta}
            <ArrowRight className="rtl-flip h-5 w-5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Inline({ parts }: { parts: RichInline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.href ? (
          <a key={i} href={p.href} className="font-semibold underline decoration-signal decoration-2 underline-offset-4 hover:bg-signal/30">
            {p.text}
          </a>
        ) : p.strong ? (
          <strong key={i}>{p.text}</strong>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/** Texte des pages libres, rendu en éléments React (jamais de HTML brut). */
export function RichText({ source }: { source: string }) {
  const blocks = parseRichText(source);
  return (
    <div className="space-y-5 text-lg leading-relaxed">
      {blocks.map((b, i): ReactNode => {
        switch (b.type) {
          case "h2":
            return (
              <h2 key={i} className="site-display pt-6 text-3xl">
                <Inline parts={b.content} />
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="pt-2 text-xl font-bold">
                <Inline parts={b.content} />
              </h3>
            );
          case "ul":
            return (
              <ul key={i} className="space-y-2 ps-1">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="mt-2.5 h-2 w-2 shrink-0 bg-signal ring-1 ring-asphalt" aria-hidden />
                    <span>
                      <Inline parts={item} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          default:
            return (
              <p key={i}>
                <Inline parts={b.content} />
              </p>
            );
        }
      })}
    </div>
  );
}
