import { getD1Binding } from "@/db";
import {
  defaultDivisionGroupUrl,
  GENERAL_WHATSAPP_GROUP_URL,
} from "@/lib/whatsapp-groups";

export type CarRule = "regulamento" | "piloto" | "misto";
export type RaceCompetition = {
  id: string; nome: string; ativa: boolean; tipoEvento: "campeonato" | "4fun";
  geraClassificacao: boolean; totalEtapas: number; pilotosPorSerie: number; regraCarro: CarRule | null;
  carroPadrao: string | null; fabricantePadrao: string | null;
  status: "ativa" | "arquivada" | "cancelada"; arquivadaEm: string | null;
  motivoArquivamento: string | null; whatsappGroupUrl: string | null;
};
export type RaceDivision = {
  abertoSuplentes: boolean;
  temporadaId: string; codigo: string; nome: string; cor: string | null; ordem: number;
  limitePilotos: number | null; dataInicio: string | null; frequenciaDias: number;
  regraCarro: CarRule | null; carroPadrao: string | null; fabricantePadrao: string | null;
  status: "ativa" | "arquivada" | "cancelada"; arquivadaEm: string | null;
  motivoArquivamento: string | null; whatsappGroupUrl: string | null;
};
export type RaceStage = {
  temporadaId: string; etapa: number; pista: string; classeOuFormato: string | null;
  duracao: string | null; data: string | null; multiplicador: number; observacao: string | null;
  regraCarro: CarRule | null; carroPadrao: string | null; fabricantePadrao: string | null;
};
export type RacePilot = {
  id: string; apelido: string; simgrid: string | null; temporadaId: string; serie: string;
  situacao: "ativo" | "suplente" | "inativo" | "saiu" | null;
  pilotoArquivado: boolean;
};
export type RaceResult = {
  suplente: boolean; pontosSuplente: number | null;
  temporadaId: string; etapa: number; pilotoId: string; confirmou: boolean | null;
  compareceu: boolean | null; faltaJustificada: boolean | null; posicaoFinal: number | null;
  voltaMaisRapida: boolean; punicao: string | null; abandonoMotivo: string | null;
  observacao: string | null; pontos: number; carro: string | null; fabricante: string | null;
  origemCarro: "regulamento" | "piloto" | null;
};
export type AvailableRacePilot = {
  id: string;
  apelido: string;
  simgrid: string | null;
  kind: "piloto" | "fila";
};

const fallbackColors: Record<string, string> = { A: "#F0B429", B: "#5AA9E6", C: "#E8604C" };

