import { getD1Binding } from "@/db";
import { registrationFields, validateRegistration } from "@/lib/registration";
import { sendRegistrationEmail } from "@/lib/registration-email";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
  } catch { return Response.json({ error: "Dados inválidos." }, { status: 400 }); }
  if (body.empresa) return Response.json({ error: "Não foi possível enviar o cadastro." }, { status: 400 });
  if (body.privacyAccepted !== true) return Response.json({ error: "Confirme a leitura do aviso de privacidade." }, { status: 400 });
  const key = body.submissionId;
  if (typeof key !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(key)) return Response.json({ error: "Reabra o formulário e tente novamente." }, { status: 400 });
  const values = Object.fromEntries(registrationFields.map(name => [name, typeof body[name] === "string" ? body[name].trim() : ""]));
  values.uf = values.uf.toUpperCase();
  const error = validateRegistration(values);
  if (error) return Response.json({ error }, { status: 400 });
  const payloadHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(values)))), b => b.toString(16).padStart(2, "0")).join("");
  const db = getD1Binding();
  try {
    const existing = await db.prepare("SELECT payload_hash FROM formularios_pendentes WHERE submission_key = ?").bind(key).first<{ payload_hash: string }>();
    if (existing && existing.payload_hash !== payloadHash) return Response.json({ error: "Este envio já foi recebido com outros dados. Procure a administração para corrigir." }, { status: 409 });
    if (!existing) {
      const phone = values.whatsapp.replace(/\D/g, "");
      const pending = await db.prepare("SELECT whatsapp FROM formularios_pendentes WHERE status = 'pendente'").all<{ whatsapp: string }>();
      if (pending.results.some((row: { whatsapp: string }) => row.whatsapp.replace(/\D/g, "") === phone)) return Response.json({ error: "Já existe um formulário pendente para este WhatsApp." }, { status: 409 });
      await db.prepare(`INSERT INTO formularios_pendentes (
        criado_em, nome_completo, whatsapp, email, psn, cidade, uf,
        rua, numero, bairro, cep, complemento, classificacao_gt7,
        submission_key, payload_hash, phone_normalized, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')
      ON CONFLICT(submission_key) DO NOTHING`).bind(
        new Date().toISOString(), values.nomeCompleto, values.whatsapp, values.email, values.psn, values.cidade, values.uf,
        values.rua || null, values.numero || null, values.bairro || null, values.cep || null, values.complemento || null, values.classificacaoGt7,
        key, payloadHash, phone,
      ).run();
      const saved = await db.prepare("SELECT payload_hash FROM formularios_pendentes WHERE submission_key = ?").bind(key).first<{ payload_hash: string }>();
      if (saved?.payload_hash !== payloadHash) return Response.json({ error: "Este envio já foi recebido com outros dados." }, { status: 409 });
    }
  } catch {
    return Response.json({ error: "Não foi possível salvar. Verifique se já existe cadastro pendente para seu telefone e tente novamente." }, { status: 503 });
  }
  // Failure to deliver email never invalidates the saved registration.
  let emailStatus = "failed";
  try { emailStatus = await sendRegistrationEmail(db, key); } catch { /* Registration remains saved. */ }
  return Response.json({ ok: true, emailStatus }, { headers: { "Cache-Control": "no-store" } });
}
