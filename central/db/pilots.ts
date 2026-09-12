import {currentSeasonId} from "@/db/current-season";
import { getD1Binding } from "@/db";

export type Serie = "A" | "B" | "C";
export type CadastroStatus = "completo" | "incompleto" | null;

export type PersonFields = {
  apelido: string;
  nomeCompleto: string | null;
  psn: string | null;
  simgrid: string | null;
  simgridUrl: string | null;
  whatsapp: string | null;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  volanteOuControle: string | null;
  perfilPilotagem: string | null;
  disponibilidade: string | null;
  carroPreferido: string | null;
  pistaCitada: string | null;
  relacoes: string | null;
  curiosidade: string | null;
  observacoesAdm: string | null;
  ativo: boolean | null;
  cadastroStatus: CadastroStatus;
  dataNascimento: string | null;
  dataEntrada: string | null;
};

export type PilotListItem = PersonFields & {
  kind: "piloto";
  id: string;
  serie: Serie | null;
  situacao: "ativo" | "suplente" | "inativo" | "saiu" | null;
  saidaEm: string | null;
  motivoSaida: string | null;
  previsaoVolta: string | null;
  totalPago: number;
  isentoPagamento: boolean;
  inscricaoPendente: boolean;
  arquivadoEm: string | null;
  motivoArquivamento: string | null;
};

export type QueueListItem = PersonFields & {
  kind: "fila";
  id: string;
  arquivadoEm: string | null;
  motivoArquivamento: string | null;
  corridas4fun: number | null;
  conduta: string | null;
  prontoParaSerie: boolean | null;
};

export type PendingFormListItem = {
  kind: "formulario";
  id: string;
  formularioId: number;
  apelido: string;
  nomeCompleto: string;
  psn: string | null;
  simgrid: string | null;
  simgridUrl: string | null;
  whatsapp: string;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  volanteOuControle: string | null;
  perfilPilotagem: string | null;
  disponibilidade: string | null;
  carroPreferido: string | null;
  pistaCitada: string | null;
  dataNascimento: string | null;
  curiosidade: string | null;
  criadoEm: string;
};

export type MonthlyFormStats = {
  total: number;
  pending: number;
  applied: number;
  discarded: number;
};

type PilotRow = Omit<
  PilotListItem,
  | "kind"
  | "nomeCompleto"
  | "simgridUrl"
  | "volanteOuControle"
  | "perfilPilotagem"
  | "carroPreferido"
  | "pistaCitada"
  | "observacoesAdm"
  | "totalPago"
  | "isentoPagamento"
  | "inscricaoPendente"
  | "cadastroStatus"
  | "ativo"
  | "saidaEm"
  | "motivoSaida"
  | "previsaoVolta"
  | "dataNascimento"
  | "dataEntrada"
  | "arquivadoEm"
  | "motivoArquivamento"
> & {
  nome_completo: string | null;
  simgrid_url: string | null;
  volante_ou_controle: string | null;
  perfil_pilotagem: string | null;
  carro_preferido: string | null;
  pista_citada: string | null;
  observacoes_adm: string | null;
  total_pago: number;
  pagamento_isento: number | null;
  cadastro_status: CadastroStatus;
  ativo: number | null;
  saida_em: string | null;
  motivo_saida: string | null;
  previsao_volta: string | null;
  data_nascimento: string | null;
  data_entrada: string | null;
  arquivado_em: string | null;
  motivo_arquivamento: string | null;
};

type QueueRow = Omit<
  QueueListItem,
  | "kind"
  | "nomeCompleto"
  | "simgridUrl"
  | "volanteOuControle"
  | "perfilPilotagem"
  | "carroPreferido"
  | "pistaCitada"
  | "observacoesAdm"
  | "cadastroStatus"
  | "corridas4fun"
  | "prontoParaSerie"
  | "ativo"
  | "dataNascimento"
  | "dataEntrada"
  | "arquivadoEm"
  | "motivoArquivamento"