export async function getRaceEntryData() {
  const db = getD1Binding();
  const [competitions, explicitDivisions, enrolledDivisions, stages, pilots, results, available] = await Promise.all([
    db.prepare(`SELECT id,nome,ativa,total_etapas,tipo_evento,gera_classificacao,pilotos_por_serie,regra_carro,carro_padrao,fabricante_padrao,status,arquivada_em,motivo_arquivamento,whatsapp_group_url FROM temporadas ORDER BY CASE status WHEN 'ativa' THEN 1 WHEN 'arquivada' THEN 2 ELSE 3 END,id DESC`).all<any>(),
    db.prepare(`SELECT temporada_id,codigo,nome,cor,ordem,aberto_suplentes,limite_pilotos,data_inicio,frequencia_dias,regra_carro,carro_padrao,fabricante_padrao,status,arquivada_em,motivo_arquivamento,whatsapp_group_url FROM divisoes ORDER BY temporada_id,ordem,nome`).all<any>(),
    db.prepare(`SELECT DISTINCT temporada_id,serie FROM inscricoes ORDER BY temporada_id,serie`).all<any>(),
    db.prepare(`SELECT temporada_id,etapa,pista,classe_ou_formato,duracao,data,multiplicador,observacao,regra_carro,carro_padrao,fabricante_padrao FROM calendario ORDER BY temporada_id,etapa`).all<any>(),
    db.prepare(`SELECT p.id,p.apelido,p.simgrid,p.arquivado_em,i.temporada_id,i.serie,i.situacao FROM pilotos p JOIN inscricoes i ON i.piloto_id=p.id ORDER BY i.temporada_id,i.serie,p.apelido COLLATE NOCASE`).all<any>(),
    db.prepare(`SELECT temporada_id,etapa,piloto_id,confirmou,compareceu,falta_justificada,posicao_final,volta_mais_rapida,punicao,abandono_motivo,observacao,pontos,carro,fabricante,origem_carro,suplente,pontos_suplente FROM corridas ORDER BY temporada_id,etapa,piloto_id`).all<any>(),
    db.prepare(`SELECT id,apelido,simgrid,'piloto' AS kind
                FROM pilotos WHERE arquivado_em IS NULL
                UNION ALL
                SELECT id,apelido,simgrid,'fila' AS kind
                FROM fila
                WHERE promovido_para_piloto_id IS NULL
                  AND COALESCE(ativo,1) <> 0
                  AND arquivado_em IS NULL
                ORDER BY apelido COLLATE NOCASE`).all<any>(),
  ]);
  const divisoes: RaceDivision[] = explicitDivisions.results.map(mapDivision);
  const known = new Set(divisoes.map((d) => `${d.temporadaId}\0${d.codigo}`));
  for (const row of enrolledDivisions.results as any[]) {
    if (known.has(`${row.temporada_id}\0${row.serie}`)) continue;
    divisoes.push({ temporadaId: row.temporada_id, codigo: row.serie, nome: `Série ${row.serie}`,
      cor: fallbackColors[row.serie] ?? null, ordem: row.serie === "A" ? 1 : row.serie === "B" ? 2 : row.serie === "C" ? 3 : 99,
      abertoSuplentes: false, limitePilotos: null, dataInicio: null, frequenciaDias: 7,
      regraCarro: null, carroPadrao: null, fabricantePadrao: null, status: "ativa", arquivadaEm: null, motivoArquivamento: null,
      whatsappGroupUrl: defaultDivisionGroupUrl(row.serie) });
  }
  return {
    competicoes: competitions.results.map((r:any):RaceCompetition => ({ id:r.id,nome:r.nome,ativa:Boolean(r.ativa),totalEtapas:r.total_etapas,tipoEvento:r.tipo_evento,geraClassificacao:Boolean(r.gera_classificacao),pilotosPorSerie:r.pilotos_por_serie,regraCarro:r.regra_carro,carroPadrao:r.carro_padrao,fabricantePadrao:r.fabricante_padrao,status:r.status,arquivadaEm:r.arquivada_em,motivoArquivamento:r.motivo_arquivamento,whatsappGroupUrl:r.whatsapp_group_url??GENERAL_WHATSAPP_GROUP_URL })),
    divisoes: divisoes.sort((a,b)=>a.temporadaId.localeCompare(b.temporadaId)||a.ordem-b.ordem),
    etapas: stages.results.map((r:any):RaceStage => ({ temporadaId:r.temporada_id,etapa:r.etapa,pista:r.pista,classeOuFormato:r.classe_ou_formato,duracao:r.duracao,data:r.data,multiplicador:r.multiplicador,observacao:r.observacao,regraCarro:r.regra_carro,carroPadrao:r.carro_padrao,fabricantePadrao:r.fabricante_padrao })),
    pilotos: pilots.results.map((r:any):RacePilot => ({ id:r.id,apelido:r.apelido,simgrid:r.simgrid,temporadaId:r.temporada_id,serie:r.serie,situacao:r.situacao,pilotoArquivado:Boolean(r.arquivado_em) })),
    resultados: results.results.map((r:any):RaceResult => ({ suplente:Boolean(r.suplente),pontosSuplente:r.pontos_suplente??null,temporadaId:r.temporada_id,etapa:r.etapa,pilotoId:r.piloto_id,confirmou:r.confirmou===null?null:Boolean(r.confirmou),compareceu:r.compareceu===null?null:Boolean(r.compareceu),faltaJustificada:r.falta_justificada===null?null:Boolean(r.falta_justificada),posicaoFinal:r.posicao_final,voltaMaisRapida:Boolean(r.volta_mais_rapida),punicao:r.punicao,abandonoMotivo:r.abandono_motivo,observacao:r.observacao,pontos:r.pontos,carro:r.carro,fabricante:r.fabricante,origemCarro:r.origem_carro })),
    pilotosDisponiveis: available.results as AvailableRacePilot[],
  };
}

function mapDivision(r:any):RaceDivision { return { abertoSuplentes:Boolean(r.aberto_suplentes),temporadaId:r.temporada_id,codigo:r.codigo,nome:r.nome,cor:r.cor,ordem:r.ordem,limitePilotos:r.limite_pilotos??defaultLimit(r.temporada_id,r.codigo),dataInicio:r.data_inicio??defaultStart(r.temporada_id,r.codigo),frequenciaDias:r.frequencia_dias??7,regraCarro:r.regra_carro,carroPadrao:r.carro_padrao,fabricantePadrao:r.fabricante_padrao,status:r.status,arquivadaEm:r.arquivada_em,motivoArquivamento:r.motivo_arquivamento,whatsappGroupUrl:r.whatsapp_group_url??defaultDivisionGroupUrl(r.codigo,r.nome) }; }
function defaultLimit(temporadaId:string,codigo:string){return temporadaId==="2026"?(codigo==="A"||codigo==="B"?14:codigo==="C"?15:null):null}
function defaultStart(temporadaId:string,codigo:string){return temporadaId==="2026"?(codigo==="A"?"2026-10-06":codigo==="B"||codigo==="C"?"2026-10-05":null):null}
