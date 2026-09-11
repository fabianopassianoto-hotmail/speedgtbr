import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getD1Binding } from "@/db";
import { ensureCurrentUserAccess } from "@/db/access";

export const dynamic = "force-dynamic";

async function requireAdministrator() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Autenticação obrigatória." }, { status: 401 });
  const access = await ensureCurrentUserAccess(user);
  if (!access || access.papel !== "administrador") {
    return Response.json({ error: "Somente o administrador altera o Caixa." }, { status: 403 });
  }
  return null;
}

function optionalText(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function validIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

async function paymentStatus(temporadaId: string, pilotoId: string) {
  const db = getD1Binding();
  const [paid, enrollment] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(valor),0) AS total FROM caixa WHERE temporada_id=? AND piloto_id=?")
      .bind(temporadaId, pilotoId).first<{ total: number }>(),
    db.prepare("SELECT pagamento_isento FROM inscricoes WHERE temporada_id=? AND piloto_id=?")
      .bind(temporadaId, pilotoId).first<{ pagamento_isento: number }>(),
  ]);
  const totalPago = Number(paid?.total ?? 0);
  const isentoPagamento = Boolean(enrollment?.pagamento_isento);
  return {
    totalPago,
    isentoPagamento,
    inscricaoPendente: Boolean(enrollment) && !isentoPagamento && totalPago < 2_000,
  };
}

export async function POST(request: Request) {
  const denied = await requireAdministrator();
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const temporadaId = optionalText(body.temporadaId, 80);
  const pilotoId = optionalText(body.pilotoId, 20);
  const tipo = optionalText(body.tipo, 80) ?? "Pagamento";
  const observacao = optionalText(body.observacao, 500);
  const valor = Number(body.valor);
  if (!temporadaId) return Response.json({ error: "Selecione a temporada." }, { status: 400 });
  if (!validIsoDate(body.data)) return Response.json({ error: "Informe uma data válida." }, { status: 400 });
  if (!Number.isInteger(valor) || valor <= 0) {
    return Response.json({ error: "Informe um valor maior que zero." }, { status: 400 });
  }
  if (pilotoId && !/^SGT\d{3}$/.test(pilotoId)) {
    return Response.json({ error: "Piloto inválido." }, { status: 400 });
  }

  const db = getD1Binding();
  const season = await db.prepare("SELECT id FROM temporadas WHERE id=?").bind(temporadaId).first();
  if (!season) return Response.json({ error: "Temporada não encontrada." }, { status: 404 });

  let nome = optionalText(body.nome, 120);
  if (pilotoId) {
    const pilot = await db.prepare("SELECT apelido FROM pilotos WHERE id=?").bind(pilotoId).first<{ apelido: string }>();
    if (!pilot) return Response.json({ error: "Piloto não encontrado." }, { status: 404 });
    nome = pilot.apelido;
  }
  if (!nome) {
    return Response.json({ error: "Informe o nome do pagamento avulso." }, { status: 400 });
  }

  const inserted = await db.prepare(
    `INSERT INTO caixa (temporada_id,data,piloto_id,nome,tipo,valor,observacao)
     VALUES (?,?,?,?,?,?,?) RETURNING id`,
  ).bind(temporadaId, body.data, pilotoId, nome, tipo, valor, observacao).first<{ id: number }>();
  if (!inserted) return Response.json({ error: "Não foi possível cadastrar o pagamento." }, { status: 500 });

  return Response.json({
    entry: {
      id: inserted.id,
      temporadaId,
      data: body.data,
      pilotoId,
      nome,
      tipo,
      valor,
      vaiParaMedalha: Math.max(0, valor - 2_000),
      observacao,
    },
    status: pilotoId ? await paymentStatus(temporadaId, pilotoId) : null,
  });
}

export async function DELETE(request: Request) {
  const denied = await requireAdministrator();
  if (denied) return denied;

  let body: { pagamentoId?: unknown };
  try {
    body = (await request.json()) as { pagamentoId?: unknown };
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const pagamentoId = Number(body.pagamentoId);
  if (!Number.isInteger(pagamentoId) || pagamentoId <= 0) {
    return Response.json({ error: "Pagamento inválido." }, { status: 400 });
  }

  const db = getD1Binding();
  const entry = await db.prepare(
    "SELECT id,temporada_id,piloto_id FROM caixa WHERE id=?",
  ).bind(pagamentoId).first<{ id: number; temporada_id: string; piloto_id: string | null }>();
  if (!entry) return Response.json({ error: "Pagamento não encontrado." }, { status: 404 });

  await db.prepare("DELETE FROM caixa WHERE id=?").bind(pagamentoId).run();
  return Response.json({
    ok: true,
    temporadaId: entry.temporada_id,
    pilotoId: entry.piloto_id,
    status: entry.piloto_id ? await paymentStatus(entry.temporada_id, entry.piloto_id) : null,
  });
}