> & {
  nome_completo: string | null;
  simgrid_url: string | null;
  volante_ou_controle: string | null;
  perfil_pilotagem: string | null;
  carro_preferido: string | null;
  pista_citada: string | null;
  observacoes_adm: string | null;
  cadastro_status: CadastroStatus;
  corridas_4fun: number | null;
  pronto_para_serie: number | null;
  ativo: number | null;
  data_nascimento: string | null;
  data_entrada: string | null;
  arquivado_em: string | null;
  motivo_arquivamento: string | null;
};

type PendingFormRow = {
  id: number;
  criado_em: string;
  nome_completo: string;
  psn: string | null;
  simgrid: string | null;
  simgrid_url: string | null;
  whatsapp: string;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  volante_ou_controle: string | null;
  perfil_pilotagem: string | null;
  disponibilidade: string | null;
  carro_preferido: string | null;
  pista_citada: string | null;
  data_nascimento: string | null;
  curiosidade: string | null;
};

export async function getPilotsScreenData(temporadaId?: string) {
  temporadaId ??= await currentSeasonId();
  const db = getD1Binding();
  const currentMonth = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  const [pilotsResult, queueResult, racesResult, formsResult, formStatsResult] = await Promise.all([
    db
      .prepare(
        `SELECT
           p.id, p.apelido, p.nome_completo, p.psn, p.simgrid,
           p.simgrid_url, p.whatsapp, p.email, p.cidade, p.uf,
           p.volante_ou_controle, p.perfil_pilotagem, p.disponibilidade,
           p.carro_preferido, p.pista_citada, p.relacoes, p.curiosidade,
           p.observacoes_adm, p.ativo, p.cadastro_status, p.data_nascimento,
           p.data_entrada, p.arquivado_em, p.motivo_arquivamento,
           i.serie, i.situacao, i.pagamento_isento,
           i.saida_em, i.motivo_saida, i.previsao_volta,
           COALESCE(SUM(cx.valor), 0) AS total_pago
         FROM pilotos p
         LEFT JOIN inscricoes i
           ON i.piloto_id = p.id AND i.temporada_id = ?
         LEFT JOIN caixa cx
           ON cx.piloto_id = p.id AND cx.temporada_id = ?
         GROUP BY p.id, i.serie, i.situacao, i.pagamento_isento, i.saida_em, i.motivo_saida,
                  i.previsao_volta
         ORDER BY
           CASE i.serie WHEN 'A' THEN 1 WHEN 'B' THEN 2 ELSE 3 END,
           p.apelido COLLATE NOCASE`,
      )
      .bind(temporadaId, temporadaId)
      .all<PilotRow>(),
    db
      .prepare(
        `SELECT id, apelido, nome_completo, psn, simgrid, simgrid_url,
                whatsapp, cidade, uf, email, volante_ou_controle,
                perfil_pilotagem, disponibilidade, carro_preferido,
                pista_citada, relacoes, curiosidade, observacoes_adm, ativo,
                cadastro_status, data_nascimento, data_entrada,
                arquivado_em, motivo_arquivamento,
                corridas_4fun, conduta, pronto_para_serie
         FROM fila
         WHERE promovido_para_piloto_id IS NULL
         ORDER BY apelido COLLATE NOCASE`,
      )
      .all<QueueRow>(),
    db
      .prepare(
        "SELECT COUNT(*) AS total FROM corridas WHERE temporada_id = ?",
      )
      .bind(temporadaId)
      .first<{ total: number }>(),
    db
      .prepare(
        `SELECT id, criado_em, nome_completo, psn, simgrid, simgrid_url,
                whatsapp, email, cidade, uf, volante_ou_controle,
                perfil_pilotagem, disponibilidade, carro_preferido, pista_citada,
                data_nascimento, curiosidade
         FROM formularios_pendentes
         WHERE status = 'pendente'
         ORDER BY criado_em DESC`,
      )
      .all<PendingFormRow>(),
    db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN status = 'aplicado' THEN 1 ELSE 0 END) AS applied,
           SUM(CASE WHEN status = 'descartado' THEN 1 ELSE 0 END) AS discarded
         FROM formularios_pendentes
         WHERE SUBSTR(criado_em, 1, 7) = ?`,
      )
      .bind(currentMonth)
      .first<{ total: number; pending: number; applied: number; discarded: number }>(),
  ]);

  const pilotos: PilotListItem[] = pilotsResult.results.map((row) => ({
    kind: "piloto",
    id: row.id,
    apelido: row.apelido,
    nomeCompleto: row.nome_completo,
    psn: row.psn,
    simgrid: row.simgrid,
    simgridUrl: row.simgrid_url,
    whatsapp: row.whatsapp,
    email: row.email,
    cidade: row.cidade,
    uf: row.uf,
    volanteOuControle: row.volante_ou_controle,
    perfilPilotagem: row.perfil_pilotagem,
    disponibilidade: row.disponibilidade,
    carroPreferido: row.carro_preferido,
    pistaCitada: row.pista_citada,
    relacoes: row.relacoes,
    curiosidade: row.curiosidade,
    observacoesAdm: row.observacoes_adm,
    ativo: row.ativo === null ? null : Boolean(row.ativo),
    cadastroStatus: row.cadastro_status,
    dataNascimento: row.data_nascimento,
    dataEntrada: row.data_entrada,
    serie: row.serie,
    situacao: row.situacao,
    saidaEm: row.saida_em,
    motivoSaida: row.motivo_saida,
    previsaoVolta: row.previsao_volta,
    totalPago: Number(row.total_pago),
    isentoPagamento: Boolean(row.pagamento_isento),
    inscricaoPendente:
      Boolean(row.serie) &&
      !Boolean(row.pagamento_isento) &&
      Number(row.total_pago) < 2_000,
    arquivadoEm: row.arquivado_em,
    motivoArquivamento: row.motivo_arquivamento,
  }));

  const fila: QueueListItem[] = queueResult.results.map((row) => ({
    kind: "fila",
    id: row.id,
    apelido: row.apelido,
    nomeCompleto: row.nome_completo,
    psn: row.psn,
    simgrid: row.simgrid,
    simgridUrl: row.simgrid_url,
    whatsapp: row.whatsapp,
    cidade: row.cidade,
    uf: row.uf,
    email: row.email,
    volanteOuControle: row.volante_ou_controle,
    perfilPilotagem: row.perfil_pilotagem,
    disponibilidade: row.disponibilidade,
    carroPreferido: row.carro_preferido,
    pistaCitada: row.pista_citada,
    relacoes: row.relacoes,
    curiosidade: row.curiosidade,
    observacoesAdm: row.observacoes_adm,
    ativo: row.ativo === null ? null : Boolean(row.ativo),
    cadastroStatus: row.cadastro_status,
    dataNascimento: row.data_nascimento,
    dataEntrada: row.data_entrada,
    arquivadoEm: row.arquivado_em,
    motivoArquivamento: row.motivo_arquivamento,
    corridas4fun: row.corridas_4fun,
    conduta: row.conduta,
    prontoParaSerie:
      row.pronto_para_serie === null ? null : Boolean(row.pronto_para_serie),
  }));

  const formularios: PendingFormListItem[] = formsResult.results.map((row) => ({
    kind: "formulario",
    id: `FORM-${row.id}`,
    formularioId: row.id,
    apelido: row.nome_completo,
    nomeCompleto: row.nome_completo,
    psn: row.psn,
    simgrid: row.simgrid,
    simgridUrl: row.simgrid_url,
    whatsapp: row.whatsapp,
    email: row.email,
    cidade: row.cidade,
    uf: row.uf,
    volanteOuControle: row.volante_ou_controle,
    perfilPilotagem: row.perfil_pilotagem,
    disponibilidade: row.disponibilidade,
    carroPreferido: row.carro_preferido,
    pistaCitada: row.pista_citada,
    dataNascimento: row.data_nascimento,
    curiosidade: row.curiosidade,
    criadoEm: row.criado_em,
  }));

  return {
    pilotos,
    fila,
    formularios,
    formStats: {
      total: Number(formStatsResult?.total ?? 0),
      pending: Number(formStatsResult?.pending ?? 0),
      applied: Number(formStatsResult?.applied ?? 0),
      discarded: Number(formStatsResult?.discarded ?? 0),
    } satisfies MonthlyFormStats,
    campeonatoIniciado: Number(racesResult?.total ?? 0) > 0,
  };
}
