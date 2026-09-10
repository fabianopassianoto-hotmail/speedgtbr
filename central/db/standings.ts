import type { RacePilot, RaceResult, RaceStage } from "@/db/races";

export type StandingMovement = "sobe" | "permanece" | "desce";

export type StandingRow = {
  pilot: RacePilot;
  rank: number;
  stagePoints: Map<number, number>;
  rawTotal: number;
  total: number;
  discarded: number;
  faults: number;
  movement: StandingMovement;
};

export function buildStandings(
  pilots: RacePilot[],
  results: RaceResult[],
  stages: RaceStage[],
  totalStages: number,
): StandingRow[] {
  const rows = pilots.map((pilot) => {
    const pilotResults = results.filter((result) => result.pilotoId === pilot.id);
    const stagePoints = new Map(pilotResults.map((result) => [result.etapa, result.pontos]));
    const rawTotal = pilotResults.reduce((sum, result) => sum + result.pontos, 0);
    const scoresForDiscard = stages.map((stage) => stagePoints.get(stage.etapa) ?? 0);
    while (scoresForDiscard.length < totalStages) scoresForDiscard.push(0);
    const discarded = scoresForDiscard.length > 0 ? Math.min(...scoresForDiscard) : 0;
    const faults = pilotResults.filter(
      (result) =>
        result.confirmou === true &&
        result.compareceu === false &&
        result.faltaJustificada === false,
    ).length;
    return {
      pilot,
      rank: 0,
      stagePoints,
      rawTotal,
      total: rawTotal - discarded,
      discarded,
      faults,
      movement: "permanece" as const,
    };
  });
  rows.sort(
    (first, second) =>
      second.total - first.total ||
      first.pilot.apelido.localeCompare(second.pilot.apelido, "pt-BR"),
  );
  let previousTotal: number | null = null;
  let previousRank = 0;
  return rows.map((row, index) => {
    const rank = previousTotal === row.total ? previousRank : index + 1;
    previousTotal = row.total;
    previousRank = rank;
    return {
      ...row,
      rank,
      movement:
        row.pilot.serie === "A"
          ? rank <= 10
            ? "permanece"
            : "desce"
          : rank <= 5
            ? "sobe"
            : rank <= 10
              ? "permanece"
              : "desce",
    };
  });
}

export function disciplineLabel(faults: number) {
  if (faults >= 3) return "3ª falta ou mais · rebaixamento indicado";
  if (faults === 2) return "2ª falta · advertência";
  if (faults === 1) return "1ª falta · etapa zerada";
  return "Sem falta não justificada";
}
