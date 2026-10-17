"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

type TurnstileApi = {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Cloudflare Turnstile (CAPTCHA, souvent sans interaction). Le jeton est posé dans le champ caché
 * « cf-turnstile-response » du formulaire et vérifié par le serveur ; à usage unique, il est renouvelé
 * après chaque envoi du formulaire.
 */
export function Turnstile({ siteKey, action }: { siteKey: string; action: string }) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || widget.current || !window.turnstile) return false;
      widget.current = window.turnstile.render(element, { sitekey: siteKey, action, language: "fr", appearance: "interaction-only" });
      return true;
    };
    // Le script peut se charger avant ou après le composant (navigation entre pages).
    const timer = render() ? null : window.setInterval(() => render() && timer && window.clearInterval(timer), 200);
    const form = element.closest("form");
    const renew = () => window.setTimeout(() => widget.current && window.turnstile?.reset(widget.current), 0);
    form?.addEventListener("submit", renew);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      form?.removeEventListener("submit", renew);
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey, action]);

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      <div ref={container} className="flex justify-center" />
    </>
  );
}
