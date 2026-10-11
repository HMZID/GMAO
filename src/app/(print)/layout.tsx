/**
 * États imprimables (fiche d'intervention…) : sans menu ni en-tête de l'application.
 * À l'écran, la page A4 est posée sur un fond gris ; à l'impression, seule la page sort.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">{children}</div>;
}
