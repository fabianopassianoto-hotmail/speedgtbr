import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getD1Binding } from "@/db";
import { ensureCurrentUserAccess } from "@/db/access";

export const dynamic = "force-dynamic";

type PaymentTotals = {
  total_pago: number;
  pagamento_isento: number;
};

async function requireAdministrator() {
  const user = await getChatGPTUser();
  if (!user) {
    return {
      response: Response.json(
        { error: "Autenticação obrigatória." },
        { status: 401 },
      ),
    };
  }

  const access = await ensureCurrentUserAccess(user);
  if (!access) {
    return {
      response: Response.json(
        { error: "Usuário sem acesso ativo." },
        { status: 403 },
      ),
    };
  }
  if (access.papel !== "administrador") {
    return {
      response: Response.json(
        { error: "Apenas o administrador registra pagamentos." },
        { status: 403 },
      ),
    };
  }

  return { response: null };
}

function validPilotId(id: string) {
  return /^SGT\d{3}$/.test(id);
}

function validIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

async function getPaymentTotals(pilotId: string) {
  const db = getD1Binding();
  const row = await db
    .prepare(
      `SELECT
         COALESCE(SUM(cx.valor), 0) AS total_pago,
         COALESCE(i.pagamento_isento, 0) AS pagamento_isento
       FROM inscricoes i
       LEFT JOIN caixa cx
         ON cx.temporada_id = i.temporada_id AND cx.piloto_id = i.piloto_id
       WHERE i.temporada_id = '2026' AND i.piloto_id = ?
       GROUP BY i.pagamento_isento`,
    )
    .bind(pilotId)
    .first<PaymentTotals>();
  const totalPago = Number(row?.total_pago ?? 0);
  const isentoPagamento = Boolean(row?.pagamento_isento);
  return {
    totalPago,
    isentoPagamento,
    inscricaoPendente: !isentoPagamento && totalPago < 2_000,
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await requireAdministrator();
  if (authorization.response) return authorization.response;

  const { id } = await context.params;
  if (!validPilotId(id)) {
    return Response.json({ error: "Piloto inválido." }, { status: 400 });
  }

  let body: { isento?: unknown };
  try {
    body = (await request.json()) as { isento?: unknown };
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (typeof body.isento !== "boolean") {
    return Response.json({ error: "Informe a situação da isenção." }, { status: 400 });
  }

  const db = getD1Binding();
  const updated = await db
    .prepare(
      `UPDATE inscricoes
       SET pagamento_isento = ?
       WHERE temporada_id = '2026' AND piloto_id = ?
       RETURNING piloto_id`,
    )
    .bind(body.isento ? 1 : 0, id)
    .first<{ piloto_id: string }>();
  if (!updated) {
    return Response.json(
      { error: "Piloto não inscrito em 2026." },
      { status: 404 },
    );
  }
  return Response.json(await getPaymentTotals(id));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await requireAdministrator();
  if (authorization.response) return authorization.response;

  const { id } = await context.params;
  if (!validPilotId(id)) {
    return Response.json({ error: "Piloto inválido." }, { status: 400 });
  }

  let body: { data?: unknown; valor?: unknown };
  try {
    body = (await request.json()) as { data?: unknown; valor?: unknown };
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  if (typeof body.data !== "string" || !validIsoDate(body.data)) {
    return Response.json({ error: "Informe uma data válida." }, { status: 400 });
  }
  if (!Number.isInteger(body.valor) || Number(body.valor) <= 0) {
    return Response.json(
      { error: "Informe um valor maior que zero." },
      { status: 400 },
    );
  }

  const db = getD1Binding();
  const pilot = await db
    .prepare(
      `SELECT p.apelido
       FROM pilotos p
       INNER JOIN inscricoes i
         ON i.piloto_id = p.id AND i.temporada_id = '2026'
       WHERE p.id = ?
       LIMIT 1`,
    )
    .bind(id)
    .first<{ apelido: string }>();

  if (!pilot) {
    return Response.json(
      { error: "Piloto não inscrito em 2026." },
      { status: 404 },
    );
  }

  const valor = Number(body.valor);
  const tipo = valor > 2_000 ? "Inscrição com doação" : "Inscrição";
  const inserted = await db
    .prepare(
      `INSERT INTO caixa
         (temporada_id, data, piloto_id, nome, tipo, valor, observacao)
       VALUES ('2026', ?, ?, ?, ?, ?, NULL)
       RETURNING id`,
    )
    .bind(body.data, id, pilot.apelido, tipo, valor)
    .first<{ id: number }>();

  if (!inserted) {
    return Response.json(
      { error: "Não foi possível registrar o pagamento." },
      { status: 500 },
    );
  }

  return Response.json({
    id: inserted.id,
    entry: {
      id: inserted.id,
      temporadaId: "2026",
      data: body.data,
      pilotoId: id,
      nome: pilot.apelido,
      tipo,
      valor,
      vaiParaMedalha: Math.max(0, valor - 2_000),
      observacao: null,
    },
    ...(await getPaymentTotals(id)),
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await requireAdministrator();
  if (authorization.response) return authorization.response;

  const { id } = await context.params;
  if (!validPilotId(id)) {
    return Response.json({ error: "Piloto inválido." }, { status: 400 });
  }

  let body: { pagamentoId?: unknown };
  try {
    body = (await request.json()) as { pagamentoId?: unknown };
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  if (!Number.isInteger(body.pagamentoId) || Number(body.pagamentoId) <= 0) {
    return Response.json({ error: "Pagamento inválido." }, { status: 400 });
  }

  const db = getD1Binding();
  const payment = await db
    .prepare(
      `SELECT id FROM caixa
       WHERE id = ? AND temporada_id = '2026' AND piloto_id = ?
       LIMIT 1`,
    )
    .bind(Number(body.pagamentoId), id)
    .first<{ id: number }>();

  if (!payment) {
    return Response.json({ error: "Pagamento não encontrado." }, { status: 404 });
  }

  await db.prepare("DELETE FROM caixa WHERE id = ?").bind(payment.id).run();
  return Response.json(await getPaymentTotals(id));
}
