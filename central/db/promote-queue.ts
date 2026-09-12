import { getD1Binding } from "@/db";

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

export type QueuePromotionResult =
  | { ok: true; pilotId: string }
  | { ok: false; error: string; status: number };

export async function promoteQueueToCompetition({
  queueId,
  competitionId,
  divisionCode,
  situation = "ativo",
}: {
  queueId: string;
  competitionId: string;
  divisionCode: string;
  situation?: "ativo" | "suplente";
}): Promise<QueuePromotionResult> {
  if (!/^FIL\d{3}$/.test(queueId)) {
    return { ok: false, error: "Pessoa da fila inválida.", status: 400 };
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
         AND COALESCE(ativo, 1) <> 0
         AND arquivado_em IS NULL
       LIMIT 1`,
    )
    .bind(queueId)
    .first<QueueRow>();
  if (!queue) {
    return { ok: false, error: "Pessoa não encontrada na fila.", status: 404 };
  }

  const competition = await db
    .prepare(
      `SELECT COALESCE((SELECT limite_pilotos FROM divisoes WHERE temporada_id=t.id AND codigo=?),CASE WHEN t.id='2026' AND ? IN ('A','B') THEN 14 WHEN t.id='2026' AND ?='C' THEN 15 ELSE t.pilotos_por_serie END) AS limite
       FROM temporadas t
       WHERE t.id = ? AND t.status = 'ativa'
         AND (
           EXISTS (SELECT 1 FROM divisoes WHERE temporada_id = ? AND codigo = ? AND status <> 'cancelada')
           OR EXISTS (SELECT 1 FROM inscricoes WHERE temporada_id = ? AND serie = ?)
         )
       LIMIT 1`,
    )
    .bind(divisionCode, divisionCode, divisionCode, competitionId, competitionId, divisionCode, competitionId, divisionCode)
    .first<{ limite: number }>();
  if (!competition) {
    return { ok: false, error: "Competição ou divisão não encontrada ou cancelada.", status: 400 };
  }

  if (situation === "ativo") {
    const count = await db
      .prepare(
        `SELECT COUNT(*) AS total FROM inscricoes
         WHERE temporada_id = ? AND serie = ?
           AND COALESCE(situacao, 'ativo') = 'ativo'`,
      )
      .bind(competitionId, divisionCode)
      .first<{ total: number }>();
    if (Number(count?.total ?? 0) >= competition.limite) {
      return {
        ok: false,
        error: `A divisão já atingiu o limite de ${competition.limite} pilotos ativos.`,
        status: 409,
      };
    }
  }

  const maxId = await db
    .prepare(`SELECT COALESCE(MAX(CAST(SUBSTR(id, 4) AS INTEGER)), 0) AS maior FROM pilotos`)
    .first<{ maior: number }>();
  const nextNumber = Number(maxId?.maior ?? 0) + 1;
  if (nextNumber > 999) {
    return { ok: false, error: "O limite de identificadores de piloto foi atingido.", status: 409 };
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
         VALUES (?, ?, ?, ?)`,
      )
      .bind(competitionId, pilotId, divisionCode, situation),
    db
      .prepare("UPDATE fila SET promovido_para_piloto_id = ? WHERE id = ?")
      .bind(pilotId, queueId),
  ]);
  return { ok: true, pilotId };
}
