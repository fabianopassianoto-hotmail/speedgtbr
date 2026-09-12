import type { getD1Binding } from "@/db";
import { env } from "cloudflare:workers";
import { welcomeEmailText } from "./registration";
type MailEnvironment = { RESEND_API_KEY?: string; REGISTRATION_EMAIL_FROM?: string; REGISTRATION_EMAIL_REPLY_TO?: string };
export async function sendRegistrationEmail(db: ReturnType<typeof getD1Binding>, key: string): Promise<string> {
  const row = await db.prepare("SELECT id, nome_completo, email, email_status, criado_em FROM formularios_pendentes WHERE submission_key = ?")
    .bind(key).first<{ id: number; nome_completo: string; email: string; email_status: string; criado_em: string }>();
  if (!row) return "missing";
  if (row.email_status === "sent") return "sent";
  // Retries stay within the provider's 24-hour idempotency window.
  if (Date.now() - Date.parse(row.criado_em) > 23 * 60 * 60 * 1000) return "expired";
  const config = env as unknown as MailEnvironment;
  if (!config.RESEND_API_KEY || !config.REGISTRATION_EMAIL_FROM) return "unavailable";
  const now = Date.now();
  const claim = await db.prepare(`UPDATE formularios_pendentes SET email_attempt_at = ?, email_status = 'sending'
    WHERE submission_key = ? AND email_status <> 'sent' AND (email_attempt_at IS NULL OR email_attempt_at < ?)`)
    .bind(now, key, now - 60_000).run();
  if (!claim.meta.changes) return "pending";
  let status = "failed";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `registration-${key}` },
      body: JSON.stringify({ from: config.REGISTRATION_EMAIL_FROM, to: [row.email], reply_to: config.REGISTRATION_EMAIL_REPLY_TO || "speedgtbr@gmail.com", subject: "Seu cadastro na Speed GT Brasil: próximos passos", text: welcomeEmailText(row.nome_completo) }),
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) status = "sent";
  } catch { /* Never log credentials or personal data. */ }
  await db.prepare("UPDATE formularios_pendentes SET email_status = ? WHERE submission_key = ? AND email_attempt_at = ?").bind(status, key, now).run();
  return status;
}
