import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getD1Binding } from "@/db";
import { ensureCurrentUserAccess } from "@/db/access";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Autenticação obrigatória." }, { status: 401 });
  }

  const access = await ensureCurrentUserAccess(user);
  if (!access || access.papel !== "administrador") {
    return Response.json(
      { error: "Somente o administrador gerencia o arquivamento." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  if (!/^SGT\d{3}$/.test(id)) return badRequest("Piloto inválido.");

  let body: { action?: unknown; motivo?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Dados inválidos.");
  }

  const db = getD1Binding();
  const pilot = await db
    .prepare("SELECT id FROM pilotos WHERE id = ?")
    .bind(id)
    .first<{ id: string }>();
  if (!pilot) {
    return Response.json({ error: "Piloto não encontrado." }, { status: 404 });
  }

  if (body.action === "arquivar") {
    const motivo =
      typeof body.motivo === "string" ? body.motivo.trim().slice(0, 500) : "";
    if (!motivo) return badRequest("Informe o motivo do arquivamento.");

    await db
      .prepare(
        `UPDATE pilotos
         SET ativo = 0, arquivado_em = ?, motivo_arquivamento = ?
         WHERE id = ?`,
      )
      .bind(new Date().toISOString(), motivo, id)
      .run();
    return Response.json({ ok: true });
  }

  if (body.action === "reativar") {
    await db
      .prepare(
        `UPDATE pilotos
         SET ativo = 1, arquivado_em = NULL, motivo_arquivamento = NULL
         WHERE id = ?`,
      )
      .bind(id)
      .run();
    return Response.json({ ok: true });
  }

  if (body.action === "apagar") {
    const history = await db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM corridas WHERE piloto_id = ?) +
           (SELECT COUNT(*) FROM caixa WHERE piloto_id = ?) AS total`,
      )
      .bind(id, id)
      .first<{ total: number }>();

    if (Number(history?.total ?? 0) > 0) {
      return Response.json(
        {
          error:
            "Este piloto possui corrida ou pagamento. Arquive-o para preservar o histórico.",
        },
        { status: 409 },
      );
    }

    await db.batch([
      db.prepare("DELETE FROM fila WHERE promovido_para_piloto_id = ?").bind(id),
      db.prepare("DELETE FROM inscricoes WHERE piloto_id = ?").bind(id),
      db.prepare("DELETE FROM pilotos WHERE id = ?").bind(id),
    ]);
    return Response.json({ ok: true });
  }

  return badRequest("Ação inválida.");
}

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}
