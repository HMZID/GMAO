import "server-only";
import nodemailer from "nodemailer";

/**
 * Transport des courriels. `smtp` (défaut dès que SMTP_HOST est renseigné) : Office 365, Brevo, Amazon SES,
 * Mailpit en développement… `log` : aucun envoi, le message est écrit dans le journal du processus.
 */
export type OutgoingEmail = { to: string; subject: string; text: string; html: string };

export interface EmailTransport {
  readonly name: "smtp" | "log";
  send(message: OutgoingEmail): Promise<{ messageId: string | null }>;
}

const globalForMail = globalThis as unknown as { gmaoMailTransport?: EmailTransport };

export function mailFrom() {
  return process.env.MAIL_FROM || "GMAO <no-reply@gmao.local>";
}

export function getEmailTransport(): EmailTransport {
  if (globalForMail.gmaoMailTransport) return globalForMail.gmaoMailTransport;
  const kind = (process.env.EMAIL_TRANSPORT ?? (process.env.SMTP_HOST ? "smtp" : "log")).toLowerCase();
  if (kind === "smtp") {
    if (!process.env.SMTP_HOST) throw new Error("SMTP_HOST est obligatoire avec EMAIL_TRANSPORT=smtp.");
    const port = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // TLS implicite sur 465, STARTTLS sinon (exigé dès que le serveur le propose).
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      requireTLS: process.env.SMTP_REQUIRE_TLS === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
    globalForMail.gmaoMailTransport = {
      name: "smtp",
      async send(message) {
        const info = await transporter.sendMail({ from: mailFrom(), ...message });
        return { messageId: info.messageId ?? null };
      },
    };
  } else if (kind === "log") {
    globalForMail.gmaoMailTransport = {
      name: "log",
      async send(message) {
        console.info(`[courriel] ${message.to} — ${message.subject}`);
        return { messageId: null };
      },
    };
  } else {
    throw new Error(`EMAIL_TRANSPORT inconnu : ${kind} (attendu : smtp ou log).`);
  }
  return globalForMail.gmaoMailTransport;
}
