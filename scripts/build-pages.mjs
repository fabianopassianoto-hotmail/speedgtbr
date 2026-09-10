import { cp, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist-pages");
const stage = await mkdtemp(join(root, ".pages-stage-"));
const publicFiles = ["index.html", "assets", "apoie", "campeonatos", "comece-aqui", "depoimentos", "hall-da-fama", "organizadores", "por-que", "regras", "temporada-3", "_headers"];
try {
  for (const entry of publicFiles) await cp(join(root, entry), join(stage, entry), { recursive: true });
  await cp(join(root, "central/dist/client/central"), join(stage, "central"), { recursive: true });
  const worker = join(stage, "_worker.js");
  await mkdir(worker);
  await cp(join(root, "central/dist/server"), join(worker, "central"), { recursive: true, filter: source => !source.endsWith(".map") });
  await cp(join(root, "functions/api/championships/[id].js"), join(worker, "championships.js"));
  await cp(join(root, "scripts/pages-worker.mjs"), join(worker, "index.js"));
  await cp(join(root, "scripts/access-auth.mjs"), join(worker, "access-auth.mjs"));
  await writeFile(join(stage, "_routes.json"), JSON.stringify({ version: 1, include: ["/central", "/central/*", "/api/championships/*"], exclude: ["/central/assets/*", "/central/brand/*", "/central/og.png", "/central/favicon.svg"] }));
  await rm(output, { recursive: true, force: true });
  await rename(stage, output);
  console.log("Site e Central preparados em dist-pages.");
} finally {
  await rm(stage, { recursive: true, force: true });
}
