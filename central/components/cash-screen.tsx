"use client";

import { Check, CircleDollarSign, FileSpreadsheet, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import { useState } from "react";

import { FilterChips } from "@/components/filter-chips";
import { CashSettings } from "@/components/cash-settings";
import type { RaceCompetition } from "@/db/races";
import type { CashEntry } from "@/db/finance";
import type { PilotListItem } from "@/db/pilots";
import { downloadXlsx } from "@/lib/xlsx-client";

type Props = {
  competitions: RaceCompetition[];
  entries: CashEntry[];
  pilots: PilotListItem[];
  isAdmin: boolean;
  onOpenPilot: (id: string) => void;
};

export function CashScreen({ competitions, entries, pilots, isAdmin, onOpenPilot }: Props) {
  const [query, setQuery] = useState("");
  const [paymentFilter,setPaymentFilter]=useState("todos");
  const [scope,setScope]=useState("todos");
  const [message, setMessage] = useState("");
  const currentEntries = entries.filter((entry) => entry.temporadaId === "2026");
  const pool = scope === "serie" ? pilots.filter(p=>Boolean(p.serie)&&p.situacao!=="saiu"&&!p.arquivadoEm) : pilots;
  const paid = pool.filter(p=>p.totalPago>0);
  const pending = pool.filter(p=>p.totalPago===0&&!p.isentoPagamento);
  const exempt = pool.filter(p=>p.isentoPagamento);
  const selected = paymentFilter==="pagantes"?paid:paymentFilter==="pendentes"?pending:paymentFilter==="isentos"?exempt:pool;
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const filteredPilots = selected.filter(p=>!normalized||[p.apelido,p.nomeCompleto,p.serie,p.id].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(normalized));
  const total = currentEntries.reduce((sum, entry) => sum + entry.valor, 0);
  const medalha = currentEntries.reduce((sum, entry) => sum + entry.vaiParaMedalha, 0);
  const filterLabel=paymentFilter==="pagantes"?"Pagantes":paymentFilter==="pendentes"?"Ainda não pagaram":paymentFilter==="isentos"?"Isentos":"Todos os pilotos";

  function exportPendingPayments() {
    downloadXlsx(
      "pilotos-pagamento-pendente-2026.xlsx",
      "Pagamentos pendentes",
      [
        ["Série", "Piloto", "Nome completo", "WhatsApp", "Valor pago", "Código"],
        ...pending
          .slice()
          .sort((a, b) => (a.serie ?? "").localeCompare(b.serie ?? "") || a.apelido.localeCompare(b.apelido, "pt-BR"))
          .map((pilot) => [pilot.serie ?? "", pilot.apelido, pilot.nomeCompleto ?? "", pilot.whatsapp ?? "", formatCurrency(pilot.totalPago), pilot.id]),
      ],
    );
    setMessage(`${pending.length} pilotos com pagamento pendente exportados.`);
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-6xl px-3 pb-28 pt-5 md:px-6">
        <section className="border-l-4 border-[#E8604C] bg-[#131722] p-5">
          <ShieldCheck className="size-7 text-[#E8604C]" aria-hidden="true" />
          <h1 className="font-display mt-3 text-3xl font-bold uppercase">Caixa restrito</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Somente administradores podem consultar valores, pagamentos e isenções.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-3 pb-28 md:px-6 md:pb-12">
      <section className="sticky top-0 z-30 -mx-3 border-b border-border bg-background/95 px-3 pb-3 pt-4 backdrop-blur md:-mx-6 md:px-6 md:pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#60A5FA]">Financeiro · temporada 2026</p>
        <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="font-display mt-1 text-4xl font-bold uppercase leading-none md:text-5xl">Caixa</h1><button type="button" onClick={exportPendingPayments} className="flex min-h-11 items-center gap-2 bg-[#60A5FA] px-3 text-sm font-bold text-[#0A0C10]"><FileSpreadsheet className="size-4"/>Exportar quem falta pagar</button></div>
      </section>

      <div className="mt-4"><FilterChips label="Pilotos" value={scope} onChange={setScope} options={[{value:"todos",label:"Todos os pilotos"},{value:"serie",label:"Com série"}]}/></div>
      <section className="grid grid-cols-2 gap-3 pt-4 lg:grid-cols-4">
        <Metric icon={CircleDollarSign} label="Total arrecadado" value={formatCurrency(total)} tone="#00E676" />
        <Metric icon={WalletCards} label="Reservado para medalha" value={formatCurrency(medalha)} tone="#60A5FA" />
        <Metric icon={UserRound} label="Ainda não pagaram" value={String(pending.length)} tone="#E8604C" selected={paymentFilter==="pendentes"} onClick={()=>setPaymentFilter(paymentFilter==="pendentes"?"todos":"pendentes")} />
        <Metric icon={Check} label="Pagantes" value={String(paid.length)} tone="#00E676" selected={paymentFilter==="pagantes"} onClick={()=>setPaymentFilter(paymentFilter==="pagantes"?"todos":"pagantes")} />
      </section>

      <section className="mt-5">
        <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Situação por nome</p>
            <h2 className="font-display mt-1 text-2xl font-bold uppercase">{filterLabel}</h2>
          </div>
          <label className="w-full sm:max-w-xs"><span className="sr-only">Buscar piloto</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar piloto ou série" className="h-11 w-full border border-border bg-[#131722] px-3 outline-none placeholder:text-[#6F788B] focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/30" /></label>
        </div>
        <div className="my-3"><FilterChips label="Pagamento" value={paymentFilter} onChange={setPaymentFilter} options={[{value:"todos",label:"Todos · "+pool.length},{value:"pagantes",label:"Pagantes · "+paid.length},{value:"pendentes",label:"Não pagaram · "+pending.length},{value:"isentos",label:"Isentos · "+exempt.length}]}/></div>
        <p className="mb-3 text-xs text-muted-foreground">{filteredPilots.length} pilotos · Pagantes incluem qualquer valor recebido. Isentos sem pagamento não entram em “Ainda não pagaram”.</p>
        <div className="border-b border-border">
          {filteredPilots.map((pilot) => (
            <div key={pilot.id} className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 border-b border-border bg-[#131722] px-3 py-2 last:border-b-0 md:grid-cols-[1fr_150px]">
              <button type="button" onClick={() => onOpenPilot(pilot.id)} className="min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]">
                <strong className="font-display block truncate text-2xl uppercase leading-none">{pilot.apelido}</strong>
                <span className="font-data mt-1 block text-xs text-muted-foreground">{pilot.serie ? `Série ${pilot.serie}` : "Sem série"} · {pilot.id}{pilot.arquivadoEm ? " · Arquivado" : pilot.situacao==="saiu"?" · Saiu":""}</span>
              </button>
              <div className="text-right md:text-left">
                <strong className="font-data block text-sm">{formatCurrency(pilot.totalPago)}</strong>
                <span className={pilot.isentoPagamento ? "text-xs text-[#00E676]" : pilot.totalPago===0 ? "text-xs text-[#60A5FA]" : "text-xs text-[#00E676]"}>
                  {pilot.totalPago>0 ? (pilot.inscricaoPendente?"Pagamento parcial":pilot.isentoPagamento?"Pagou · Isento":"Pagou") : pilot.isentoPagamento?"Isento":"Não pagou"}
                </span>
              </div>

            </div>
          ))}
        </div>
        {!filteredPilots.length&&<p className="p-4 text-sm text-muted-foreground">Nenhum piloto encontrado para este filtro e busca.</p>}
        {message && <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">{message}</p>}
      </section>

      <CashSettings competitions={competitions}/>
      <section className="mt-6">
        <div className="border-b border-border pb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Histórico</p>
          <h2 className="font-display mt-1 text-2xl font-bold uppercase">Lançamentos</h2>
        </div>
        {currentEntries.length ? <div className="border-b border-border">{currentEntries.map((entry) => <div key={entry.id} className="grid min-h-14 grid-cols-[92px_1fr_auto] items-center gap-3 border-b border-border bg-[#10141B] px-3 py-2 last:border-b-0"><span className="font-data text-xs text-muted-foreground">{formatDate(entry.data)}</span><span className="min-w-0"><strong className="block truncate">{entry.nome}</strong><span className="block truncate text-xs text-muted-foreground">{entry.tipo}{entry.observacao ? ` · ${entry.observacao}` : ""}</span></span><strong className="font-data text-[#00E676]">{formatCurrency(entry.valor)}</strong></div>)}</div> : <p className="border-l-4 border-[#60A5FA] bg-[#131722] p-4 text-sm text-muted-foreground">Nenhum lançamento registrado.</p>}
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, tone, onClick, selected }: { icon: typeof CircleDollarSign; label: string; value: string; tone: string; onClick?:()=>void; selected?:boolean }) {
  const content=<><Icon className="size-5" style={{color:tone}} aria-hidden="true"/><span className="mt-3 block text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</span><strong className="font-data mt-1 block text-2xl">{value}</strong>{onClick&&<span className="mt-2 block text-xs text-muted-foreground">{selected?"Filtro selecionado · toque para limpar":"Toque para filtrar"}</span>}</>;
  return onClick?<button type="button" onClick={onClick} aria-pressed={selected} className="min-w-0 rounded border border-l-4 bg-[#131722] p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]" style={{borderColor:tone,boxShadow:selected?`inset 0 0 0 2px ${tone}`:undefined}}>{content}</button>:<article className="min-w-0 border-l-4 bg-[#131722] p-4" style={{borderColor:tone}}>{content}</article>;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

