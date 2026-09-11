import { getD1Binding } from "@/db";
import { sendRegistrationEmail } from "@/lib/registration-email";
export async function POST(request: Request) {
  let key: unknown;
  try { key = (await request.json())?.submissionId; } catch { /* handled below */ }
  if (typeof key !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(key)) return Response.json({ error: "Solicitação inválida." }, { status: 400 });
  try {
    const emailStatus = await sendRegistrationEmail(getD1Binding(), key);
    const error = emailStatus === "expired" ? "O prazo de reenvio terminou. Procure a administração pelo WhatsApp." : undefined;
    return Response.json({ emailStatus, error }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ emailStatus: "failed", error: "Não foi possível reenviar agora. Seu cadastro continua salvo." }, { status: 503 }); }
}
