"use client";

import { Download, FileDown, ImageDown, Share2 } from "lucide-react";
import { useMemo, useState } from "react";

import type { RaceCompetition, RaceDivision, RacePilot, RaceResult, RaceStage } from "@/db/races";
import { FilterChips } from "@/components/filter-chips";
import { buildStandings, disciplineLabel } from "@/db/standings";

type Props = {
  competitions: RaceCompetition[];
  divisions: RaceDivision[];
  stages: RaceStage[];
  pilots: RacePilot[];
  results: RaceResult[];
};

export function BulletinScreen({ competitions, divisions, stages, pilots, results }: Props) {
  const available = useMemo(
    () => competitions.filter((item) => item.status !== "cancelada" && item.geraClassificacao),
    [competitions],
  );
  const first = available.find((item) => item.status === "ativa") ?? available[0];
  const [competitionId, setCompetitionId] = useState(first?.id ?? "");
  const competition = available.find((item) => item.id === competitionId) ?? first;
  const competitionDivisions = divisions
    .filter((item) => item.temporadaId === competition?.id && item.status !== "cancelada")
    .sort((a, b) => a.ordem - b.ordem);
  const [divisionCode, setDivisionCode] = useState(competitionDivisions[0]?.codigo ?? "");
  const division = competitionDivisions.find((item) => item.codigo === divisionCode) ?? competitionDivisions[0];
  const competitionStages = stages
    .filter((item) => item.temporadaId === competition?.id)
    .sort((a, b) => a.etapa - b.etapa);
  const latestResultStage = [...competitionStages]
    .reverse()
    .find((stage) => results.some((result) => result.temporadaId === competition?.id && result.etapa === stage.etapa));
  const [stageNumber, setStageNumber] = useState(latestResultStage?.etapa ?? competitionStages[0]?.etapa ?? 1);
  const stage = competitionStages.find((item) => item.etapa === stageNumber) ?? competitionStages[0];
  const [orientation,setOrientation]=useState("vertical");
  const [message, setMessage] = useState("");

  const divisionPilots = pilots.filter(
    (pilot) =>
      pilot.temporadaId === competition?.id &&
      pilot.serie === division?.codigo &&
      pilot.situacao !== "saiu" &&
      !pilot.pilotoArquivado,
  );
  const stageResults = results
    .filter(
      (result) =>
        result.temporadaId === competition?.id &&
        result.etapa === stage?.etapa &&
        divisionPilots.some((pilot) => pilot.id === result.pilotoId),
    )
    .sort((a, b) => (a.posicaoFinal ?? 999) - (b.posicaoFinal ?? 999));
  const accumulatedResults = results.filter(
    (result) =>
      result.temporadaId === competition?.id &&
      result.etapa <= (stage?.etapa ?? 0) &&
      divisionPilots.some((pilot) => pilot.id === result.pilotoId),
  );
  const standings = competition && stage
    ? buildStandings(
        divisionPilots,
        accumulatedResults,
        competitionStages.filter((item) => item.etapa <= stage.etapa),
        competition.totalEtapas,
        competitionDivisions.map((item) => item.codigo),
      )
    : [];
  const absences = stageResults.filter((result) => result.compareceu === false);

  async function createCanvas() {
    if (!competition || !division || !stage || stageResults.length === 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = orientation==="horizontal"?1920:1080;
    canvas.height = orientation==="horizontal"?1080:1920;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const logo = await loadCanvasImage("/central/brand/speed-gt-brasil.png").catch(() => null);
    if (!logo) {
      setMessage("Não foi possível carregar o logo da Speed GT para o boletim.");
      return null;
    }
    (orientation==="horizontal"?drawLandscapeBulletin:drawBulletin)(context, {
      competition,
      division,
      stage,
      pilots: divisionPilots,
      stageResults,
      standings,
      absences,
      logo,
    });
    return canvas;
  }

  async function createPng() {
    const canvas = await createCanvas();
    if (!canvas) return null;
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  async function download() {
    const blob = await createPng();
    if (!blob || !competition || !division || !stage) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `boletim-${competition.id}-${division.codigo}-etapa-${stage.etapa}.png`;
    anchor.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
    setMessage("Boletim baixado em PNG.");
  }

  async function share() {
    const blob = await createPng();
    if (!blob || !competition || !division || !stage) return;
    const file = new File([blob], `boletim-${competition.id}-${division.codigo}-etapa-${stage.etapa}.png`, { type: "image/png" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try { await navigator.share({ files: [file], title: `Boletim ${competition.nome}` }); } catch(error) { if(error instanceof Error&&error.name==="AbortError")return; setMessage("Não foi possível compartilhar. Use Baixar PNG."); return; }
      setMessage("Boletim compartilhado.");
      return;
    }
    await download();
    setMessage("O compartilhamento direto não está disponível; o PNG foi baixado.");
  }

  async function downloadPdf() {
    const canvas = await createCanvas();
    if (!canvas || !competition || !division || !stage) return;
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.94));
    if (!jpeg) return;
    const pdf = makeImagePdf(new Uint8Array(await jpeg.arrayBuffer()), canvas.width, canvas.height);
    const url = URL.createObjectURL(pdf);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `boletim-${competition.id}-${division.codigo}-etapa-${stage.etapa}.pdf`;
    anchor.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
    setMessage(`Boletim baixado em PDF ${orientation} de uma página.`);
  }

  if (!competition) {
    return <EmptyBulletin text="Nenhuma competição com classificação disponível." />;
  }

  return (
    <main className="mx-auto max-w-6xl px-3 pb-28 md:px-6 md:pb-12">
      <section className="sticky top-0 z-30 -mx-3 border-b border-border bg-background/95 px-3 pb-3 pt-4 backdrop-blur md:-mx-6 md:px-6 md:pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#60A5FA]">Comunicação</p>
        <h1 className="font-display mt-1 text-4xl font-bold uppercase leading-none md:text-5xl">Boletim</h1>
        <div className="mt-4 space-y-2">
          <Select label="Competição" value={competition.id} onChange={(value) => {
            setCompetitionId(value);
            const nextDivision = divisions.find((item) => item.temporadaId === value && item.status !== "cancelada");
            const nextStage = stages.find((item) => item.temporadaId === value);
            setDivisionCode(nextDivision?.codigo ?? "");
            setStageNumber(nextStage?.etapa ?? 1);
          }} options={available.map((item) => ({ value: item.id, label: item.nome }))} />
          <Select label="Divisão" value={division?.codigo ?? ""} onChange={setDivisionCode} options={competitionDivisions.map((item) => ({ value: item.codigo, label: item.nome }))} />
          <Select label="Etapa" value={String(stage?.etapa ?? "")} onChange={(value) => setStageNumber(Number(value))} options={competitionStages.map((item) => ({ value: String(item.etapa), label: `Etapa ${item.etapa} · ${item.pista}` }))} />
        </div>
        <div className="mt-3"><FilterChips label="Formato" value={orientation} onChange={setOrientation} options={[{value:"vertical",label:"Vertical · 1080 × 1920"},{value:"horizontal",label:"Horizontal · 1920 × 1080"}]}/></div>
      </section>

      {stageResults.length === 0 ? (
        <EmptyBulletin text="Esta etapa ainda não possui resultado lançado para a divisão escolhida." />
      ) : (
        <section className="pt-4">
          <div className="border-l-4 bg-[#131722] p-4" style={{ borderColor: division?.cor ?? "#60A5FA" }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{competition.nome} · {division?.nome}</p>
                <h2 className="font-display mt-1 text-3xl font-bold uppercase">Etapa {stage?.etapa} · {stage?.pista}</h2>
                {stage?.multiplicador && stage.multiplicador > 1 && <p className="mt-2 font-bold text-[#60A5FA]">Pontuação {stage.multiplicador}x nesta etapa</p>}
              </div>
              <ImageDown className="size-8 text-[#60A5FA]" aria-hidden="true" />
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <BulletinTable title="Resultado da etapa" rows={stageResults.map((result) => ({
              key: result.pilotoId,
              position: resultStatus(result),
              name: (divisionPilots.find((pilot) => pilot.id === result.pilotoId)?.apelido ?? result.pilotoId) + (result.suplente ? " · SUP" : ""),
              value: `${result.pontos} pts`,
            }))} />
            <BulletinTable title={`Acumulado até a etapa ${stage?.etapa}`} rows={standings.map((row) => ({
              key: row.pilot.id,
              position: `${row.rank}º`,
              name: row.pilot.apelido + (accumulatedResults.some(r=>r.pilotoId===row.pilot.id&&r.suplente)?" · SUP":""),
              value: `${row.total} pts · ${row.movement === "sobe" ? "sobe" : row.movement === "desce" ? "desce" : "permanece"}`,
            }))} />
          </div>

          <div className="mt-3 border border-border bg-[#10141B] p-4 text-sm">
            <strong>Ausentes e faltas acumuladas</strong>
            <p className="mt-2 leading-6 text-muted-foreground">
              {absences.length > 0
                ? absences.map((result) => divisionPilots.find((pilot) => pilot.id === result.pilotoId)?.apelido ?? result.pilotoId).join(", ")
                : "Nenhum ausente registrado nesta etapa."}
            </p>
            <p className="mt-1 leading-6 text-muted-foreground">
              {standings.filter((row) => row.faults > 0).map((row) => `${row.pilot.apelido}: ${disciplineLabel(row.faults)}`).join(" · ") || "Sem faltas não justificadas acumuladas."}
            </p>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={downloadPdf} className="flex min-h-12 items-center justify-center gap-2 bg-[#60A5FA] px-4 font-bold text-[#0A0C10] focus-visible:outline-2 focus-visible:outline-[#EFFF5A]">
              <FileDown className="size-5" aria-hidden="true" /> Baixar PDF {orientation}
            </button>
            <button type="button" onClick={download} className="flex min-h-12 items-center justify-center gap-2 bg-[#60A5FA] px-4 font-bold text-[#0A0C10] focus-visible:outline-2 focus-visible:outline-[#EFFF5A]">
              <Download className="size-5" aria-hidden="true" /> Baixar PNG
            </button>
            <button type="button" onClick={share} className="flex min-h-12 items-center justify-center gap-2 border border-[#00E676] px-4 font-bold text-[#73FFB0] focus-visible:outline-2 focus-visible:outline-[#00E676]">
              <Share2 className="size-5" aria-hidden="true" /> Compartilhar
            </button>
          </div>
          {message && <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">{message}</p>}
        </section>
      )}
    </main>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <FilterChips label={label} value={value} onChange={onChange} options={options}/>;
}

function BulletinTable({ title, rows }: { title: string; rows: Array<{ key: string; position: string; name: string; value: string }> }) {
  return <section className="border border-border bg-[#131722]"><h3 className="font-display border-b border-border px-3 py-3 text-xl font-bold uppercase">{title}</h3><div>{rows.map((row) => <div key={row.key} className="grid min-h-11 grid-cols-[52px_1fr_auto] items-center gap-2 border-b border-border px-3 last:border-b-0"><span className="font-data text-muted-foreground">{row.position}</span><strong className="truncate">{row.name}</strong><span className="font-data text-xs text-[#60A5FA]">{row.value}</span></div>)}</div></section>;
}

function EmptyBulletin({ text }: { text: string }) {
  return <section className="mx-auto mt-5 max-w-6xl border-l-4 border-[#60A5FA] bg-[#131722] p-5"><h2 className="font-display text-2xl font-bold uppercase">Boletim indisponível</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></section>;
}

function drawBulletin(context: CanvasRenderingContext2D, data: {
  competition: RaceCompetition;
  division: RaceDivision;
  stage: RaceStage;
  pilots: RacePilot[];
  stageResults: RaceResult[];
  standings: ReturnType<typeof buildStandings>;
  absences: RaceResult[];
  logo: HTMLImageElement;
}) {
  const { competition, division, stage, pilots, stageResults, standings, absences, logo } = data;
  const accent = "#F5C400";
  const white = "#F4F5F7";
  const muted = "#AAB0B8";
  context.fillStyle = "#030507";
  context.fillRect(0, 0, 1080, 1920);
  drawBackgroundTexture(context);

  context.drawImage(logo, 48, 42, 120, 120);
  context.fillStyle = accent;
  context.font = 'italic 700 28px "Arial Narrow", Impact, sans-serif';
  context.fillText("BOLETIM OFICIAL", 190, 82);
  context.fillRect(420, 72, 540, 2);
  context.beginPath();
  context.moveTo(962, 72); context.lineTo(1008, 20); context.lineTo(1018, 20); context.lineTo(970, 76);
  context.strokeStyle = accent; context.lineWidth = 5; context.stroke();
  context.fillStyle = white;
  context.font = 'italic 900 58px "Arial Narrow", Impact, sans-serif';
  context.fillText(`${competition.nome} · ${division.nome}`, 190, 158, 815);
  context.fillStyle = "#D5D8DD";
  context.font = 'italic 800 42px "Arial Narrow", Impact, sans-serif';
  context.fillText(`ETAPA ${stage.etapa} · ${stage.pista}`, 180, 238, 820);

  drawTechnicalPanel(context, 48, 276, 984, 72);
  drawCalendarIcon(context, 80, 296, accent);
  context.fillStyle = muted;
  context.font = 'italic 700 21px "Arial Narrow", Arial, sans-serif';
  context.fillText("DATA DA CORRIDA", 132, 321);
  context.fillStyle = "#4D535B"; context.fillRect(320, 295, 2, 34);
  context.fillStyle = white; context.font = '700 23px "Arial Narrow", Arial, sans-serif';
  context.fillText(formatBulletinDate(divisionStageDate(division, stage)), 354, 321);
  if (stage.multiplicador > 1) {
    context.fillStyle = accent; context.font = '700 18px "Arial Narrow", Arial, sans-serif';
    context.fillText(`PONTUAÇÃO ${stage.multiplicador}X`, 820, 320);
  }

  drawCanvasColumn(context, 32, 382, 500, 725, "RESULTADO DA ETAPA", stageResults.map((result) => ({
    position: resultStatus(result),
    name: (result.suplente ? "SUP · " : "") + (pilots.find((pilot) => pilot.id === result.pilotoId)?.apelido ?? result.pilotoId),
    value: `${result.pontos} pts`,
    extra: result.voltaMaisRapida ? "VR" : "—",
  })), accent, true);
  drawCanvasColumn(context, 548, 382, 500, 725, `CLASSIFICAÇÃO ACUMULADA · ATÉ E${stage.etapa}`, standings.map((row) => ({
    position: `${row.rank}º`, name: row.pilot.apelido, value: `${row.total} pts`, extra: "",
  })), accent, false);

  drawSummaryBox(context, 32, 1128, 500, 170, "TOP 3", standings.slice(0, 3).map((row) => `${row.rank}º  ${row.pilot.apelido}`).join("   ·   ") || "Ainda sem definição", accent, "podium");
  drawSummaryBox(context, 548, 1128, 500, 170, "ZONA DE RISCO", standings.slice(-5).map((row) => `${row.rank}º ${row.pilot.apelido}`).join("  ·  ") || "Ainda sem definição", accent, "warning");

  drawTechnicalPanel(context, 32, 1318, 1016, 270);
  drawSectionTitle(context, 58, 1366, "AUSENTES E FALTAS", 930, accent);
  const absentText = absences.length ? absences.map((item) => pilots.find((pilot) => pilot.id === item.pilotoId)?.apelido ?? item.pilotoId).join(", ") : "Nenhum ausente registrado.";
  const faults = standings.filter((row) => row.faults > 0).map((row) => `${row.pilot.apelido}: ${row.faults}`).join(" · ") || "Sem faltas não justificadas acumuladas.";
  drawMetricCard(context, 62, 1402, 458, 82, "AUSENTES NA ETAPA", String(absences.length), "person", accent);
  drawMetricCard(context, 560, 1402, 458, 82, "FALTAS ACUMULADAS", String(standings.reduce((sum, row) => sum + row.faults, 0)), "clipboard", accent);
  context.fillStyle = muted; context.font = 'italic 18px "Arial Narrow", Arial, sans-serif';
  wrapCanvasText(context, absentText, 86, 1523, 410, 24);
  wrapCanvasText(context, faults, 584, 1523, 410, 24);

  drawTechnicalPanel(context, 32, 1610, 1016, 205);
  drawSectionTitle(context, 58, 1658, "DECISÕES DOS COMISSÁRIOS", 930, accent);
  const decisions = stageResults
    .filter((result) => result.punicao || result.observacao)
    .map((result) => `${pilots.find((pilot) => pilot.id === result.pilotoId)?.apelido ?? result.pilotoId}: ${result.punicao ?? result.observacao}`)
    .join(" · ") || "Nenhuma decisão registrada.";
  drawGavelIcon(context, 70, 1692, accent);
  context.fillStyle = muted; context.font = 'italic 20px "Arial Narrow", Arial, sans-serif';
  wrapCanvasText(context, decisions, 148, 1724, 820, 28);
  context.strokeStyle = "#56606A"; context.lineWidth = 1; context.beginPath(); context.moveTo(40, 1850); context.lineTo(1040, 1850); context.stroke();
  context.fillStyle = muted; context.font = 'italic 16px "Arial Narrow", Arial, sans-serif'; context.textAlign = "center";
  context.fillText("GERADO PELA CENTRAL DA LIGA SPEED GT BRASIL", 540, 1887);
  context.textAlign = "left";
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Não foi possível carregar ${src}.`));
    image.src = src;
  });
}

function drawCanvasColumn(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, title: string, rows: Array<{ position: string; name: string; value: string; extra: string }>, color: string, resultTable: boolean) {
  drawTechnicalPanel(context, x, y, width, height);
  drawSectionTitle(context, x + 24, y + 55, title, width - 48, color);
  context.fillStyle = "#AAB0B8"; context.font = 'italic 15px "Arial Narrow", Arial, sans-serif';
  if (resultTable) {
    context.fillText("PILOTO", x + 44, y + 106);
    context.fillText("PONTOS", x + width - 190, y + 106);
    context.fillText("MELHOR VOLTA", x + width - 112, y + 106);
  }
  const rowHeight = Math.max(28, Math.min(43, Math.floor((height - 145) / Math.max(1, rows.length))));
  rows.forEach((row, index) => {
    const rowY = y + 142 + index * rowHeight;
    context.strokeStyle = "#2D333A"; context.lineWidth = 1; context.beginPath(); context.moveTo(x + 22, rowY); context.lineTo(x + width - 22, rowY); context.stroke();
    context.fillStyle = index === 0 ? color : "#B5BBC4";
    context.font = `italic 700 ${rowHeight < 34 ? 13 : 16}px "Arial Narrow", Arial, sans-serif`;
    context.fillText(row.position, x + 30, rowY + rowHeight - 10, 76);
    context.fillStyle = "#F4F5F7";
    context.font = `700 ${rowHeight < 34 ? 15 : 18}px "Arial Narrow", Arial, sans-serif`;
    context.fillText(row.name, x + 108, rowY + rowHeight - 10, resultTable ? 190 : 245);
    context.fillStyle = color;
    context.font = `700 ${rowHeight < 34 ? 13 : 16}px "Arial Narrow", Arial, sans-serif`;
    context.textAlign = "right";
    context.fillText(row.value, x + width - (resultTable ? 95 : 30), rowY + rowHeight - 10, 90);
    if (resultTable) {
      context.fillStyle = row.extra === "VR" ? color : "#B5BBC4";
      context.fillText(row.extra, x + width - 30, rowY + rowHeight - 10, 55);
    }
    context.textAlign = "left";
  });
}

function drawSummaryBox(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, title: string, text: string, color: string, icon: "podium" | "warning") {
  drawTechnicalPanel(context, x, y, width, height);
  drawSectionTitle(context, x + 24, y + 52, title, width - 48, color);
  if (icon === "podium") drawPodiumIcon(context, x + 34, y + 94, color); else drawWarningIcon(context, x + 35, y + 88, color);
  context.fillStyle = "#B5BBC4"; context.font = 'italic 18px "Arial Narrow", Arial, sans-serif';
  wrapCanvasText(context, text, x + 108, y + 113, width - 140, 23);
}

function drawTechnicalPanel(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  context.save(); context.beginPath();
  context.moveTo(x + 16, y); context.lineTo(x + width - 16, y); context.lineTo(x + width, y + 16); context.lineTo(x + width, y + height - 16); context.lineTo(x + width - 16, y + height); context.lineTo(x + 16, y + height); context.lineTo(x, y + height - 16); context.lineTo(x, y + 16); context.closePath();
  const gradient = context.createLinearGradient(x, y, x + width, y + height); gradient.addColorStop(0, "#10151A"); gradient.addColorStop(1, "#080C10");
  context.fillStyle = gradient; context.fill(); context.strokeStyle = "#68717A"; context.lineWidth = 1.3; context.stroke(); context.restore();
}

function drawSectionTitle(context: CanvasRenderingContext2D, x: number, y: number, title: string, width: number, color: string) {
  context.save(); context.translate(x, y); context.transform(1, 0, -0.12, 1, 0, 0);
  context.fillStyle = color; context.fillRect(0, -28, 8, 34);
  context.fillStyle = "#F4F5F7"; context.font = 'italic 800 26px "Arial Narrow", Impact, sans-serif'; context.fillText(title, 24, 0, width - 34);
  context.restore(); context.strokeStyle = "#45505A"; context.lineWidth = 1; context.beginPath(); context.moveTo(x, y + 18); context.lineTo(x + width, y + 18); context.stroke();
}

function drawBackgroundTexture(context: CanvasRenderingContext2D) {
  const glow = context.createRadialGradient(890, 220, 10, 890, 220, 500); glow.addColorStop(0, "rgba(70,78,86,.22)"); glow.addColorStop(1, "rgba(0,0,0,0)"); context.fillStyle = glow; context.fillRect(0, 0, 1080, 800);
  context.strokeStyle = "rgba(110,120,130,.12)"; context.lineWidth = 1;
  for (let x = 620; x < 1120; x += 48) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x - 300, 300); context.stroke(); }
  for (let row = 0; row < 5; row += 1) for (let col = 0; col < 7; col += 1) { if ((row + col) % 2 === 0) { context.fillStyle = "rgba(255,255,255,.025)"; context.fillRect(850 + col * 30 - row * 12, 1670 + row * 25, 30, 25); } }
}

function drawCalendarIcon(context: CanvasRenderingContext2D, x: number, y: number, color: string) { context.strokeStyle = color; context.lineWidth = 3; context.strokeRect(x, y + 5, 28, 25); context.beginPath(); context.moveTo(x, y + 13); context.lineTo(x + 28, y + 13); context.moveTo(x + 7, y); context.lineTo(x + 7, y + 10); context.moveTo(x + 21, y); context.lineTo(x + 21, y + 10); context.stroke(); }
function drawPodiumIcon(context: CanvasRenderingContext2D, x: number, y: number, color: string) { context.strokeStyle = color; context.lineWidth = 2; context.strokeRect(x + 18, y, 24, 32); context.strokeRect(x, y + 20, 20, 22); context.strokeRect(x + 40, y + 25, 20, 17); context.fillStyle = color; context.font = '700 14px Arial'; context.fillText("1", x + 27, y + 20); context.fillText("2", x + 6, y + 37); context.fillText("3", x + 47, y + 38); }
function drawWarningIcon(context: CanvasRenderingContext2D, x: number, y: number, color: string) { context.strokeStyle = color; context.lineWidth = 3; context.beginPath(); context.moveTo(x + 28, y); context.lineTo(x + 56, y + 50); context.lineTo(x, y + 50); context.closePath(); context.stroke(); context.fillStyle = color; context.fillRect(x + 26, y + 16, 4, 18); context.fillRect(x + 26, y + 40, 4, 4); }
function drawMetricCard(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, label: string, value: string, icon: "person" | "clipboard", color: string) { context.strokeStyle = "#4E5862"; context.lineWidth = 1; context.strokeRect(x, y, width, height); context.fillStyle = color; context.font = '700 34px "Arial Narrow", Arial, sans-serif'; context.textAlign = "right"; context.fillText(value, x + width - 22, y + 53); context.textAlign = "left"; context.font = 'italic 700 17px "Arial Narrow", Arial, sans-serif'; context.fillText(label, x + 78, y + 48); context.strokeStyle = color; context.lineWidth = 2; if (icon === "person") { context.beginPath(); context.arc(x + 37, y + 30, 10, 0, Math.PI * 2); context.stroke(); context.strokeRect(x + 21, y + 45, 32, 22); } else { context.strokeRect(x + 23, y + 20, 30, 38); context.beginPath(); context.moveTo(x + 30, y + 30); context.lineTo(x + 47, y + 30); context.moveTo(x + 30, y + 39); context.lineTo(x + 47, y + 39); context.stroke(); } }
function drawGavelIcon(context: CanvasRenderingContext2D, x: number, y: number, color: string) { context.save(); context.translate(x + 22, y + 8); context.rotate(-0.7); context.strokeStyle = color; context.lineWidth = 3; context.strokeRect(-15, -8, 30, 16); context.strokeRect(-4, 8, 8, 48); context.restore(); context.strokeStyle = color; context.beginPath(); context.moveTo(x, y + 70); context.lineTo(x + 65, y + 70); context.stroke(); }

function resultStatus(result: RaceResult) {
  if (result.compareceu === false) return "AUSENTE";
  if (result.abandonoMotivo) return "ABAND.";
  if (result.posicaoFinal) return `${result.posicaoFinal}º`;
  return "S/ POS.";
}

function formatBulletinDate(value: string | null) {
  if (!value) return "A DEFINIR";
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function divisionStageDate(division: RaceDivision, stage: RaceStage) {
  const start = division.dataInicio ??
    (division.temporadaId === "2026"
      ? division.codigo === "A" ? "2026-10-06" : division.codigo === "B" || division.codigo === "C" ? "2026-10-05" : null
      : null);
  if (!start) return stage.data;
  const [year, month, day] = start.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + (stage.etapa - 1) * (division.frequenciaDias || 7))).toISOString().slice(0, 10);
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const test = `${line}${word} `;
    if (context.measureText(test).width > maxWidth && line) {
      context.fillText(line.trim(), x, y);
      line = `${word} `;
      y += lineHeight;
    } else line = test;
  }
  if (line) context.fillText(line.trim(), x, y);
}

function makeImagePdf(jpeg: Uint8Array, imageWidth: number, imageHeight: number) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets = [0];
  let length = 0;
  const push = (value: string | Uint8Array) => {
    const bytes = typeof value === "string" ? encoder.encode(value) : value;
    chunks.push(bytes);
    length += bytes.length;
  };
  push("%PDF-1.4\n%PDF\n");
  const object = (id: number, body: string | Uint8Array, prefix = "", suffix = "") => {
    offsets[id] = length;
    push(`${id} 0 obj\n${prefix}`);
    push(body);
    push(`${suffix}\nendobj\n`);
  };
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  const pageWidth=imageWidth>imageHeight?842:595, pageHeight=imageWidth>imageHeight?595:842;
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
  const scale=Math.min(pageWidth/imageWidth,pageHeight/imageHeight);
  const drawWidth=imageWidth*scale, drawHeight=imageHeight*scale;
  const commands = `q\n${drawWidth} 0 0 ${drawHeight} ${(pageWidth-drawWidth)/2} ${(pageHeight-drawHeight)/2} cm\n/Im0 Do\nQ\n`;
  object(4, commands, `<< /Length ${encoder.encode(commands).length} >>\nstream\n`, "endstream");
  object(5, jpeg, `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, "\nendstream");
  const xrefOffset = length;
  push(`xref\n0 6\n0000000000 65535 f \n`);
  for (let id = 1; id <= 5; id += 1) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return new Blob([output], { type: "application/pdf" });
}

function drawLandscapeBulletin(context:CanvasRenderingContext2D,data:Parameters<typeof drawBulletin>[1]) {
  const {competition,division,stage,pilots,stageResults,standings,absences,logo}=data;
  const accent="#F5C400";
  context.fillStyle="#030507";context.fillRect(0,0,1920,1080);drawBackgroundTexture(context);
  context.drawImage(logo,34,24,110,110);
  context.fillStyle=accent;context.font='italic 700 25px "Arial Narrow",Arial';context.fillText("BOLETIM OFICIAL",170,57);
  context.fillStyle="#F4F5F7";context.font='italic 900 40px "Arial Narrow",Arial';context.fillText(competition.nome+" · "+division.nome,170,108,1250);
  context.font='700 24px "Arial Narrow",Arial';context.fillText("ETAPA "+stage.etapa+" · "+stage.pista,38,171,1260);
  context.fillStyle=accent;context.fillText(formatBulletinDate(divisionStageDate(division,stage)),1570,60);
  context.font='700 18px Arial';context.fillText("SUP · Suplente  /  VR · Volta rápida",1445,105);
  const tableHeight=Math.max(805,145+stageResults.length*28,145+standings.length*28);
  // Scale the table drawing uniformly if an unusually large grid needs more rows.
  const drawTable=(x:number,title:string,rows:{position:string;name:string;value:string;extra:string}[],result:boolean)=>{
    context.save();context.translate(x,205);context.scale(1,805/tableHeight);
    drawCanvasColumn(context,0,0,630,tableHeight,title,rows,accent,result);context.restore();
  };
  drawTable(28,"RESULTADO DA ETAPA",stageResults.map(r=>({position:resultStatus(r),name:(r.suplente?"SUP · ":"")+(pilots.find(p=>p.id===r.pilotoId)?.apelido??r.pilotoId),value:r.pontos+" pts",extra:r.voltaMaisRapida?"VR":"—"})),true);
  drawTable(678,"ACUMULADO · ATÉ E"+stage.etapa,standings.map(r=>({position:r.rank+"º",name:(stageResults.some(result=>result.pilotoId===r.pilot.id&&result.suplente)?"SUP · ":"")+r.pilot.apelido,value:r.total+" pts",extra:""})),false);
  drawSummaryBox(context,1330,205,560,155,"TOP 3",standings.slice(0,3).map(r=>r.rank+"º "+r.pilot.apelido).join(" · "),accent,"podium");
  drawSummaryBox(context,1330,375,560,165,"ZONA DE RISCO",standings.slice(-5).map(r=>r.rank+"º "+r.pilot.apelido).join(" · "),accent,"warning");
  drawTechnicalPanel(context,1330,555,560,210);drawSectionTitle(context,1354,600,"AUSENTES E FALTAS",510,accent);
  context.fillStyle="#AAB0B8";context.font='17px Arial';
  wrapCanvasText(context,absences.length?absences.map(r=>pilots.find(p=>p.id===r.pilotoId)?.apelido??r.pilotoId).join(", "):"Nenhum ausente registrado.",1354,644,505,23);
  wrapCanvasText(context,"Faltas acumuladas: "+(standings.filter(r=>r.faults>0).map(r=>r.pilot.apelido+": "+r.faults).join(" · ")||"nenhuma"),1354,710,505,22);
  drawTechnicalPanel(context,1330,780,560,230);drawSectionTitle(context,1354,828,"DECISÕES DOS COMISSÁRIOS",510,accent);
  context.fillStyle="#AAB0B8";context.font='16px Arial';
  const decisions=stageResults.filter(r=>r.punicao||r.observacao).map(r=>(pilots.find(p=>p.id===r.pilotoId)?.apelido??r.pilotoId)+": "+[r.punicao,r.observacao].filter(Boolean).join(" — ")).join(" · ")||"Nenhuma decisão registrada.";
  wrapCanvasText(context,decisions,1354,869,505,22);
  context.fillStyle="#AAB0B8";context.font='italic 16px Arial';context.textAlign="center";context.fillText("GERADO PELA CENTRAL DA LIGA SPEED GT BRASIL",960,1054);context.textAlign="left";
}
