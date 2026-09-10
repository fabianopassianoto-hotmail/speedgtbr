"use client";

import { CheckCircle2, Clock3, ListOrdered, Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";

import type { QueueListItem } from "@/db/pilots";
import { cn } from "@/lib/utils";

type QueueFilter = "todos" | "prontos" | "avaliacao" | "incompletos";

export function QueueScreen({
  people,
  editable,
  onOpenQueue,
  onSave,
}: {
  people: QueueListItem[];
  editable: boolean;
  onOpenQueue: (id: string) => void;
  onSave: (id: string, field: string, value: unknown) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QueueFilter>("todos");
  const [savingId, setSavingId] = useState<string | null>(null);
  const active = people.filter((person) => !person.arquivadoEm);
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const visible = useMemo(
    () => active.filter((person) => {
      const matchesQuery = !normalized || `${person.apelido} ${person.nomeCompleto ?? ""} ${person.psn ?? ""} ${person.simgrid ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalized);
      if (!matchesQuery) return false;
      if (filter === "prontos") return person.prontoParaSerie === true;
      if (filter === "avaliacao") return person.prontoParaSerie !== true;
      if (filter === "incompletos") return person.cadastroStatus === "incompleto";
      return true;
    }),
    [active, filter, normalized],
  );

  async function save(person: QueueListItem, field: string, value: unknown) {
    setSavingId(person.id);
    await onSave(person.id, field, value);
    setSavingId(null);
  }

  return (
    <main className="mx-auto max-w-6xl px-3 pb-28 md:px-6 md:pb-12">
      <section className="sticky top-0 z-30 -mx-3 border-b border-border bg-background/95 px-3 pb-3 pt-4 backdrop-blur md:-mx-6 md:px-6 md:pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#60A5FA]">Entrada na liga</p>
        <h1 className="font-display mt-1 text-4xl font-bold uppercase leading-none md:text-5xl">Fila</h1>
        <label className="relative mt-4 block"><span className="sr-only">Buscar pessoa na fila</span><Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Apelido, nome, PSN ou SimGrid" className="h-12 w-full border border-border bg-[#131722] pl-11 pr-3 outline-none placeholder:text-[#6F788B] focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/30" /></label>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {([
            ["todos", `Todos · ${active.length}`],
            ["prontos", `Prontos · ${active.filter((item) => item.prontoParaSerie).length}`],
            ["avaliacao", `Em avaliação · ${active.filter((item) => !item.prontoParaSerie).length}`],
            ["incompletos", `Incompletos · ${active.filter((item) => item.cadastroStatus === "incompleto").length}`],
          ] as Array<[QueueFilter, string]>).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={cn("min-h-10 shrink-0 border px-3 text-sm font-semibold", filter === value ? "border-[#60A5FA] bg-[#272B13] text-[#60A5FA]" : "border-border text-muted-foreground")}>{label}</button>)}
        </div>
      </section>

      <section className="grid gap-3 pt-4 sm:grid-cols-3">
        <Metric icon={ListOrdered} label="Na fila" value={active.length} tone="#60A5FA" />
        <Metric icon={CheckCircle2} label="Prontos para série ou suplência" value={active.filter((person) => person.prontoParaSerie).length} tone="#00E676" />
        <Metric icon={Clock3} label="Ainda em avaliação" value={active.filter((person) => !person.prontoParaSerie).length} tone="#00E676" />
      </section>

      <section className="mt-5"><p className="mb-3 text-sm text-muted-foreground">Avalie o piloto e marque-o como pronto. Depois, escolha a série e a entrada como titular ou suplente. Organize cada corrida 4Fun em uma divisão na aba Corrida.</p>
        <div className="mb-2 flex items-center justify-between"><h2 className="font-display text-2xl font-bold uppercase">Pessoas</h2><span className="font-data text-xs text-muted-foreground">{visible.length} {visible.length === 1 ? "resultado" : "resultados"}</span></div>
        {visible.length ? <div className="border-y border-border">{visible.map((person) => (
          <article key={person.id} className="border-b border-border bg-[#131722] p-3 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
              <button type="button" onClick={() => onOpenQueue(person.id)} className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]">
                <strong className="font-display block truncate text-2xl uppercase leading-none">{person.apelido}</strong>
                <span className="font-data mt-1 block truncate text-xs text-muted-foreground">{person.id} · {person.simgrid || person.psn || person.nomeCompleto || "Cadastro pendente"}</span>
              </button>
              <span className={cn("shrink-0 border px-2 py-1 text-[10px] font-bold uppercase", person.prontoParaSerie ? "border-[#00E676] text-[#73FFB0]" : "border-[#00E676] text-[#73FFB0]")}>{person.prontoParaSerie ? "Pronto" : "Em avaliação"}</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <button type="button" disabled={!editable || savingId === person.id} onClick={() => save(person, "prontoParaSerie", !person.prontoParaSerie)} className="min-h-10 border border-[#00E676] px-3 text-sm font-semibold text-[#73FFB0] outline-none focus-visible:ring-2 focus-visible:ring-[#00E676] disabled:opacity-50">{person.prontoParaSerie ? "Retirar marcação de pronto" : "Pronto para série ou suplência"}</button>
              <button type="button" onClick={() => onOpenQueue(person.id)} className="flex min-h-10 items-center justify-center gap-2 bg-[#60A5FA] px-3 text-sm font-bold text-[#0A0C10] outline-none focus-visible:ring-2 focus-visible:ring-[#EFFF5A]"><UserPlus className="size-4" aria-hidden="true" /> Escolher série / suplente</button>
            </div>
            {person.conduta && <p className="mt-3 border-l-2 border-[#8A92A6] pl-3 text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Conduta:</strong> {person.conduta}</p>}
          </article>
        ))}</div> : <div className="border-l-4 border-[#60A5FA] bg-[#131722] p-5"><h2 className="font-display text-2xl font-bold uppercase">Nenhuma pessoa encontrada</h2><p className="mt-2 text-sm text-muted-foreground">Retire o filtro ou tente outra busca.</p></div>}
        {!editable && <p className="mt-3 text-sm text-muted-foreground">Coordenadores podem consultar a fila; somente administradores alteram avaliações e promovem pessoas.</p>}
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof ListOrdered; label: string; value: number; tone: string }) {
  return <article className="border-l-4 bg-[#131722] p-4" style={{ borderColor: tone }}><Icon className="size-5" style={{ color: tone }} aria-hidden="true" /><span className="mt-3 block text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</span><strong className="font-data mt-1 block text-3xl">{value}</strong></article>;
}
