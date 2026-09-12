import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getD1Binding } from "@/db";
import { ensureCurrentUserAccess } from "@/db/access";

export const dynamic = "force-dynamic";

type QueueRow = {
  id: string;
  apelido: string;
  nome_completo: string | null;
  psn: string | null;
  simgrid: string | null;
  simgrid_url: string | null;
  whatsapp: string | null;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  cep: string | null;
  complemento: string | null;
  classificacao_gt7: string | null;
  volante_ou_controle: string | null;
  perfil_pilotagem: string | null;
  disponibilidade: string | null;
  carro_preferido: string | null;
  pista_citada: string | null;
  relacoes: string | null;
  curiosidade: string | null;
  observacoes_adm: string | null;
  ativo: number | null;
  cadastro_status: string | null;
  data_nascimento: string | null;
  data_entrada: string | null;
};

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
      { error: "Apenas o administrador promove pessoas da fila." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  if (!/^FIL\d{3}$/.test(id)) {
    return Response.json({ error: "Pessoa da fila inválida." }, { status: 400 });
  }
  let body: { serie?: unknown; situacao?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (body.serie !== "A" && body.serie !== "B" && body.serie !== "C") {
    return Response.json({ error: "Série inválida." }, { status: 400 });
  }
  if (body.situacao !== "ativo" && body.situacao !== "suplente") {
    return Response.json({ error: "Situação inválida." }, { status: 400 });
  }

  const db = getD1Binding();
  const queue = await db
    .prepare(
      `SELECT id, apelido, nome_completo, psn, simgrid, simgrid_url,
              whatsapp, email, cidade, uf, rua, numero, bairro, cep, complemento, classificacao_gt7, volante_ou_controle,
              perfil_pilotagem, disponibilidade, carro_preferido,
              pista_citada, relacoes, curiosidade, observacoes_adm, ativo,
              cadastro_status, data_nascimento, data_entrada
       FROM fila
       WHERE id = ? AND promovido_para_piloto_id IS NULL
         AND arquivado_em IS NULL
       LIMIT 1`,
    )
    .bind(id)
    .first<QueueRow>();
  if (!queue) {
    return Response.json({ error: "Pessoa não encontrada na fila." }, { status: 404 });
  }

  if (body.situacao === "ativo") {
    const limitRow = await db
      .prepare(
          `SELECT COALESCE(d.limite_pilotos, CASE WHEN t.id='2026' AND ? IN ('A','B') THEN 14 WHEN t.id='2026' AND ?='C' THEN 15 ELSE t.pilotos_por_serie END) AS limite
         FROM temporadas t LEFT JOIN divisoes d
           ON d.temporada_id = t.id AND d.codigo = ?
         WHERE t.id = '2026'`,
      )
      .bind(body.serie, body.serie, body.serie)
      .first<{ limite: number }>();
    const activeCount = await db
      .prepare(
        `SELECT COUNT(*) AS total FROM inscricoes
         WHERE temporada_id = '2026' AND serie = ?
           AND COALESCE(situacao, 'ativo') = 'ativo'`,
      )
      .bind(body.serie)
      .first<{ total: number }>();
    const limit = Number(limitRow?.limite ?? 15);
    if (Number(activeCount?.total ?? 0) >= limit) {
      return Response.json(
        { error: `A Série ${body.serie} já atingiu o limite de ${limit} pilotos ativos. Marque quem saiu primeiro ou promova como suplente.` },
        { status: 409 },
      );
    }
  }

  const maxId = await db
    .prepare(
      `SELECT COALESCE(MAX(CAST(SUBSTR(id, 4) AS INTEGER)), 0) AS maior
       FROM pilotos`,
    )
    .first<{ maior: number }>();
  const nextNumber = Number(maxId?.maior ?? 0) + 1;
  if (nextNumber > 999) {
    return Response.json(
      { error: "O limite de identificadores de piloto foi atingido." },
      { status: 409 },
    );
  }
  const pilotId = `SGT${String(nextNumber).padStart(3, "0")}`;

  await db.batch([
    db
      .prepare(
        `INSERT INTO pilotos (
           id, apelido, nome_completo, psn, simgrid, simgrid_url, whatsapp,
           email, cidade, uf, rua, numero, bairro, cep, complemento, classificacao_gt7, volante_ou_controle, perfil_pilotagem,
           disponibilidade, carro_preferido, pista_citada, relacoes,
           curiosidade, observacoes_adm, ativo, cadastro_status,
           data_nascimento, data_entrada
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        pilotId,
        queue.apelido,
        queue.nome_completo,
        queue.psn,
        queue.simgrid,
        queue.simgrid_url,
        queue.whatsapp,
        queue.email,
        queue.cidade,
        queue.uf,
        queue.rua,
        queue.numero,
        queue.bairro,
        queue.cep,
        queue.complemento,
        queue.classificacao_gt7,
        queue.volante_ou_controle,
        queue.perfil_pilotagem,
        queue.disponibilidade,
        queue.carro_preferido,
        queue.pista_citada,
        queue.relacoes,
        queue.curiosidade,
        queue.observacoes_adm,
        queue.ativo,
        queue.cadastro_status,
        queue.data_nascimento,
        queue.data_entrada ?? new Date().toISOString().slice(0, 10),
      ),
    db
      .prepare(
        `INSERT INTO inscricoes (temporada_id, piloto_id, serie, situacao)
         VALUES ('2026', ?, ?, ?)`,
      )
      .bind(pilotId, body.serie, body.situacao),
    db
      .prepare(
        "UPDATE fila SET promovido_para_piloto_id = ? WHERE id = ?",
      )
      .bind(pilotId, id),
  ]);

  return Response.json({ ok: true, pilotoId: pilotId });
}
