"use client";

import {
  AlertTriangle,
  ArrowRight,
  Cake,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Flag,
  Grid3X3,
  ShieldAlert,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import { useState } from "react";

import type { AccessRequest } from "@/db/access";
import type {
  MonthlyFormStats,
  PendingFormListItem,
  PilotListItem,
  QueueListItem,
} from "@/db/pilots";
import type {
  RaceCompetition,
  RaceDivision,
  RacePilot,
  RaceResult,
  RaceStage,
} from "@/db/races";
import { cn } from "@/lib/utils";

type HomeDestination = "pilotos" | "corrida" | "classificacao" | "boletim" | "caixa" | "fila";
type PilotLink = Pick<PilotListItem, "id" | "apelido">;

type Props = {
  access: { papel: "administrador" | "coordenador"; serie: string | null };
  pilots: PilotListItem[];
  queue: QueueListItem[];
  forms: PendingFormListItem[];
  formStats: MonthlyFormStats;
  competitions: RaceCompetition[];
  divisions: RaceDivision[];
  stages: RaceStage[];
  racePilots: RacePilot[];
  results: RaceResult[];
  accessRequests: AccessRequest[];
  onNavigate: (screen: HomeDestination) => void;
  onCopyRegistration: () => void;
  registrationCopied: boolean;
  onOpenPilot: (id: string) => void;
};

export function HomeScreen({
  access,
  pilots,
  queue,
  forms,
  formStats,
  competitions,
  divisions,
  stages,
  racePilots,
  results,
  accessRequests,
  onNavigate,
  onCopyRegistration,
  registrationCopied,
  onOpenPilot,
}: Props) {
  const [openDivision, setOpenDivision] = useState<string | null>(null);
  const activeCompetition = competitions.find((competition) => competition.status === "ativa");
  const competitionStages = stages
    .filter((stage) => stage.temporadaId === activeCompetition?.id)
    .sort((a, b) => a.etapa - b.etapa);
  const competitionResults = results.filter(
    (result) => result.temporadaId === activeCompetition?.id,
  );
  const completedStages = [...new Set(
    competitionResults
      .filter((result) => result.posicaoFinal !== null || result.compareceu !== null)
      .map((result) => result.etapa),
  )].sort((a, b) => a - b);
  const latestCompletedStage = completedStages.at(-1) ?? null;
  const nextStage =
    competitionStages.find((stage) => !completedStages.includes(stage.etapa)) ?? null;
  const enrolledRacePilots = racePilots.filter(
    (pilot) =>
      pilot.temporadaId === activeCompetition?.id &&
      (pilot.situacao ?? "ativo") === "ativo" &&
      !pilot.pilotoArquivado,
  );
  const substitutePilots = racePilots.filter(
    (pilot) =>
      pilot.temporadaId === activeCompetition?.id &&
      pilot.situacao === "suplente" &&
      !pilot.pilotoArquivado,
  );
  const enrolledIds = new Set(enrolledRacePilots.map((pilot) => pilot.id));
  const seasonPilots = pilots.filter((pilot) => enrolledIds.has(pilot.id));
  const pendingPayments = seasonPilots.filter((pilot) => pilot.inscricaoPendente);
  const activeQueue = queue.filter((person) => !person.arquivadoEm);
  const knownAttendance = competitionResults.filter((result) => result.compareceu !== null);
  const presentCount = knownAttendance.filter((result) => result.compareceu).length;
  const attendanceRate = knownAttendance.length
    ? Math.round((presentCount / knownAttendance.length) * 100)
    : 0;
  const activeDivisions = divisions
    .filter(
      (division) =>
        division.temporadaId === activeCompetition?.id && division.status === "ativa",
    )
    .sort((a, b) => a.ordem - b.ordem);
  const nextRaces = activeDivisions
    .map((division) => {
      const ids = new Set(enrolledRacePilots.filter((pilot) => pilot.serie === division.codigo).map((pilot) => pilot.id));
      const completed = new Set(competitionResults.filter((result) => ids.has(result.pilotoId) && (result.posicaoFinal !== null || result.compareceu !== null)).map((result) => result.etapa));
      const stage = competitionStages.find((item) => !completed.has(item.etapa));
      if (!stage) return null;
      return { division, stage, date: divisionStageDate(division, stage) };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => (a.date ?? "9999-12-31").localeCompare(b.date ?? "9999-12-31") || a.division.ordem - b.division.ordem);
  const nextRace = nextRaces[0] ?? null;
  const vacancies = activeDivisions.reduce((total, division) => {
    const occupied = enrolledRacePilots.filter((pilot) => pilot.serie === division.codigo).length;
    return total + Math.max(0, divisionCapacity(division, activeCompetition) - occupied);
  }, 0);
  const disciplinaryRisk = getDisciplinaryRisk(
    seasonPilots,
    competitionResults,
  );
  const relegationRisk = getRelegationRisk(
    activeDivisions,
    enrolledRacePilots,
    competitionResults,
    latestCompletedStage,
  );
  const movement = getLargestMovement(
    activeDivisions,
    enrolledRacePilots,
    competitionResults,
    latestCompletedStage,
  );
  const importantDates = getImportantDates(seasonPilots, competitionStages);

  return (
    <main className="mx-auto max-w-6xl px-3 pb-28 md:px-6 md:pb-12">
      <section className="grid gap-4 border-b border-border py-5 lg:grid-cols-[1.45fr_.75fr]">
        <div className="relative overflow-hidden border border-border bg-[#131722] p-5 sm:p-6">
          <div className="absolute inset-y-0 right-0 w-1/3 bg-[linear-gradient(135deg,transparent_32%,rgba(229,255,0,.08)_32%,rgba(229,255,0,.08)_36%,transparent_36%,transparent_54%,rgba(229,255,0,.05)_54%,rgba(229,255,0,.05)_58%,transparent_58%)]" aria-hidden="true" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#60A5FA]">Panorama geral</p>
            <h1 className="font-display mt-2 max-w-2xl text-4xl font-bold uppercase leading-[.92] sm:text-6xl">
              {activeCompetition?.nome ?? "Central da liga"}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              {access.papel === "administrador"
                ? "Operação da liga, evolução esportiva e pontos que precisam de atenção agora."
                : `Visão da temporada para a coordenação da Série ${access.serie ?? "—"}.`}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <ActionButton label="Lançar corrida" icon={Flag} onClick={() => onNavigate("corrida")} primary />
              <ActionButton label="Ver classificação" icon={Trophy} onClick={() => onNavigate("classificacao")} />
            </div>
          </div>
        </div>

        <article className="border-l-4 border-[#00E676] bg-[#131722] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#73FFB0]">Etapa atual</p>
              <h2 className="font-display mt-2 text-3xl font-bold uppercase leading-none">
                {nextRace ? `${nextRace.stage.etapa}ª · ${nextRace.stage.pista}` : "Temporada concluída"}
              </h2>
            </div>
            <CalendarDays className="size-6 shrink-0 text-[#00E676]" aria-hidden="true" />
          </div>
          {nextRace ? (
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 text-sm">
              <StageDetail label="Série" value={nextRace.division.nome} />
              <StageDetail label="Data" value={formatDate(nextRace.date)} />
              <StageDetail label="Contagem" value={countdownLabel(nextRace.date)} />
              <StageDetail label="Duração" value={nextRace.stage.duracao || "A definir"} />
              <StageDetail label="Formato" value={nextRace.stage.classeOuFormato || "Livre"} />
              <StageDetail label="Progresso" value={`${completedStages.length}/${competitionStages.length} etapas`} />
            </dl>
          ) : (
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              {competitionStages.length ? `${completedStages.length} etapas registradas.` : "Calendário ainda não configurado."}
            </p>
          )}
          <button type="button" onClick={() => onNavigate("corrida")} className="mt-5 flex min-h-11 w-full items-center justify-between border-t border-border pt-3 text-sm font-bold text-[#73FFB0] outline-none focus-visible:ring-2 focus-visible:ring-[#00E676]">
            Abrir controle da corrida <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </article>
      </section>

      <section className="grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" aria-label="Principais números da liga">
        <BigNumber icon={Users} label="Pilotos da temporada" value={String(seasonPilots.length)} detail={`${activeDivisions.length} séries ativas`} tone="#60A5FA" onClick={() => onNavigate("pilotos")} />
        <BigNumber icon={CreditCard} label="Inscrição pendente" value={String(pendingPayments.length)} detail="Sem pagamento ou isenção" tone={pendingPayments.length ? "#E8604C" : "#00E676"} onClick={() => onNavigate("caixa")} />
        <BigNumber icon={ClipboardCheck} label="Formulários no mês" value={String(formStats.total)} detail={`${formStats.applied} mesclados/cadastrados · ${formStats.pending} pendentes`} tone="#00E676" onClick={() => onNavigate("pilotos")} />
        <BigNumber icon={Flag} label="Próxima corrida" value={nextRace ? countdownLabel(nextRace.date) : "—"} detail={nextRace ? `${nextRace.division.nome} · ${nextRace.stage.pista}` : "Calendário concluído"} tone="#60A5FA" onClick={() => onNavigate("corrida")} />
        <BigNumber icon={CheckCircle2} label="Presença geral" value={`${attendanceRate}%`} detail={`${presentCount} presenças registradas`} tone="#00E676" onClick={() => onNavigate("classificacao")} />
        <BigNumber icon={TrendingUp} label="Risco de rebaixamento" value={String(relegationRisk.length)} detail="Últimas 5 posições por série" tone="#E8604C" onClick={() => onNavigate("classificacao")} />
      </section>

      <section className="border-t border-border pt-5">
        <SectionHeading eyebrow="Atenção agora" title="Alertas prioritários" detail="Pendências e riscos que pedem ação" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AlertCard icon={ClipboardCheck} title="Formulários aguardando análise" value={forms.length} detail={`${formStats.total} recebidos no mês · ${formStats.discarded} descartados`} tone="#60A5FA" onClick={() => onNavigate("pilotos")} />
          <AlertCard icon={CreditCard} title="Inscrições sem pagamento" value={pendingPayments.length} detail="Pilotos sem pagamento ou isenção" people={pendingPayments} tone="#E8604C" onOpenPilot={onOpenPilot} onClick={() => onNavigate("caixa")} />
          <AlertCard icon={ShieldAlert} title="Faltas e risco disciplinar" value={disciplinaryRisk.length} detail="2+ faltas injustificadas ou punição" people={disciplinaryRisk} tone="#E8604C" onOpenPilot={onOpenPilot} onClick={() => onNavigate("classificacao")} />
          <AlertCard icon={Grid3X3} title="Vagas livres nas séries" value={vacancies} detail={`${activeQueue.filter((person) => person.prontoParaSerie).length} pessoas prontas na fila`} tone="#00E676" onClick={() => onNavigate("fila")} />
          <AlertCard icon={UserCheck} title="Suplentes para a Série C" value={substitutePilots.length} detail="Lista de interessados mais quentes" people={substitutePilots} tone="#60A5FA" onOpenPilot={onOpenPilot} onClick={() => onNavigate("pilotos")} />
          <AlertCard icon={UserCheck} title="Acessos aguardando aprovação" value={accessRequests.length} detail={access.papel === "administrador" ? "Solicitações pendentes de revisão" : "Visível somente para administradores"} tone="#60A5FA" onClick={() => onNavigate("pilotos")} />
          <AlertCard icon={TrendingUp} title="Faixa de rebaixamento" value={relegationRisk.length} detail="Posições provisórias de maior risco" people={relegationRisk} tone="#E8604C" onOpenPilot={onOpenPilot} onClick={() => onNavigate("classificacao")} />
        </div>
      </section>

      <section className="grid gap-6 border-t border-border pt-6 lg:grid-cols-[1.2fr_.8fr]">
        <div>
          <SectionHeading eyebrow="Ocupação dos grids" title="Pilotos por série" detail="Clique em uma série para ver os nomes" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activeDivisions.map((division) => {
              const divisionPilots = enrolledRacePilots
                .filter((pilot) => pilot.serie === division.codigo)
                .sort((a, b) => a.apelido.localeCompare(b.apelido, "pt-BR"));
              const capacity = divisionCapacity(division, activeCompetition);
              const percent = capacity ? Math.min(100, (divisionPilots.length / capacity) * 100) : 0;
              const expanded = openDivision === division.codigo;
              return (
                <article key={division.codigo} className="border border-border bg-[#131722]">
                  <button type="button" aria-expanded={expanded} onClick={() => setOpenDivision(expanded ? null : division.codigo)} className="w-full p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">{division.nome}</p>
                        <strong className="font-data mt-2 block text-3xl">{divisionPilots.length}<span className="text-base text-muted-foreground">/{capacity || "—"}</span></strong>
                      </div>
                      <span className="size-3" style={{ backgroundColor: division.cor ?? "#8A92A6" }} aria-label={`Cor da ${division.nome}`} />
                    </div>
                    <div className="mt-4 h-1 bg-[#0D1118]" aria-hidden="true"><div className="h-full" style={{ width: `${percent}%`, backgroundColor: division.cor ?? "#8A92A6" }} /></div>
                    <p className="mt-2 flex items-center justify-between text-xs text-muted-foreground"><span>{capacity ? `${Math.max(0, capacity - divisionPilots.length)} vagas livres` : "Capacidade não definida"}</span><span className="text-[#60A5FA]">{expanded ? "Ocultar" : "Ver pilotos"}</span></p>
                  </button>
                  {expanded && (
                    <div className="border-t border-border px-3 py-2">
                      {divisionPilots.map((pilot) => (
                        <button key={pilot.id} type="button" onClick={() => onOpenPilot(pilot.id)} className="flex min-h-10 w-full items-center justify-between border-b border-border px-1 text-left text-sm outline-none last:border-b-0 hover:text-[#60A5FA] focus-visible:ring-2 focus-visible:ring-[#60A5FA]">
                          <span className="font-semibold">{pilot.apelido}</span><span className="font-data text-[10px] text-muted-foreground">{pilot.id}</span>
                        </button>
                      ))}
                      {!divisionPilots.length && <p className="py-2 text-sm text-muted-foreground">Nenhum piloto nesta série.</p>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <div className="mt-4 border-l-4 border-[#60A5FA] bg-[#131722] p-4">
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#60A5FA]">Divisão de suplentes</p>
            <h3 className="font-display mt-1 text-2xl font-bold uppercase">Prontos para cobrir ausências na Série C</h3>
            <div className="mt-3 flex flex-wrap gap-2">{substitutePilots.map((pilot)=><button key={pilot.id} type="button" onClick={()=>onOpenPilot(pilot.id)} className="min-h-9 border border-border px-3 text-sm font-semibold hover:border-[#60A5FA]">{pilot.apelido}</button>)}{!substitutePilots.length&&<span className="text-sm text-muted-foreground">Nenhum suplente marcado.</span>}</div>
          </div>
        </div>

        <div>
          <SectionHeading eyebrow="Próximos 7 dias" title="Datas importantes" detail="Aniversários e próximas corridas" />
          <div className="border-y border-border">
            {importantDates.map((item) => (
              <button key={item.key} type="button" onClick={item.pilotId ? () => onOpenPilot(item.pilotId!) : () => onNavigate("corrida")} className="flex min-h-16 w-full items-center gap-3 border-b border-border bg-[#131722] px-3 text-left outline-none last:border-b-0 hover:bg-[#19202A] focus-visible:ring-2 focus-visible:ring-[#60A5FA]">
                <span className="flex size-10 shrink-0 items-center justify-center border border-border text-[#60A5FA]">{item.kind === "corrida" ? <Flag className="size-5" aria-hidden="true" /> : <Cake className="size-5" aria-hidden="true" />}</span>
                <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.title}</strong><span className="mt-1 block truncate text-xs text-muted-foreground">{item.detail}</span></span>
                <span className="font-data shrink-0 text-xs text-[#60A5FA]">{item.when}</span>
              </button>
            ))}
            {!importantDates.length && <p className="bg-[#131722] p-4 text-sm text-muted-foreground">Nenhum aniversário ou corrida nos próximos 7 dias.</p>}
          </div>
        </div>
      </section>

      <section className="border-t border-border pt-6">
        <SectionHeading eyebrow="Evolução da temporada" title="Desempenho esportivo" detail="Ocupação, presença e movimentação na classificação" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <EvolutionCard label="Ocupação geral" value={`${seasonPilots.length}/${activeDivisions.reduce((sum, division)=>sum+divisionCapacity(division,activeCompetition),0) || "—"}`} detail={`${vacancies} vagas livres`} progress={((seasonPilots.length / Math.max(1, activeDivisions.reduce((sum, division)=>sum+divisionCapacity(division,activeCompetition),0))) * 100)} />
          <EvolutionCard label="Presença geral" value={`${attendanceRate}%`} detail={`${knownAttendance.length - presentCount} faltas registradas`} progress={attendanceRate} />
          <EvolutionCard label="Etapas concluídas" value={`${completedStages.length}/${competitionStages.length}`} detail={nextStage ? `Próxima: ${nextStage.pista}` : "Calendário concluído"} progress={(completedStages.length / Math.max(1, competitionStages.length)) * 100} />
          <EvolutionCard label="Maior avanço recente" value={movement ? `+${movement.places}` : "—"} detail={movement ? `${movement.apelido} · ${movement.division}` : "Aguardando duas etapas com pontos"} progress={movement ? Math.min(100, movement.places * 20) : 0} />
        </div>
        {access.papel === "administrador" && (
          <button type="button" onClick={onCopyRegistration} className="mt-4 flex min-h-12 w-full items-center justify-between border border-[#60A5FA] px-4 text-sm font-bold text-[#60A5FA] outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] sm:w-auto sm:min-w-64">
            {registrationCopied ? "Link de cadastro copiado" : "Copiar link de cadastro"}<ArrowRight className="size-4" aria-hidden="true" />
          </button>
        )}
      </section>
    </main>
  );
}

function ActionButton({ label, icon: Icon, onClick, primary = false }: { label: string; icon: typeof Flag; onClick: () => void; primary?: boolean }) {
  return <button type="button" onClick={onClick} className={cn("flex min-h-11 items-center gap-2 px-4 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]", primary ? "bg-[#60A5FA] text-[#0A0C10]" : "border border-border text-foreground")}><Icon className="size-4" aria-hidden="true" />{label}</button>;
}

function BigNumber({ icon: Icon, label, value, detail, tone, onClick }: { icon: typeof Users; label: string; value: string; detail: string; tone: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group border-l-4 bg-[#131722] p-4 text-left outline-none hover:bg-[#19202A] focus-visible:ring-2 focus-visible:ring-[#60A5FA]" style={{ borderColor: tone }}><Icon className="size-5" style={{ color: tone }} aria-hidden="true" /><span className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</span><strong className="font-data mt-1 block text-2xl">{value}</strong><span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{detail}</span></button>;
}

function AlertCard({ icon: Icon, title, value, detail, people = [], tone, onClick, onOpenPilot }: { icon: typeof AlertTriangle; title: string; value: number; detail: string; people?: PilotLink[]; tone: string; onClick: () => void; onOpenPilot?: (id: string) => void }) {
  return <article className="border-t-2 bg-[#131722] p-4" style={{ borderColor: tone }}><button type="button" onClick={onClick} className="flex w-full items-start gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]"><Icon className="mt-0.5 size-5 shrink-0" style={{ color: tone }} aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block text-xs font-semibold uppercase tracking-[.08em] text-muted-foreground">{title}</span><strong className="font-data mt-1 block text-3xl">{value}</strong><span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span></span><ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /></button>{people.length > 0 && onOpenPilot && <div className="mt-3 flex flex-wrap gap-1 border-t border-border pt-3">{people.slice(0, 4).map((pilot) => <button key={pilot.id} type="button" onClick={() => onOpenPilot(pilot.id)} className="min-h-8 border border-border px-2 text-xs font-semibold hover:border-[#60A5FA] hover:text-[#60A5FA]">{pilot.apelido}</button>)}{people.length > 4 && <span className="flex min-h-8 items-center px-1 text-xs text-muted-foreground">+{people.length - 4}</span>}</div>}</article>;
}

function EvolutionCard({ label, value, detail, progress }: { label: string; value: string; detail: string; progress: number }) {
  return <article className="border border-border bg-[#131722] p-4"><span className="text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground">{label}</span><strong className="font-data mt-2 block text-2xl">{value}</strong><div className="mt-4 h-1 bg-[#0D1118]" aria-hidden="true"><div className="h-full bg-[#60A5FA]" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div><span className="mt-2 block text-xs text-muted-foreground">{detail}</span></article>;
}

function SectionHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{eyebrow}</p><h2 className="font-display mt-1 text-3xl font-bold uppercase">{title}</h2></div><p className="text-xs text-muted-foreground">{detail}</p></div>;
}

function StageDetail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>;
}

function getDisciplinaryRisk(pilots: PilotListItem[], results: RaceResult[]) {
  return pilots.filter((pilot) => {
    const pilotResults = results.filter((result) => result.pilotoId === pilot.id);
    const unjustifiedAbsences = pilotResults.filter(
      (result) => result.compareceu === false && result.faltaJustificada !== true,
    ).length;
    return unjustifiedAbsences >= 2 || pilotResults.some((result) => Boolean(result.punicao?.trim()));
  });
}

function getRelegationRisk(divisions: RaceDivision[], pilots: RacePilot[], results: RaceResult[], latestStage: number | null) {
  if (latestStage === null) return [];
  const riskyIds = new Set<string>();
  for (const division of divisions) {
    const divisionPilots = pilots.filter((pilot) => pilot.serie === division.codigo);
    if (divisionPilots.length < 4) continue;
    const ranked = divisionPilots
      .map((pilot) => ({ id: pilot.id, points: results.filter((result) => result.pilotoId === pilot.id).reduce((sum, result) => sum + result.pontos, 0) }))
      .sort((a, b) => b.points - a.points);
    ranked.slice(-5).forEach((pilot) => riskyIds.add(pilot.id));
  }
  return pilotsFromIds(pilots, riskyIds);
}

function getLargestMovement(divisions: RaceDivision[], pilots: RacePilot[], results: RaceResult[], latestStage: number | null) {
  if (latestStage === null || !results.some((result) => result.etapa < latestStage)) return null;
  let best: { apelido: string; division: string; places: number } | null = null;
  for (const division of divisions) {
    const divisionPilots = pilots.filter((pilot) => pilot.serie === division.codigo);
    const rank = (beforeLatest: boolean) => divisionPilots
      .map((pilot) => ({ pilot, points: results.filter((result) => result.pilotoId === pilot.id && (!beforeLatest || result.etapa < latestStage)).reduce((sum, result) => sum + result.pontos, 0) }))
      .sort((a, b) => b.points - a.points)
      .map((item) => item.pilot.id);
    const current = rank(false);
    const previous = rank(true);
    current.forEach((id, index) => {
      const places = previous.indexOf(id) - index;
      const pilot = divisionPilots.find((item) => item.id === id);
      if (pilot && places > 0 && (!best || places > best.places)) best = { apelido: pilot.apelido, division: division.nome, places };
    });
  }
  return best;
}

function pilotsFromIds(racePilots: RacePilot[], ids: Set<string>): PilotLink[] {
  return racePilots.filter((pilot) => ids.has(pilot.id)).map((pilot) => ({ id: pilot.id, apelido: pilot.apelido }));
}

function getImportantDates(pilots: PilotListItem[], stages: RaceStage[]) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  const todayParts = formatter.formatToParts(new Date());
  const read = (type: string) => Number(todayParts.find((part) => part.type === type)?.value ?? 0);
  const today = Date.UTC(read("year"), read("month") - 1, read("day"));
  const output: Array<{ key: string; kind: "aniversario" | "liga" | "corrida"; title: string; detail: string; when: string; date: number; pilotId?: string }> = [];
  const addAnniversary = (pilot: PilotListItem, value: string | null, kind: "aniversario" | "liga") => {
    if (!value) return;
    const [, month, day] = value.split("-").map(Number);
    let occurrence = Date.UTC(read("year"), month - 1, day);
    if (occurrence < today) occurrence = Date.UTC(read("year") + 1, month - 1, day);
    const days = Math.round((occurrence - today) / 86_400_000);
    if (days > 7) return;
    const years = Math.max(0, new Date(occurrence).getUTCFullYear() - Number(value.slice(0, 4)));
    output.push({ key: `${kind}-${pilot.id}`, kind, title: kind === "aniversario" ? `Aniversário · ${pilot.apelido}` : `Aniversário na liga · ${pilot.apelido}`, detail: kind === "aniversario" ? "Data de nascimento" : `${years} ${years === 1 ? "ano" : "anos"} na Speed GT Brasil`, when: days === 0 ? "Hoje" : days === 1 ? "Amanhã" : `${days} dias`, date: occurrence, pilotId: pilot.id });
  };
  pilots.forEach((pilot) => { addAnniversary(pilot, pilot.dataNascimento, "aniversario"); addAnniversary(pilot, pilot.dataEntrada, "liga"); });
  stages.forEach((stage) => {
    if (!stage.data) return;
    const [year, month, day] = stage.data.split("-").map(Number);
    const date = Date.UTC(year, month - 1, day);
    const days = Math.round((date - today) / 86_400_000);
    if (days < 0 || days > 7) return;
    output.push({ key: `corrida-${stage.temporadaId}-${stage.etapa}`, kind: "corrida", title: `${stage.etapa}ª etapa · ${stage.pista}`, detail: [stage.classeOuFormato, stage.duracao].filter(Boolean).join(" · ") || "Detalhes a definir", when: days === 0 ? "Hoje" : days === 1 ? "Amanhã" : `${days} dias`, date });
  });
  return output.sort((a, b) => a.date - b.date || a.title.localeCompare(b.title, "pt-BR"));
}

function formatDate(value: string | null) {
  if (!value) return "A definir";
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function divisionCapacity(division: RaceDivision, competition?: RaceCompetition) {
  return division.limitePilotos ?? competition?.pilotosPorSerie ?? 0;
}

function divisionStageDate(division: RaceDivision, stage: RaceStage) {
  const start = division.dataInicio ??
    (division.temporadaId === "2026"
      ? division.codigo === "A" ? "2026-10-06" : division.codigo === "B" || division.codigo === "C" ? "2026-10-05" : null
      : null);
  if (!start) return stage.data;
  const [year, month, day] = start.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + (stage.etapa - 1) * (division.frequenciaDias || 7)));
  return date.toISOString().slice(0, 10);
}

function countdownLabel(value: string | null) {
  if (!value) return "A definir";
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = formatter.formatToParts(new Date());
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const today = Date.UTC(read("year"), read("month") - 1, read("day"));
  const [year, month, day] = value.split("-").map(Number);
  const days = Math.ceil((Date.UTC(year, month - 1, day) - today) / 86_400_000);
  if (days < 0) return "Data passada";
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  return `${days} dias`;
}
