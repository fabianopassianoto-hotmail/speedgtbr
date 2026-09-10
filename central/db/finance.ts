import { getD1Binding } from "@/db";

export type CashEntry = {
  id: number;
  temporadaId: string;
  data: string;
  pilotoId: string | null;
  nome: string;
  tipo: string;
  valor: number;
  vaiParaMedalha: number;
  observacao: string | null;
};

type CashRow = {
  id: number;
  temporada_id: string;
  data: string;
  piloto_id: string | null;
  nome: string;
  tipo: string;
  valor: number;
  vai_para_medalha: number;
  observacao: string | null;
};

export async function getCashEntries(): Promise<CashEntry[]> {
  const db = getD1Binding();
  const result = await db
    .prepare(
      `SELECT id, temporada_id, data, piloto_id, nome, tipo, valor,
              vai_para_medalha, observacao
       FROM caixa
       ORDER BY data DESC, id DESC`,
    )
    .all<CashRow>();

  return result.results.map((row) => ({
    id: row.id,
    temporadaId: row.temporada_id,
    data: row.data,
    pilotoId: row.piloto_id,
    nome: row.nome,
    tipo: row.tipo,
    valor: Number(row.valor),
    vaiParaMedalha: Number(row.vai_para_medalha),
    observacao: row.observacao,
  }));
}
