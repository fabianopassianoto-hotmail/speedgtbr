import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("protects the page and the database bootstrap with authentication", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const bootstrapRoute = await readFile(
    new URL("../app/api/admin/bootstrap/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(page, /requireChatGPTUser\("\/central"\)/);
  assert.match(bootstrapRoute, /getChatGPTUser\(\)/);
  assert.match(bootstrapRoute, /status: 401/);
});

test("keeps the dashboard available when a server data source fails", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /loadHomeData\("bootstrap", bootstrapDatabase\(\)\)/);
  assert.match(page, /console\.error\(`\[home:\$\{label\}\]`, error\)/);
  assert.match(page, /return <HomeRecovery \/>/);
  assert.match(page, /Seus registros continuam preservados/);
});

test("protects race result writes with authentication and authorization", async () => {
  const raceRoute = await readFile(
    new URL("../app/api/corridas/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(raceRoute, /getChatGPTUser\(\)/);
  assert.match(raceRoute, /ensureCurrentUserAccess\(user\)/);
  assert.match(raceRoute, /Você só pode lançar corridas da sua série/);
  assert.match(raceRoute, /calculateRacePoints/);
});

test("keeps the public form pending and protects its review", async () => {
  const publicRoute = await readFile(
    new URL("../app/api/cadastro/route.ts", import.meta.url),
    "utf8",
  );
  const reviewRoute = await readFile(
    new URL("../app/api/formularios/[id]/aprovar/route.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(publicRoute, /getChatGPTUser/);
  assert.match(publicRoute, /INSERT INTO formularios_pendentes/);
  assert.match(publicRoute, /'pendente'/);
  assert.match(reviewRoute, /getChatGPTUser\(\)/);
  assert.match(reviewRoute, /access\.papel !== "administrador"/);
  assert.match(reviewRoute, /body\.action === "aplicar"/);
});

test("uses manual registration status and only active championship rosters", async () => {
  const pilotRoute = await readFile(
    new URL("../app/api/pilotos/[id]/route.ts", import.meta.url),
    "utf8",
  );
  const raceEntry = await readFile(
    new URL("../components/race-entry-screen.tsx", import.meta.url),
    "utf8",
  );
  const raceWrite = await readFile(
    new URL("../app/api/corridas/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(pilotRoute, /cadastroStatus: "cadastro_status"/);
  assert.match(pilotRoute, /body\.field === "situacao"/);
  assert.match(pilotRoute, /body\.value !== "suplente"/);
  assert.match(pilotRoute, /body\.value !== "inativo"/);
  assert.match(pilotRoute, /body\.value !== "saiu"/);
  assert.match(raceEntry, /\(p\.situacao\?\?"ativo"\)==="ativo"/);
  assert.match(raceWrite, /COALESCE\(i\.situacao, 'ativo'\) IN \('ativo','suplente'\)/);
});

test("separates former pilots and stores their departure history", async () => {
  const pilotRoute = await readFile(
    new URL("../app/api/pilotos/[id]/route.ts", import.meta.url),
    "utf8",
  );
  const pilotsScreen = await readFile(
    new URL("../components/pilots-screen.tsx", import.meta.url),
    "utf8",
  );
  const migration = await readFile(
    new URL("../drizzle/0003_cool_shocker.sql", import.meta.url),
    "utf8",
  );

  assert.match(pilotRoute, /body\.field === "participacaoTemporada"/);
  assert.match(pilotRoute, /saidaEm: "saida_em"/);
  assert.match(pilotRoute, /motivoSaida: "motivo_saida"/);
  assert.match(pilotRoute, /previsaoVolta: "previsao_volta"/);
  assert.match(pilotsScreen, /value: "ex_pilotos", label: "Ex-pilotos"/);
  assert.match(
    pilotsScreen,
    /value:\s*"saiu",\s*label:\s*"Não vai participar"/,
  );
  assert.match(migration, /ADD `saida_em` text/);
  assert.match(migration, /ADD `motivo_saida` text/);
  assert.match(migration, /ADD `previsao_volta` text/);
});

test("lists every pilot and supports safe archive or deletion", async () => {
  const pilotsQuery = await readFile(
    new URL("../db/pilots.ts", import.meta.url),
    "utf8",
  );
  const administrationRoute = await readFile(
    new URL("../app/api/pilotos/[id]/administracao/route.ts", import.meta.url),
    "utf8",
  );
  const pilotsScreen = await readFile(
    new URL("../components/pilots-screen.tsx", import.meta.url),
    "utf8",
  );

  assert.match(pilotsQuery, /LEFT JOIN inscricoes i/);
  assert.match(pilotsScreen, /value: "arquivados", label: "Arquivados"/);
  assert.match(administrationRoute, /body\.action === "arquivar"/);
  assert.match(administrationRoute, /body\.action === "reativar"/);
  assert.match(administrationRoute, /body\.action === "apagar"/);
  assert.match(administrationRoute, /COUNT\(\*\) FROM corridas/);
  assert.match(administrationRoute, /COUNT\(\*\) FROM caixa/);
});

test("gives queue records the same archive and deletion controls", async () => {
  const pilotsScreen = await readFile(
    new URL("../components/pilots-screen.tsx", import.meta.url),
    "utf8",
  );
  const queueAdministration = await readFile(
    new URL("../app/api/fila/[id]/administracao/route.ts", import.meta.url),
    "utf8",
  );
  const migration = await readFile(
    new URL("../drizzle/0010_unique_greymalkin.sql", import.meta.url),
    "utf8",
  );

  assert.match(pilotsScreen, /function PersonArchiveControls/);
  assert.match(pilotsScreen, /record\.kind==="piloto"\?"pilotos":"fila"/);
  assert.match(pilotsScreen, /<PersonArchiveControls record=\{record\}/);
  assert.match(queueAdministration, /body\.action === "arquivar"/);
  assert.match(queueAdministration, /body\.action === "reativar"/);
  assert.match(queueAdministration, /body\.action === "apagar"/);
  assert.match(migration, /ADD `arquivado_em` text/);
  assert.match(migration, /ADD `motivo_arquivamento` text/);
});

test("builds a responsive standings screen from recorded results", async () => {
  const pilotsScreen = await readFile(
    new URL("../components/pilots-screen.tsx", import.meta.url),
    "utf8",
  );
  const standings = await readFile(
    new URL("../components/standings-screen.tsx", import.meta.url),
    "utf8",
  );
  const standingsEngine = await readFile(
    new URL("../db/standings.ts", import.meta.url),
    "utf8",
  );
  const raceEntry = await readFile(
    new URL("../components/race-entry-screen.tsx", import.meta.url),
    "utf8",
  );

  assert.match(pilotsScreen, /value: "classificacao", label: "Classificação", icon: Trophy, enabled: true/);
  assert.match(pilotsScreen, /<StandingsScreen/);
  assert.match(standings, /O campeonato ainda não começou/);
  assert.match(standings, /Etapas não lançadas aparecem como[\s\S]*pendentes, nunca como zero/);
  assert.match(standingsEngine, /row\.pilot\.serie === "A"/);
  assert.match(standingsEngine, /rank <= 10[\s\S]*?"permanece"[\s\S]*?: "desce"/);
  assert.match(standingsEngine, /rank <= 5[\s\S]*?"sobe"/);
  assert.match(standings, /division\.codigo !== "A"/);
  assert.match(standingsEngine, /result\.confirmou === true/);
  assert.match(standingsEngine, /3ª falta ou mais · rebaixamento indicado/);
  assert.match(standings, /hidden overflow-x-auto md:block/);
  assert.match(standings, /space-y-3 pt-3 md:hidden/);
  assert.match(raceEntry, /onResultsChange\?\.\(next\)/);
  assert.match(raceEntry, /Confirmou presença antes da corrida\?/);
  assert.match(raceEntry, /A falta foi justificada\?/);
  assert.match(raceEntry, /Só conta como falta disciplinar/);
});

test("captures birth date, league entry and controller choice", async () => {
  const registrationForm = await readFile(
    new URL("../components/public-registration-form.tsx", import.meta.url),
    "utf8",
  );
  const pilotScreen = await readFile(
    new URL("../components/pilots-screen.tsx", import.meta.url),
    "utf8",
  );
  const migration = await readFile(
    new URL("../drizzle/0007_steep_queen_noir.sql", import.meta.url),
    "utf8",
  );

  assert.match(registrationForm, /name="volanteOuControle"/);
  assert.match(registrationForm, /option value="Volante"/);
  assert.match(registrationForm, /name: "dataNascimento"/);
  assert.match(registrationForm, /name: "curiosidade"/);
  assert.match(pilotScreen, /Aniversário na liga:/);
  assert.match(migration, /ADD `data_nascimento` text/);
  assert.match(migration, /ADD `data_entrada` text/);
  assert.match(migration, /ADD `arquivado_em` text/);
});

test("shows the general register separately from competition filters", async () => {
  const pilotsScreen = await readFile(
    new URL("../components/pilots-screen.tsx", import.meta.url),
    "utf8",
  );

  assert.match(pilotsScreen, /const GENERAL_COMPETITION = "__cadastro_geral__"/);
  assert.match(
    pilotsScreen,
    /label:"Cadastro geral"/,
  );
  assert.match(
    pilotsScreen,
    /useState\(GENERAL_COMPETITION\)/,
  );
});

test("keeps division changes in sync and counts every pilot filter", async () => {
  const pilotsScreen = await readFile(
    new URL("../components/pilots-screen.tsx", import.meta.url),
    "utf8",
  );

  assert.match(pilotsScreen, /const \[racePilots, setRacePilots\] = useState\(raceData\.pilotos\)/);
  assert.match(pilotsScreen, /onMembershipChange\(pilotId, temporadaId, serie, situacao\)/);
  assert.match(pilotsScreen, /setRacePilots\(\(current\) =>/);
  assert.match(pilotsScreen, /pilotFilterOptions\.map\(\(option\) =>/);
  assert.match(pilotsScreen, /item\.label\+" · "\+\(pilotFilterCounts\[item\.value\]\?\?0\)/);
});

test("includes queue records in the general all-pilots view", async () => {
  const pilotsScreen = await readFile(
    new URL("../components/pilots-screen.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    pilotsScreen,
    /filter === "todos" && showingGeneralRegister[\s\S]*?\[\.\.\.pilotos, \.\.\.fila\]/,
  );
});

test("requires an administrator to approve access requests", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const accessRoute = await readFile(
    new URL("../app/api/acessos/[id]/route.ts", import.meta.url),
    "utf8",
  );
  const migration = await readFile(
    new URL("../drizzle/0009_aberrant_crusher_hogan.sql", import.meta.url),
    "utf8",
  );

  assert.match(page, /ensureCurrentAccessRequest\(user\)/);
  assert.match(page, /getPendingAccessRequests\(\)/);
  assert.match(accessRoute, /access\.papel !== "administrador"/);
  assert.match(accessRoute, /não pode aprovar o próprio acesso/);
  assert.match(migration, /CREATE TABLE `solicitacoes_acesso`/);
});

test("organizes race configuration and preserves grid departure history", async () => {
  const raceEntry = await readFile(
    new URL("../components/race-entry-screen.tsx", import.meta.url),
    "utf8",
  );
  const configRoute = await readFile(
    new URL("../app/api/configuracao-corrida/route.ts", import.meta.url),
    "utf8",
  );
  const racesQuery = await readFile(
    new URL("../db/races.ts", import.meta.url),
    "utf8",
  );

  assert.match(raceEntry, /label="Gerenciar"/);
  assert.match(raceEntry, /export function PilotCompetitionConfig/);
  assert.match(raceEntry, /mode="competition"/);
  assert.match(raceEntry, /Adicionar piloto à competição/);
  assert.match(raceEntry, /value:"remover_inscricao",label:"Retirar do grid"/);
  assert.match(raceEntry, /Código interno \(opcional\)/);
  assert.match(raceEntry, /onOpenPilot\?\.\(pilot\.id\)/);
  assert.match(configRoute, /slugCode\(nome,30,false\)/);
  assert.match(configRoute, /situacao='saiu',saida_em=/);
  assert.match(racesQuery, /'fila' AS kind/);
});

test("exports spreadsheets and configures capacity and calendars by division", async () => {
  const [pilots, cash, races, bulletin, schema] = await Promise.all([
    readFile(new URL("../components/pilots-screen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/cash-screen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/races.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/bulletin-screen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.match(pilots, /downloadXlsx/);
  assert.match(cash, /Exportar quem falta pagar/);
  assert.match(races, /limitePilotos/);
  assert.match(schema, /dataInicio/);
  assert.match(bulletin, /Baixar PDF \{orientation\}/);
  assert.match(bulletin, /rows\.forEach/);
});

test("merges recadastro data and prepares WhatsApp group messages", async () => {
  const pilotsScreen = await readFile(
    new URL("../components/pilots-screen.tsx", import.meta.url),
    "utf8",
  );
  const groups = await readFile(
    new URL("../lib/whatsapp-groups.ts", import.meta.url),
    "utf8",
  );
  const migration = await readFile(
    new URL("../drizzle/0008_ordinary_captain_stacy.sql", import.meta.url),
    "utf8",
  );

  assert.match(pilotsScreen, /registrationMatchScore/);
  assert.match(pilotsScreen, /Mesclar com/);
  assert.match(pilotsScreen, /Somente campos preenchidos neste formulário/);
  assert.match(pilotsScreen, /Abrir mensagem no WhatsApp/);
  assert.match(pilotsScreen, /setFormularios\(\(current\) =>/);
  assert.match(pilotsScreen, /item\.formularioId !== selected\.formularioId/);
  assert.match(pilotsScreen, /Enviar grupo no WhatsApp/);
  assert.match(groups, /Jz9Zg4z1q302rXOlaI8KKk/);
  assert.match(groups, /ImrTHHzRHIQGkR8EWxMyCN/);
  assert.match(groups, /C8ew4ceVlso6eb5zsslz7f/);
  assert.match(groups, /GJGDoPbPMtUGtKgMmknET9/);
  assert.match(migration, /divisoes.*whatsapp_group_url/);
  assert.match(migration, /temporadas.*whatsapp_group_url/);
});

test("builds bulletin, cash and queue as active screens", async () => {
  const pilotsScreen = await readFile(
    new URL("../components/pilots-screen.tsx", import.meta.url),
    "utf8",
  );
  const bulletin = await readFile(
    new URL("../components/bulletin-screen.tsx", import.meta.url),
    "utf8",
  );
  const cash = await readFile(
    new URL("../components/cash-screen.tsx", import.meta.url),
    "utf8",
  );
  const queue = await readFile(
    new URL("../components/queue-screen.tsx", import.meta.url),
    "utf8",
  );

  assert.match(pilotsScreen, /value:"boletim",label:"Boletim e exportação"/);
  assert.match(pilotsScreen, /value: "caixa", label: "Caixa", icon: CircleDollarSign, enabled: true/);
  assert.match(pilotsScreen, /value: "fila", label: "Fila", icon: ListOrdered, enabled: true/);
  assert.match(pilotsScreen, /<BulletinScreen/);
  assert.match(pilotsScreen, /<CashScreen/);
  assert.match(pilotsScreen, /<QueueScreen/);
  assert.match(bulletin, /canvas\.width = orientation==="horizontal"\?1920:1080/);
  assert.match(bulletin, /Acumulado até a etapa/);
  assert.match(cash, /Reservado para medalha/);
  assert.match(cash, /isentoPagamento/);
  assert.match(queue, /corrida 4Fun/);
  assert.match(queue, /Pronto para série ou suplência/);
});

test("builds the league panorama home with operational and sporting indicators", async () => {
  const pilotsScreen = await readFile(
    new URL("../components/pilots-screen.tsx", import.meta.url),
    "utf8",
  );
  const homeScreen = await readFile(
    new URL("../components/home-screen.tsx", import.meta.url),
    "utf8",
  );
  const pilotsQuery = await readFile(
    new URL("../db/pilots.ts", import.meta.url),
    "utf8",
  );

  assert.match(pilotsScreen, /useState<Screen>\("inicio"\)/);
  assert.match(homeScreen, /Principais números da liga/);
  assert.match(homeScreen, /Pilotos da temporada/);
  assert.match(homeScreen, /Formulários no mês/);
  assert.match(homeScreen, /Faltas e risco disciplinar/);
  assert.match(homeScreen, /Próximos 7 dias/);
  assert.match(homeScreen, /Clique em uma série para ver os nomes/);
  assert.match(pilotsQuery, /SUBSTR\(criado_em, 1, 7\) = \?/);
});

test("places the Speed GT logo at the top of exported bulletins", async () => {
  const bulletin = await readFile(
    new URL("../components/bulletin-screen.tsx", import.meta.url),
    "utf8",
  );

  assert.match(bulletin, /loadCanvasImage\("\/central\/brand\/speed-gt-brasil\.png"\)/);
  assert.match(bulletin, /context\.drawImage\(logo, 48, 42, 120, 120\)/);
  assert.match(bulletin, /context\.fillText\("BOLETIM OFICIAL", 190, 82\)/);
  assert.match(bulletin, /drawTechnicalPanel/);
});

test("stores season payment exemptions and excludes them from pending payment", async () => {
  const payments = await readFile(
    new URL("../app/api/pilotos/[id]/pagamentos/route.ts", import.meta.url),
    "utf8",
  );
  const pilotsQuery = await readFile(
    new URL("../db/pilots.ts", import.meta.url),
    "utf8",
  );
  const migration = await readFile(
    new URL("../drizzle/0011_brainy_korg.sql", import.meta.url),
    "utf8",
  );

  assert.match(payments, /export async function PATCH/);
  assert.match(payments, /SET pagamento_isento = \?/);
  assert.match(payments, /!isentoPagamento && totalPago < 2_000/);
  assert.match(pilotsQuery, /!Boolean\(row\.pagamento_isento\)/);
  assert.match(migration, /ADD `pagamento_isento` integer DEFAULT false NOT NULL/);
});
