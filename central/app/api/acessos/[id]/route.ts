import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getD1Binding } from "@/db";
import { ensureCurrentUserAccess } from "@/db/access";

export const dynamic = "force-dynamic";

type RequestRow = {
  id: number;
  account_user_id: string;
  email: string;
  nome: string | null;
  status: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Autenticação obrigatória." }, { status: 401 });
  const access = await ensureCurrentUserAccess(user);
  if (!access || access.papel !== "administrador") {
    return Response.json(
      { error: "Somente administradores podem aprovar novos acessos." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId < 1) {
    return Response.json({ error: "Solicitação inválida." }, { status: 400 });
  }

  let body: { action?: unknown; papel?: unknown; serie?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (body.action !== "aprovar" && body.action !== "negar") {
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  }

  const db = getD1Binding();
  const pending = await db
    .prepare(
      `SELECT id, account_user_id, email, nome, status
       FROM solicitacoes_acesso WHERE id = ? LIMIT 1`,
    )
    .bind(requestId)
    .first<RequestRow>();
  if (!pending || pending.status !== "pendente") {
    return Response.json(
      { error: "Essa solicitação já foi analisada ou não existe." },
      { status: 404 },
    );
  }
  if (pending.account_user_id === access.accountUserId) {
    return Response.json(
      { error: "Uma pessoa não pode aprovar o próprio acesso." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  if (body.action === "negar") {
    await db
      .prepare(
        `UPDATE solicitacoes_acesso
         SET status = 'negado', revisado_em = ?, revisado_por = ?
         WHERE id = ? AND status = 'pendente'`,
      )
      .bind(now, access.email, requestId)
      .run();
    return Response.json({ ok: true });
  }

  const papel = body.papel === "administrador"
    ? "administrador"
    : body.papel === "coordenador"
      ? "coordenador"
      : null;
  const serie = papel === "coordenador" && typeof body.serie === "string"
    ? body.serie.trim().slice(0, 20)
    : null;
  if (!papel || (papel === "coordenador" && !serie)) {
    return Response.json(
      { error: "Escolha Administrador ou uma divisão para o Coordenador." },
      { status: 400 },
    );
  }

  await db.batch([
    db
      .prepare(
        `INSERT INTO usuarios_acessos
         (account_user_id, email, nome, papel, serie, ativo)
         VALUES (?, ?, ?, ?, ?, 1)
         ON CONFLICT(email) DO UPDATE SET
           account_user_id = excluded.account_user_id,
           nome = COALESCE(excluded.nome, usuarios_acessos.nome),
           papel = excluded.papel,
           serie = excluded.serie,
           ativo = 1`,
      )
      .bind(
        pending.account_user_id,
        pending.email,
        pending.nome,
        papel,
        serie,
      ),
    db
      .prepare(
        `UPDATE solicitacoes_acesso
         SET status = 'aprovado', revisado_em = ?, revisado_por = ?
         WHERE id = ? AND status = 'pendente'`,
      )
      .bind(now, access.email, requestId),
  ]);
  return Response.json({ ok: true });
}
