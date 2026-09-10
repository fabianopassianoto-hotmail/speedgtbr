import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const pilotos = sqliteTable(
  "pilotos",
  {
    id: text("id").primaryKey(),
    apelido: text("apelido").notNull(),
    nomeCompleto: text("nome_completo"),
    psn: text("psn"),
    simgrid: text("simgrid"),
    simgridUrl: text("simgrid_url"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    cidade: text("cidade"),
    uf: text("uf"),
    volanteOuControle: text("volante_ou_controle"),
    perfilPilotagem: text("perfil_pilotagem"),
    disponibilidade: text("disponibilidade"),
    carroPreferido: text("carro_preferido"),
    pistaCitada: text("pista_citada"),
    relacoes: text("relacoes"),
    curiosidade: text("curiosidade"),
    observacoesAdm: text("observacoes_adm"),
    ativo: integer("ativo", { mode: "boolean" }),
    cadastroStatus: text("cadastro_status"),
    dataNascimento: text("data_nascimento"),
    dataEntrada: text("data_entrada"),
    arquivadoEm: text("arquivado_em"),
    motivoArquivamento: text("motivo_arquivamento"),
  },
  (table) => [
    check("ck_pilotos_id", sql`${table.id} GLOB 'SGT[0-9][0-9][0-9]'`),
    check("ck_pilotos_apelido", sql`length(trim(${table.apelido})) > 0`),
  ],
);

export const temporadas = sqliteTable(
  "temporadas",
  {
    id: text("id").primaryKey(),
    nome: text("nome").notNull(),
    ativa: integer("ativa", { mode: "boolean" }).notNull(),
    totalEtapas: integer("total_etapas").notNull(),
    pilotosPorSerie: integer("pilotos_por_serie").notNull(),
    tipoEvento: text("tipo_evento").notNull().default("campeonato"),
    geraClassificacao: integer("gera_classificacao", { mode: "boolean" })
      .notNull()
      .default(true),
    regraCarro: text("regra_carro"),
    carroPadrao: text("carro_padrao"),
    fabricantePadrao: text("fabricante_padrao"),
    status: text("status").notNull().default("ativa"),
    arquivadaEm: text("arquivada_em"),
    motivoArquivamento: text("motivo_arquivamento"),
    whatsappGroupUrl: text("whatsapp_group_url"),
  },
  (table) => [
    check("ck_temporadas_total_etapas", sql`${table.totalEtapas} > 0`),
    check(
      "ck_temporadas_pilotos_por_serie",
      sql`${table.pilotosPorSerie} > 0`,
    ),
    check("ck_temporadas_tipo_evento", sql`${table.tipoEvento} IN ('campeonato', '4fun')`),
    check(
      "ck_temporadas_regra_carro",
      sql`${table.regraCarro} IS NULL OR ${table.regraCarro} IN ('regulamento', 'piloto', 'misto')`,
    ),
    check(
      "ck_temporadas_status",
      sql`${table.status} IN ('ativa', 'arquivada', 'cancelada')`,
    ),
  ],
);

export const divisoes = sqliteTable(
  "divisoes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    temporadaId: text("temporada_id")
      .notNull()
      .references(() => temporadas.id, { onDelete: "restrict" }),
    codigo: text("codigo").notNull(),
    nome: text("nome").notNull(),
    cor: text("cor"),
    ordem: integer("ordem").notNull(),
    limitePilotos: integer("limite_pilotos"),
    dataInicio: text("data_inicio"),
    frequenciaDias: integer("frequencia_dias").notNull().default(7),
    abertoSuplentes: integer("aberto_suplentes", { mode: "boolean" }).notNull().default(false),
    regraCarro: text("regra_carro"),
    carroPadrao: text("carro_padrao"),
    fabricantePadrao: text("fabricante_padrao"),
    status: text("status").notNull().default("ativa"),
    arquivadaEm: text("arquivada_em"),
    motivoArquivamento: text("motivo_arquivamento"),
    whatsappGroupUrl: text("whatsapp_group_url"),
  },
  (table) => [
    uniqueIndex("uidx_divisoes_temporada_codigo").on(table.temporadaId, table.codigo),
    index("idx_divisoes_temporada_ordem").on(table.temporadaId, table.ordem),
    check("ck_divisoes_codigo", sql`length(trim(${table.codigo})) > 0`),
    check("ck_divisoes_nome", sql`length(trim(${table.nome})) > 0`),
    check("ck_divisoes_ordem", sql`${table.ordem} > 0`),
    check(
      "ck_divisoes_limite_pilotos",
      sql`${table.limitePilotos} IS NULL OR ${table.limitePilotos} > 0`,
    ),
    check(
      "ck_divisoes_frequencia_dias",
      sql`${table.frequenciaDias} > 0`,
    ),
    check(
      "ck_divisoes_regra_carro",
      sql`${table.regraCarro} IS NULL OR ${table.regraCarro} IN ('regulamento', 'piloto', 'misto')`,
    ),
    check(
      "ck_divisoes_status",
      sql`${table.status} IN ('ativa', 'arquivada', 'cancelada')`,
    ),
  ],
);

