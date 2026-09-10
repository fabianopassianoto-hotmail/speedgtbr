"use client";

import { ArrowDown, ArrowUp, Minus, Trophy, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

import type {
  RaceCompetition,
  RaceDivision,
  RacePilot,
  RaceResult,
  RaceStage,
} from "@/db/races";
import {
  buildStandings,
  disciplineLabel,
  type StandingRow,
} from "@/db/standings";
import { FilterChips } from "@/components/filter-chips";
import { cn } from "@/lib/utils";

type Props = {
  competitions: RaceCompetition[];
  divisions: RaceDivision[];
  stages: RaceStage[];
  pilots: RacePilot[];
  results: RaceResult[];
  onOpenPilot: (id: string) => void;
};

export function StandingsScreen({
  competitions,
  divisions,
  stages,
  pilots,
  results,
  onOpenPilot,
}: Props) {
  const availableCompetitions = useMemo(
    () =>
      competitions.filter(
        (competition) =>
          competition.geraClassificacao && competition.status !== "cancelada",
      ),
    [competitions],
  );
  const firstCompetition =
    availableCompetitions.find((competition) => competition.status === "ativa") ??
    availableCompetitions[0];
  const [divisionFilter,setDivisionFilter]=useState("todas");
  const [competitionId, setCompetitionId] = useState(firstCompetition?.id ?? "");
  const competition =
    availableCompetitions.find((entry) => entry.id === competitionId) ??
    firstCompetition;
  const selectedDivisions = useMemo(
    () =>
      divisions
        .filter(
          (division) =>
            division.temporadaId === competition?.id &&
            division.status !== "cancelada",
        )
        .sort((first, second) => first.ordem - second.ordem),
    [competition?.id, divisions],
  );
  const selectedStages = useMemo(
    () =>
      stages
        .filter((stage) => stage.temporadaId === competition?.id)
        .sort((first, second) => first.etapa - second.etapa),
    [competition?.id, stages],
  );
  const selectedResults = useMemo(
    () => results.filter((result) => result.temporadaId === competition?.id),
    [competition?.id, results],
  );

  if (!competition) {
    return (
      <EmptyState
        title="Nenhuma competição com classificação"
        detail="Crie ou reative uma competição que gere pontos para consultar a classificação."
      />
    );
  }

  const championshipStarted = selectedResults.length > 0;

  return (
    <main className="mx-auto max-w-6xl px-3 pb-28 md:px-6 md:pb-12">
      <section className="sticky top-0 z-30 -mx-3 border-b border-border bg-background/95 px-3 pb-3 pt-4 backdrop-blur md:-mx-6 md:px-6 md:pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#60A5FA]">
          Campeonato
        </p>
        <div className="mt-1 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <h1 className="font-display text-4xl font-bold uppercase leading-none md:text-5xl">
            Classificação
          </h1>
          <FilterChips label="Competição" value={competition.id} onChange={v=>{setCompetitionId(v);setDivisionFilter("todas")}} options={availableCompetitions.map(c=>({value:c.id,label:c.nome}))}/>
        </div>
        <div className="mt-3"><FilterChips label="Divisão" value={divisionFilter} onChange={setDivisionFilter} options={[{value:"todas",label:"Todas"},...selectedDivisions.map(d=>({value:d.codigo,label:d.nome}))]}/></div>
      </section>

      {!championshipStarted ? (
        <ChampionshipNotStarted
          divisions={selectedDivisions.filter(d=>divisionFilter==="todas"||d.codigo===divisionFilter)}
          pilots={pilots.filter(
            (pilot) =>
              pilot.temporadaId === competition.id &&
              pilot.situacao !== "saiu" &&
              !pilot.pilotoArquivado,
          )}
          onOpenPilot={onOpenPilot}
        />
      ) : (
        <div className="space-y-6 pt-4">
          {selectedDivisions.filter(d=>divisionFilter==="todas"||d.codigo===divisionFilter).map((division) => {
            const divisionPilots = pilots.filter(
              (pilot) =>
                pilot.temporadaId === competition.id &&
                pilot.serie === division.codigo &&
                pilot.situacao !== "saiu" &&
                !pilot.pilotoArquivado,
            );
            const divisionResults = selectedResults.filter((result) =>
              divisionPilots.some((pilot) => pilot.id === result.pilotoId),
            );
            const rows = buildStandings(
              divisionPilots,
              divisionResults,
              selectedStages,
              competition.totalEtapas,
            );
            return (
              <DivisionStandings
                key={division.codigo}
                division={division}
                stages={selectedStages}
                rows={rows}
                started={divisionResults.length > 0}
                onOpenPilot={onOpenPilot}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}

function DivisionStandings({
  division,
  stages,
  rows,
  started,
  onOpenPilot,
}: {
  division: RaceDivision;
  stages: RaceStage[];
  rows: StandingRow[];
  started: boolean;
  onOpenPilot: (id: string) => void;
}) {
  const color = division.cor ?? "#8A92A6";
  return (
    <section aria-labelledby={`standing-${division.temporadaId}-${division.codigo}`}>
      <div className="flex items-end justify-between gap-3 border-b border-border pb-2">
        <div className="border-l-4 pl-3" style={{ borderColor: color }}>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Divisão
          </p>
          <h2
            id={`standing-${division.temporadaId}-${division.codigo}`}
            className="font-display text-3xl font-bold uppercase leading-none"
          >
            {division.nome}
          </h2>
        </div>
        <span className="font-data text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? "piloto" : "pilotos"}
        </span>
      </div>

      {started && (
        <div className="flex flex-wrap gap-2 py-3 text-xs font-semibold">
          {division.codigo !== "A" && <Legend tone="up" label="1º–5º · Sobe" />}
          <Legend
            tone="stay"
            label={division.codigo === "A" ? "1º–10º · Permanece" : "6º–10º · Permanece"}
          />
          <Legend tone="down" label="11º em diante · Desce" />
        </div>
      )}

      {!started ? (
        <div className="border-b border-border bg-[#131722] p-4">
          <p className="font-semibold">Esta divisão ainda não largou.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            O grid aparece abaixo sem pontos ou posições inventadas.
          </p>
          <GridList rows={rows} color={color} onOpenPilot={onOpenPilot} />
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead className="bg-[#0D1016] text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="w-16 px-2 py-3 text-center">Pos.</th>
                  <th className="min-w-44 px-3 py-3">Piloto</th>
                  {stages.map((stage) => (
                    <th key={stage.etapa} className="w-14 px-1 py-3 text-center" title={stage.pista}>
                      E{stage.etapa}
                    </th>
                  ))}
                  <th className="w-20 px-2 py-3 text-center">Total</th>
                  <th className="w-16 px-2 py-3 text-center">Faltas</th>
                  <th className="min-w-44 px-3 py-3">Situação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <DesktopStandingRow
                    key={row.pilot.id}
                    row={row}
                    stages={stages}
                    onOpenPilot={onOpenPilot}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 pt-3 md:hidden">
            {rows.map((row) => (
              <MobileStandingCard
                key={row.pilot.id}
                row={row}
                stages={stages}
                onOpenPilot={onOpenPilot}
              />
            ))}
          </div>
          <p className="mt-3 border-l-2 border-[#60A5FA] bg-[#131722] p-3 text-sm leading-6 text-muted-foreground">
            O total considera um descarte. Enquanto houver etapa prevista sem resultado,
            o descarte não reduz os pontos acumulados. Etapas não lançadas aparecem como
            pendentes, nunca como zero.
          </p>
        </>
      )}
    </section>
  );
}

function DesktopStandingRow({
  row,
  stages,
  onOpenPilot,
}: {
  row: StandingRow;
  stages: RaceStage[];
  onOpenPilot: (id: string) => void;
}) {
  const tone = movementTone(row.movement);
  return (
    <tr className="border-b border-border bg-[#131722]">
      <td className="relative px-2 py-3 text-center">
        <span className={cn("absolute inset-y-0 left-0 w-1", tone.bar)} />
        <strong className="font-data text-lg">{row.rank}º</strong>
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={() => onOpenPilot(row.pilot.id)}
          className="flex min-h-11 w-full items-center justify-between gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]"
        >
          <span className="min-w-0">
            <strong className="font-display block truncate text-2xl uppercase leading-none">
              {row.pilot.apelido}
            </strong>
            <span className="font-data mt-1 block truncate text-xs text-muted-foreground">
              {row.pilot.simgrid || "SimGrid pendente"}
            </span>
          </span>
          <UserRound className="size-4 shrink-0 text-[#60A5FA]" aria-hidden="true" />
        </button>
      </td>
      {stages.map((stage) => (
        <td key={stage.etapa} className="font-data px-1 py-3 text-center">
          {row.stagePoints.has(stage.etapa) ? (
            row.stagePoints.get(stage.etapa)
          ) : (
            <span className="text-xs text-muted-foreground">Pendente</span>
          )}
        </td>
      ))}
      <td className="font-data px-2 py-3 text-center text-lg font-bold text-[#60A5FA]">
        {row.total}
      </td>
      <td className="font-data px-2 py-3 text-center">{row.faults}</td>
      <td className="px-3 py-3">
        <MovementLabel movement={row.movement} />
        <p className="mt-1 text-xs text-muted-foreground">{disciplineLabel(row.faults)}</p>
      </td>
    </tr>
  );
}

function MobileStandingCard({
  row,
  stages,
  onOpenPilot,
}: {
  row: StandingRow;
  stages: RaceStage[];
  onOpenPilot: (id: string) => void;
}) {
  const tone = movementTone(row.movement);
  return (
    <article className="relative border border-border bg-[#131722] pl-2">
      <span className={cn("absolute inset-y-0 left-0 w-1", tone.bar)} />
      <div className="flex items-start gap-3 p-3">
        <span className="font-data flex size-11 shrink-0 items-center justify-center border border-border text-lg font-bold">
          {row.rank}º
        </span>
        <button
          type="button"
          onClick={() => onOpenPilot(row.pilot.id)}
          className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]"
        >
          <span className="min-w-0">
            <strong className="font-display block truncate text-3xl uppercase leading-none">
              {row.pilot.apelido}
            </strong>
            <span className="font-data mt-1 block truncate text-xs text-muted-foreground">
              {row.pilot.simgrid || "SimGrid pendente"}
            </span>
          </span>
          <UserRound className="size-5 shrink-0 text-[#60A5FA]" aria-hidden="true" />
        </button>
        <div className="text-right">
          <span className="font-data block text-2xl font-bold text-[#60A5FA]">{row.total}</span>
          <span className="text-xs uppercase text-muted-foreground">pontos</span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-px border-t border-border bg-border">
        {stages.map((stage) => (
          <div key={stage.etapa} className="min-w-0 bg-[#10141B] p-2 text-center">
            <span className="block text-xs font-semibold text-muted-foreground">E{stage.etapa}</span>
            <span className="font-data mt-1 block text-sm">
              {row.stagePoints.has(stage.etapa) ? row.stagePoints.get(stage.etapa) : "Pendente"}
            </span>
          </div>
        ))}
      </div>
      <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-2">
        <div>
          <MovementLabel movement={row.movement} />
        </div>
        <div className="text-sm">
          <strong>{row.faults} {row.faults === 1 ? "falta" : "faltas"}</strong>
          <p className="mt-1 text-muted-foreground">{disciplineLabel(row.faults)}</p>
        </div>
      </div>
    </article>
  );
}

function ChampionshipNotStarted({
  divisions,
  pilots,
  onOpenPilot,
}: {
  divisions: RaceDivision[];
  pilots: RacePilot[];
  onOpenPilot: (id: string) => void;
}) {
  return (
    <section className="pt-5">
      <div className="border-l-4 border-[#60A5FA] bg-[#131722] p-5">
        <Trophy className="size-6 text-[#60A5FA]" aria-hidden="true" />
        <h2 className="font-display mt-3 text-3xl font-bold uppercase">
          O campeonato ainda não começou
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          A classificação aparecerá após o primeiro resultado. Até lá, este é o grid cadastrado.
        </p>
      </div>
      <div className="mt-5 space-y-5">
        {divisions.map((division) => (
          <section key={division.codigo}>
            <h3 className="border-l-4 pl-3 font-display text-2xl font-bold uppercase" style={{ borderColor: division.cor ?? "#8A92A6" }}>
              {division.nome}
            </h3>
            <GridList
              rows={pilots
                .filter((pilot) => pilot.serie === division.codigo)
                .sort((first, second) => first.apelido.localeCompare(second.apelido, "pt-BR"))
                .map((pilot) => ({ pilot }))}
              color={division.cor ?? "#8A92A6"}
              onOpenPilot={onOpenPilot}
            />
          </section>
        ))}
      </div>
    </section>
  );
}

function GridList({
  rows,
  color,
  onOpenPilot,
}: {
  rows: Array<Pick<StandingRow, "pilot">>;
  color: string;
  onOpenPilot: (id: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="mt-2 border border-border bg-[#131722] p-3 text-sm text-muted-foreground">Grid vazio.</p>;
  }
  return (
    <div className="mt-2 border-y border-border">
      {rows.map((row) => (
        <button
          key={row.pilot.id}
          type="button"
          onClick={() => onOpenPilot(row.pilot.id)}
          className="relative flex min-h-14 w-full items-center gap-3 border-b border-border bg-[#131722] py-2 pl-4 pr-3 text-left last:border-b-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#60A5FA]"
        >
          <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} />
          <span className="font-data text-xs text-muted-foreground">{row.pilot.id}</span>
          <span className="min-w-0 flex-1">
            <strong className="font-display block truncate text-2xl uppercase leading-none">{row.pilot.apelido}</strong>
            <span className="font-data mt-1 block truncate text-xs text-muted-foreground">{row.pilot.simgrid || "SimGrid pendente"}</span>
          </span>
          <UserRound className="size-4 text-[#60A5FA]" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="mx-auto max-w-6xl px-3 pb-28 pt-5 md:px-6">
      <section className="border-l-4 border-[#60A5FA] bg-[#131722] p-5">
        <h1 className="font-display text-3xl font-bold uppercase">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
      </section>
    </main>
  );
}

function Legend({ tone, label }: { tone: "up" | "stay" | "down"; label: string }) {
  return (
    <span
      className={cn(
        "border px-2 py-1",
        tone === "up" && "border-[#00E676] text-[#73FFB0]",
        tone === "stay" && "border-[#8A92A6] text-[#C4C8CE]",
        tone === "down" && "border-[#E8604C] text-[#FF9A8B]",
      )}
    >
      {label}
    </span>
  );
}

function MovementLabel({ movement }: { movement: StandingRow["movement"] }) {
  const Icon = movement === "sobe" ? ArrowUp : movement === "desce" ? ArrowDown : Minus;
  const label = movement === "sobe" ? "Sobe" : movement === "desce" ? "Desce" : "Permanece";
  const tone = movementTone(movement);
  return (
    <span className={cn("inline-flex min-h-7 items-center gap-1 border px-2 text-xs font-bold uppercase", tone.label)}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}

function movementTone(movement: StandingRow["movement"]) {
  if (movement === "sobe") {
    return { bar: "bg-[#00E676]", label: "border-[#00E676] text-[#73FFB0]" };
  }
  if (movement === "desce") {
    return { bar: "bg-[#E8604C]", label: "border-[#E8604C] text-[#FF9A8B]" };
  }
  return { bar: "bg-[#8A92A6]", label: "border-[#8A92A6] text-[#C4C8CE]" };
}
