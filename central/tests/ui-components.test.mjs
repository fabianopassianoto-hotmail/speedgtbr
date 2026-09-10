import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits the catalog's animation and scrolling utilities", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /--tw-enter-opacity/);
  assert.match(css, /scrollbar-width:\s*thin/);
  assert.match(css, /scrollbar-width:\s*none/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
  assert.match(css, /scroll-fade-reveal-b/);
  assert.match(css, /mask-image:/);
  assert.match(css, /tw-shimmer/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});

test("calculates race points from the seeded scoring table", async () => {
  const { calculateRacePoints } = await vite.ssrLoadModule("/db/scoring.ts");

  assert.equal(
    calculateRacePoints({
      compareceu: true,
      posicaoFinal: 1,
      multiplicador: 2,
      voltaMaisRapida: true,
    }),
    61,
  );
  assert.equal(
    calculateRacePoints({
      compareceu: false,
      posicaoFinal: null,
      multiplicador: 1,
      voltaMaisRapida: false,
    }),
    0,
  );
});

test("calculates standings with discard, ties and disciplinary status", async () => {
  const { buildStandings, disciplineLabel } = await vite.ssrLoadModule(
    "/db/standings.ts",
  );
  const pilots = [
    { id: "SGT001", apelido: "Dans", simgrid: null, temporadaId: "2026", serie: "A", situacao: "ativo", pilotoArquivado: false },
    { id: "SGT002", apelido: "Lucas", simgrid: null, temporadaId: "2026", serie: "A", situacao: "ativo", pilotoArquivado: false },
  ];
  const stages = Array.from({ length: 7 }, (_, index) => ({
    temporadaId: "2026",
    etapa: index + 1,
    pista: `Pista ${index + 1}`,
  }));
  const result = (pilotoId, etapa, pontos, overrides = {}) => ({
    temporadaId: "2026",
    etapa,
    pilotoId,
    confirmou: null,
    compareceu: true,
    faltaJustificada: null,
    posicaoFinal: 1,
    voltaMaisRapida: false,
    punicao: null,
    abandonoMotivo: null,
    observacao: null,
    pontos,
    carro: null,
    fabricante: null,
    origemCarro: null,
    ...overrides,
  });
  const results = [
    ...[10, 20, 30, 40, 50, 60, 5].map((points, index) => result("SGT001", index + 1, points)),
    result("SGT002", 1, 205),
    result("SGT002", 2, 10, {
      confirmou: true,
      compareceu: false,
      faltaJustificada: false,
      posicaoFinal: null,
      pontos: 0,
    }),
  ];
  const rows = buildStandings(pilots, results, stages, 7);

  assert.equal(rows[0].pilot.id, "SGT001");
  assert.equal(rows[0].rawTotal, 215);
  assert.equal(rows[0].discarded, 5);
  assert.equal(rows[0].total, 210);
  assert.equal(rows[1].total, 205);
  assert.equal(rows[1].faults, 1);
  assert.equal(disciplineLabel(1), "1ª falta · etapa zerada");

  const tied = buildStandings(
    pilots,
    [result("SGT001", 1, 30), result("SGT002", 1, 30)],
    stages,
    7,
  );
  assert.deepEqual(tied.map((row) => row.rank), [1, 1]);
  assert.deepEqual(tied.map((row) => row.total), [30, 30]);
});