export const usuariosAcessos = sqliteTable(
  "usuarios_acessos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountUserId: text("account_user_id"),
    email: text("email").notNull(),
    nome: text("nome"),
    papel: text("papel").notNull(),
    serie: text("serie"),
    ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    uniqueIndex("uidx_usuarios_acessos_account_user_id").on(
      table.accountUserId,
    ),
    uniqueIndex("uidx_usuarios_acessos_email").on(table.email),
    index("idx_usuarios_acessos_papel_serie").on(table.papel, table.serie),
    check(
      "ck_usuarios_acessos_papel",
      sql`${table.papel} IN ('administrador', 'coordenador')`,
    ),
  ],
);

export const solicitacoesAcesso = sqliteTable(
  "solicitacoes_acesso",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountUserId: text("account_user_id").notNull(),
    email: text("email").notNull(),
    nome: text("nome"),
    status: text("status").notNull().default("pendente"),
    criadoEm: text("criado_em").notNull(),
    revisadoEm: text("revisado_em"),
    revisadoPor: text("revisado_por"),
  },
  (table) => [
    uniqueIndex("uidx_solicitacoes_acesso_account_user_id").on(
      table.accountUserId,
    ),
    index("idx_solicitacoes_acesso_status_criado_em").on(
      table.status,
      table.criadoEm,
    ),
    check(
      "ck_solicitacoes_acesso_status",
      sql`${table.status} IN ('pendente', 'aprovado', 'negado')`,
    ),
  ],
);

export const inscricoes = sqliteTable(
  "inscricoes",
  {
    temporadaId: text("temporada_id")
      .notNull()
      .references(() => temporadas.id, { onDelete: "restrict" }),
    pilotoId: text("piloto_id")
      .notNull()
      .references(() => pilotos.id, { onDelete: "restrict" }),
    serie: text("serie").notNull(),
    situacao: text("situacao"),
    pagamentoIsento: integer("pagamento_isento", { mode: "boolean" })
      .notNull()
      .default(false),
    saidaEm: text("saida_em"),
    motivoSaida: text("motivo_saida"),
    previsaoVolta: text("previsao_volta"),
  },
  (table) => [
    primaryKey({ columns: [table.temporadaId, table.pilotoId] }),
    index("idx_inscricoes_temporada_serie").on(
      table.temporadaId,
      table.serie,
    ),
    check("ck_inscricoes_serie", sql`length(trim(${table.serie})) > 0`),
    check(
      "ck_inscricoes_situacao",
      sql`${table.situacao} IS NULL OR ${table.situacao} IN ('ativo', 'suplente', 'inativo', 'saiu')`,
    ),
  ],
);

