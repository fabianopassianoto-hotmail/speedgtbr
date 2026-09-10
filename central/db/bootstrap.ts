import { getD1Binding } from "@/db";
import { seedData } from "@/db/seed-data";

export type SeedCounts = {
  temporadas: number;
  pilotos: number;
  inscricoes: number;
  calendario: number;
  corridas: number;
  caixa: number;
  fila: number;
  usuarios_acessos: number;
};

export async function bootstrapDatabase(): Promise<SeedCounts> {
  const db = getD1Binding();
  const before = await readCounts();
  if (before.temporadas > 0) {
    return before;
  }

  const orphanedRows = Object.entries(before)
    .filter(([tableName, count]) => tableName !== "temporadas" && count > 0)
    .map(([tableName]) => tableName);
  if (orphanedRows.length > 0) {
    throw new Error(
      `Banco parcialmente preenchido antes da carga inicial: ${orphanedRows.join(", ")}.`,
    );
  }

  const statements = [
    ...seedData.temporadas.map((row) =>
      db
        .prepare(
          "INSERT INTO temporadas (id, nome, ativa, total_etapas, pilotos_por_serie) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(
          row.id,
          row.nome,
          row.ativa ? 1 : 0,
          row.totalEtapas,
          row.pilotosPorSerie,
        ),
    ),
    ...seedData.pilotos.map((row) =>
      db
        .prepare(
          `INSERT INTO pilotos (
            id, apelido, nome_completo, psn, simgrid, simgrid_url, whatsapp,
            email, cidade, uf, volante_ou_controle, perfil_pilotagem,
            disponibilidade, carro_preferido, pista_citada, relacoes,
            curiosidade, observacoes_adm, ativo
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          row.id,
          row.apelido,
          row.nomeCompleto,
          row.psn,
          row.simgrid,
          row.simgridUrl,
          row.whatsapp,
          row.email,
          row.cidade,
          row.uf,
          row.volanteOuControle,
          row.perfilPilotagem,
          row.disponibilidade,
          row.carroPreferido,
          row.pistaCitada,
          row.relacoes,
          row.curiosidade,
          null,
          null,
        ),
    ),
    ...seedData.inscricoes.map((row) =>
      db
        .prepare(
          "INSERT INTO inscricoes (temporada_id, piloto_id, serie, situacao) VALUES (?, ?, ?, ?)",
        )
        .bind(row.temporadaId, row.pilotoId, row.serie, null),
    ),
    ...seedData.calendario.map((row) =>
      db
        .prepare(
          `INSERT INTO calendario (
            temporada_id, etapa, pista, classe_ou_formato, duracao, data,
            multiplicador, observacao
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          row.temporadaId,
          row.etapa,
          row.pista,
          row.classeOuFormato,
          row.duracao,
          row.data,
          row.multiplicador,
          row.observacao,
        ),
    ),
    ...seedData.caixa.map((row) =>
      db
        .prepare(
          `INSERT INTO caixa (
            temporada_id, data, piloto_id, nome, tipo, valor, observacao
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          row.temporadaId,
          row.data,
          row.pilotoId,
          row.nome,
          row.tipo,
          row.valor,
          row.observacao,
        ),
    ),
    ...seedData.fila.map((row) =>
      db
        .prepare(
          `INSERT INTO fila (
            id, apelido, nome_completo, psn, simgrid, whatsapp, cidade, uf,
            email, corridas_4fun, conduta, pronto_para_serie
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          row.id,
          row.apelido,
          row.nomeCompleto,
          row.psn,
          row.simgrid,
          row.whatsapp,
          row.cidade,
          row.uf,
          row.email,
          null,
          null,
          null,
        ),
    ),
  ];

  await db.batch(statements);
  await db.prepare("PRAGMA optimize").run();

  const after = await readCounts();
  assertExpectedSeedCounts(after);
  return after;
}

async function readCounts(): Promise<SeedCounts> {
  const db = getD1Binding();
  const tableNames = [
    "temporadas",
    "pilotos",
    "inscricoes",
    "calendario",
    "corridas",
    "caixa",
    "fila",
    "usuarios_acessos",
  ] as const;
  const results = await db.batch(
    tableNames.map((tableName) =>
      db.prepare(`SELECT COUNT(*) AS total FROM ${tableName}`),
    ),
  );

  return Object.fromEntries(
    tableNames.map((tableName, index) => [
      tableName,
      Number(results[index].results[0]?.total ?? 0),
    ]),
  ) as SeedCounts;
}

function assertExpectedSeedCounts(counts: SeedCounts): void {
  const expected: SeedCounts = {
    temporadas: 1,
    pilotos: 45,
    inscricoes: 45,
    calendario: 7,
    corridas: 0,
    caixa: 7,
    fila: 78,
    usuarios_acessos: 0,
  };

  for (const [tableName, expectedCount] of Object.entries(expected)) {
    const actualCount = counts[tableName as keyof SeedCounts];
    if (actualCount !== expectedCount) {
      throw new Error(
        `Carga inicial divergente em ${tableName}: esperado ${expectedCount}, recebido ${actualCount}.`,
      );
    }
  }
}
