import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getD1Binding } from "@/db";
import { ensureCurrentUserAccess } from "@/db/access";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Autenticação obrigatória." }, { status: 401 });
  const access = await ensureCurrentUserAccess(user);
  if (!access || access.papel !== "administrador") {
    return Response.json(
      { error: "Somente administradores gerenciam arquivamento e exclusão." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  if (!/^FIL\d{3}$/.test(id)) return bad("Pessoa da fila inválida.");
  let body: { action?: unknown; motivo?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return bad("Dados inválidos.");
  }

  const db = getD1Binding();
  const person = await db
    .prepare("SELECT id, promovido_para_piloto_id FROM fila WHERE id = ? LIMIT 1")
    .bind(id)
    .first<{ id: string; promovido_para_piloto_id: string | null }>();
  if (!person) return Response.json({ error: "Pessoa não encontrada na fila." }, { status: 404 });
  if (person.promovido_para_piloto_id) {
    return Response.json(
      { error: "Este cadastro já foi promovido. Gerencie a pessoa pelo cadastro de piloto." },
      { status: 409 },
    );
  }

  if (body.action === "arquivar") {
    const reason = typeof body.motivo === "string" ? body.motivo.trim().slice(0, 500) : "";
    if (!reason) return bad("Informe o motivo do arquivamento.");
    await db
      .prepare(
        `UPDATE fila SET ativo = 0, arquivado_em = ?, motivo_arquivamento = ?
         WHERE id = ?`,
      )
      .bind(new Date().toISOString(), reason, id)
      .run();
    return Response.json({ ok: true });
  }

  if (body.action === "reativar") {
    await db
      .prepare(
        `UPDATE fila SET ativo = 1, arquivado_em = NULL, motivo_arquivamento = NULL
         WHERE id = ?`,
      )
      .bind(id)
      .run();
    return Response.json({ ok: true });
  }

  if (body.action === "apagar") {
    await db.prepare("DELETE FROM fila WHERE id = ?").bind(id).run();
    return Response.json({ ok: true });
  }

  return bad("Ação inválida.");
}

function bad(error: string) {
  return Response.json({ error }, { status: 400 });
}