export const calendario = sqliteTable(
  "calendario",
  {
    temporadaId: text("temporada_id")
      .notNull()
      .references(() => temporadas.id, { onDelete: "restrict" }),
    etapa: integer("etapa").notNull(),
    pista: text("pista").notNull(),
    classeOuFormato: text("classe_ou_formato"),
    duracao: text("duracao"),
    data: text("data"),
    multiplicador: integer("multiplicador").notNull(),
    observacao: text("observacao"),
    regraCarro: text("regra_carro"),
    carroPadrao: text("carro_padrao"),
    fabricantePadrao: text("fabricante_padrao"),
  },
  (table) => [
    primaryKey({ columns: [table.temporadaId, table.etapa] }),
    check("ck_calendario_etapa", sql`${table.etapa} > 0`),
    check(
      "ck_calendario_multiplicador",
      sql`${table.multiplicador} > 0`,
    ),
    check(
      "ck_calendario_regra_carro",
      sql`${table.regraCarro} IS NULL OR ${table.regraCarro} IN ('regulamento', 'piloto', 'misto')`,
    ),
  ],
);

export const corridas = sqliteTable(
  "corridas",
  {
    temporadaId: text("temporada_id").notNull(),
    etapa: integer("etapa").notNull(),
    pilotoId: text("piloto_id")
      .notNull()
      .references(() => pilotos.id, { onDelete: "restrict" }),
    confirmou: integer("confirmou", { mode: "boolean" }),
    compareceu: integer("compareceu", { mode: "boolean" }),
    faltaJustificada: integer("falta_justificada", { mode: "boolean" }),
    posicaoFinal: integer("posicao_final"),
    voltaMaisRapida: integer("volta_mais_rapida", { mode: "boolean" })
      .notNull()
      .default(false),
    punicao: text("punicao"),
    abandonoMotivo: text("abandono_motivo"),
    observacao: text("observacao"),
    pontos: integer("pontos").notNull().default(0),
    carro: text("carro"),
    fabricante: text("fabricante"),
    origemCarro: text("origem_carro"),
    suplente: integer("suplente", { mode: "boolean" }).notNull().default(false),
    pontosSuplente: integer("pontos_suplente"),
  },
  (table) => [
    primaryKey({
      columns: [table.temporadaId, table.etapa, table.pilotoId],
    }),
    foreignKey({
      columns: [table.temporadaId, table.etapa],
      foreignColumns: [calendario.temporadaId, calendario.etapa],
      name: "fk_corridas_calendario",
    }).onDelete("restrict"),
    index("idx_corridas_temporada_etapa").on(
      table.temporadaId,
      table.etapa,
    ),
    check(
      "ck_corridas_posicao_final",
      sql`${table.posicaoFinal} IS NULL OR ${table.posicaoFinal} > 0`,
    ),
    check("ck_corridas_pontos", sql`${table.pontos} >= 0`),
    check(
      "ck_corridas_origem_carro",
      sql`${table.origemCarro} IS NULL OR ${table.origemCarro} IN ('regulamento', 'piloto')`,
    ),
  ],
);

export const caixa = sqliteTable(
  "caixa",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    temporadaId: text("temporada_id")
      .notNull()
      .references(() => temporadas.id, { onDelete: "restrict" }),
    data: text("data").notNull(),
    pilotoId: text("piloto_id").references(() => pilotos.id, {
      onDelete: "restrict",
    }),
    nome: text("nome").notNull(),
    tipo: text("tipo").notNull(),
    valor: integer("valor").notNull(),
    vaiParaMedalha: integer("vai_para_medalha")
      .generatedAlwaysAs(sql`max(0, valor - 2000)`, { mode: "stored" })
      .notNull(),
    observacao: text("observacao"),
  },
  (table) => [
    index("idx_caixa_temporada_piloto").on(
      table.temporadaId,
      table.pilotoId,
    ),
    check("ck_caixa_valor", sql`${table.valor} >= 0`),
  ],
);

