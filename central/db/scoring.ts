import { seedData } from "@/db/seed-data";

export function calculateRacePoints(input: {
  compareceu: boolean | null;
  posicaoFinal: number | null;
  multiplicador: number;
  voltaMaisRapida: boolean;
}): number {
  if (!input.compareceu || input.posicaoFinal === null) return 0;

  const pontosPosicao = seedData.pontuacao.get(input.posicaoFinal) ?? 0;
  return (
    pontosPosicao * input.multiplicador + (input.voltaMaisRapida ? 1 : 0)
  );
}
