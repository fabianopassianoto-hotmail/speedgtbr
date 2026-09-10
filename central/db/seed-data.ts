import caixaCsv from "@/seed/caixa_2026.csv?raw";
import calendarioCsv from "@/seed/calendario_2026.csv?raw";
import filaCsv from "@/seed/fila.csv?raw";
import inscricoesCsv from "@/seed/inscricoes_2026.csv?raw";
import pilotosCsv from "@/seed/pilotos.csv?raw";
import pontuacaoCsv from "@/seed/pontuacao.csv?raw";
import {
  brazilianDateToIso,
  emptyToNull,
  integerFromCsv,
  moneyToCents,
  parseCsv,
  required,
} from "@/lib/csv";

const TEMPORADA_2026 = "2026";

export const seedData = (() => {
  const pilotos = parseCsv(pilotosCsv).map((row) => ({
    id: required(row.id, "pilotos.id"),
    apelido: required(row.apelido, "pilotos.apelido"),
    nomeCompleto: emptyToNull(row.nome_completo),
    psn: emptyToNull(row.psn),
    simgrid: emptyToNull(row.simgrid),
    simgridUrl: emptyToNull(row.simgrid_url),
    whatsapp: emptyToNull(row.whatsapp),
    cidade: emptyToNull(row.cidade),
    uf: emptyToNull(row.uf),
    email: emptyToNull(row.email),
    volanteOuControle: emptyToNull(row.volante_ou_controle),
    perfilPilotagem: emptyToNull(row.perfil_pilotagem),
    disponibilidade: emptyToNull(row.disponibilidade),
    carroPreferido: emptyToNull(row.carro_preferido),
    pistaCitada: emptyToNull(row.pista_citada),
    relacoes: emptyToNull(row.relacoes),
    curiosidade: emptyToNull(row.curiosidade),
  }));

  const pilotoIds = new Set(pilotos.map((piloto) => piloto.id));
  const pilotosById = new Map(pilotos.map((piloto) => [piloto.id, piloto]));

  const inscricoes = parseCsv(inscricoesCsv).map((row) => {
    const pilotoId = required(row.piloto_id, "inscricoes.piloto_id");
    if (!pilotoIds.has(pilotoId)) {
      throw new Error(`Inscrição referencia piloto inexistente: ${pilotoId}.`);
    }
    if (pilotosById.get(pilotoId)?.apelido !== row.apelido) {
      throw new Error(`Apelido divergente na inscrição de ${pilotoId}.`);
    }
    if (!/^[ABC]$/.test(row.serie)) {
      throw new Error(`Série inválida para ${pilotoId}: ${row.serie}.`);
    }
    return {
      temporadaId: required(row.temporada, "inscricoes.temporada"),
      pilotoId,
      serie: row.serie,
    };
  });
  const serieByPiloto = new Map(
    inscricoes.map((inscricao) => [inscricao.pilotoId, inscricao.serie]),
  );

  const calendario = parseCsv(calendarioCsv).map((row) => ({
    temporadaId: TEMPORADA_2026,
    etapa: integerFromCsv(row.etapa, "calendario.etapa"),
    pista: required(row.pista, "calendario.pista"),
    classeOuFormato: emptyToNull(row.classe_ou_formato),
    duracao: emptyToNull(row.duracao),
    data: null,
    multiplicador: integerFromCsv(
      row.multiplicador,
      "calendario.multiplicador",
    ),
    observacao: emptyToNull(row.observacao),
  }));

  const pontuacao = new Map(
    parseCsv(pontuacaoCsv).map((row) => [
      integerFromCsv(row.posicao, "pontuacao.posicao"),
      integerFromCsv(row.pontos, "pontuacao.pontos"),
    ]),
  );

  const caixa = parseCsv(caixaCsv).map((row) => {
    const pilotoId = emptyToNull(row.piloto_id);
    if (pilotoId && !pilotoIds.has(pilotoId)) {
      throw new Error(`Caixa referencia piloto inexistente: ${pilotoId}.`);
    }
    if (pilotoId && row.serie !== serieByPiloto.get(pilotoId)) {
      throw new Error(`Série divergente no caixa para ${pilotoId}.`);
    }
    if (!pilotoId && row.serie !== "") {
      throw new Error(`Série sem piloto associado no caixa: ${row.nome}.`);
    }
    const valor = moneyToCents(row.valor, "caixa.valor");
    const medalhaInformada = moneyToCents(
      row.vai_para_medalha,
      "caixa.vai_para_medalha",
    );
    const medalhaCalculada = Math.max(0, valor - 2_000);
    if (medalhaInformada !== medalhaCalculada) {
      throw new Error(
        `Valor de medalha divergente para ${row.nome}: CSV=${medalhaInformada}, fórmula=${medalhaCalculada}.`,
      );
    }
    return {
      temporadaId: TEMPORADA_2026,
      data: brazilianDateToIso(row.data, "caixa.data"),
      pilotoId,
      nome: required(row.nome, "caixa.nome"),
      tipo: required(row.tipo, "caixa.tipo"),
      valor,
      observacao: emptyToNull(row.observacao),
    };
  });

  const fila = parseCsv(filaCsv).map((row) => ({
    id: required(row.id, "fila.id"),
    apelido: required(row.apelido, "fila.apelido"),
    nomeCompleto: emptyToNull(row.nome_completo),
    psn: emptyToNull(row.psn),
    simgrid: emptyToNull(row.simgrid),
    whatsapp: emptyToNull(row.whatsapp),
    cidade: emptyToNull(row.cidade),
    uf: emptyToNull(row.uf),
    email: emptyToNull(row.email),
  }));

  return {
    temporadas: [
      {
        id: TEMPORADA_2026,
        nome: "2026",
        ativa: true,
        totalEtapas: 7,
        pilotosPorSerie: 15,
      },
    ],
    pilotos,
    inscricoes,
    calendario,
    pontuacao,
    caixa,
    fila,
  };
})();