export const fila = sqliteTable(
  "fila",
  {
    id: text("id").primaryKey(),
    apelido: text("apelido").notNull(),
    nomeCompleto: text("nome_completo"),
    psn: text("psn"),
    simgrid: text("simgrid"),
    simgridUrl: text("simgrid_url"),
    whatsapp: text("whatsapp"),
    cidade: text("cidade"),
    uf: text("uf"),
    email: text("email"),
    volanteOuControle: text("volante_ou_controle"),
    perfilPilotagem: text("perfil_pilotagem"),
    disponibilidade: text("disponibilidade"),
    carroPreferido: text("carro_preferido"),
    pistaCitada: text("pista_citada"),
    relacoes: text("relacoes"),
    curiosidade: text("curiosidade"),
    observacoesAdm: text("observacoes_adm"),
    ativo: integer("ativo", { mode: "boolean" }),
    cadastroStatus: text("cadastro_status"),
    dataNascimento: text("data_nascimento"),
    dataEntrada: text("data_entrada"),
    arquivadoEm: text("arquivado_em"),
    motivoArquivamento: text("motivo_arquivamento"),
    corridas4fun: integer("corridas_4fun"),
    conduta: text("conduta"),
    prontoParaSerie: integer("pronto_para_serie", { mode: "boolean" }),
    promovidoParaPilotoId: text("promovido_para_piloto_id").references(
      () => pilotos.id,
      { onDelete: "restrict" },
    ),
  },
  (table) => [
    index("idx_fila_apelido").on(table.apelido),
    index("idx_fila_promovido_para_piloto_id").on(table.promovidoParaPilotoId),
    check("ck_fila_id", sql`${table.id} GLOB 'FIL[0-9][0-9][0-9]'`),
    check("ck_fila_apelido", sql`length(trim(${table.apelido})) > 0`),
    check(
      "ck_fila_corridas_4fun",
      sql`${table.corridas4fun} IS NULL OR ${table.corridas4fun} >= 0`,
    ),
  ],
);

export const formulariosPendentes = sqliteTable(
  "formularios_pendentes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    criadoEm: text("criado_em").notNull(),
    nomeCompleto: text("nome_completo").notNull(),
    psn: text("psn"),
    simgrid: text("simgrid"),
    simgridUrl: text("simgrid_url"),
    whatsapp: text("whatsapp").notNull(),
    email: text("email"),
    cidade: text("cidade"),
    uf: text("uf"),
    volanteOuControle: text("volante_ou_controle"),
    perfilPilotagem: text("perfil_pilotagem"),
    disponibilidade: text("disponibilidade"),
    carroPreferido: text("carro_preferido"),
    pistaCitada: text("pista_citada"),
    dataNascimento: text("data_nascimento"),
    curiosidade: text("curiosidade"),
    status: text("status").notNull().default("pendente"),
    revisadoEm: text("revisado_em"),
    destinoTipo: text("destino_tipo"),
    destinoId: text("destino_id"),
  },
  (table) => [
    index("idx_formularios_pendentes_status_criado_em").on(
      table.status,
      table.criadoEm,
    ),
    index("idx_formularios_pendentes_whatsapp").on(table.whatsapp),
    check(
      "ck_formularios_pendentes_status",
      sql`${table.status} IN ('pendente', 'aplicado', 'descartado')`,
    ),
  ],
);

export const caixaConfiguracao = sqliteTable("caixa_configuracao", {
  temporadaId: text("temporada_id").primaryKey().references(() => temporadas.id, { onDelete: "cascade" }),
  medalhaIndividual: integer("medalha_individual").notNull().default(0),
  medalhaTemporada: integer("medalha_temporada").notNull().default(0),
  freteIndividual: integer("frete_individual").notNull().default(0),
  freteTemporada: integer("frete_temporada").notNull().default(0),
  saldoCaixa: integer("saldo_caixa").notNull().default(0),
});
