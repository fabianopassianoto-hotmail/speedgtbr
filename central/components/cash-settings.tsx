"use client";
import { useEffect, useState } from "react";
import type { RaceCompetition } from "@/db/races";
import { FilterChips } from "@/components/filter-chips";

const fields = [
  ["medalhaIndividual","Medalha individual"],
  ["medalhaTemporada","Medalhas na temporada (total)"],
  ["freteIndividual","Frete individual (média)"],
  ["freteTemporada","Frete na temporada (total)"],
  ["saldoCaixa","Valor que ficou em caixa"],
] as const;
type Values = Record<typeof fields[number][0],string>;
const empty = Object.fromEntries(fields.map(([key])=>[key,"0,00"])) as Values;
export function CashSettings({competitions}:{competitions:RaceCompetition[]}) {
  const available=competitions.filter(c=>c.status!=="cancelada");
  const [season,setSeason]=useState(available.find(c=>c.status==="ativa")?.id??available[0]?.id??"");
  const [values,setValues]=useState<Values>(empty);
  const [status,setStatus]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    if(!season){setLoading(false);return;}
    const controller=new AbortController();setLoading(true);setLoaded(false);setStatus("");
    fetch(`/central/api/caixa-configuracao?temporadaId=${encodeURIComponent(season)}`,{signal:controller.signal})
      .then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||"Não foi possível carregar os valores.");return j.config;})
      .then(config=>{setValues(Object.fromEntries(fields.map(([key])=>[key,(Number(config[key])/100).toFixed(2).replace(".",",")])) as Values);setLoaded(true);})
      .catch(e=>{if(!controller.signal.aborted)setStatus(e.message);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[season,reload]);
  async function save(e:React.FormEvent){
    e.preventDefault();
    const cents=Object.fromEntries(fields.map(([key])=>[key,parseMoney(values[key])]));
    if(Object.values(cents).some(n=>!Number.isSafeInteger(n)||n<0||n>100000000)){setStatus("Use valores como 25,90, com até duas casas decimais.");return;}
    setSaving(true);setStatus("");
    try{const r=await fetch("/central/api/caixa-configuracao",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({temporadaId:season,...cents})});const j=await r.json();if(!r.ok)throw Error(j.error||"Não foi possível salvar.");setStatus("Valores da temporada salvos.");}
    catch(e){setStatus(e instanceof Error?e.message:"Não foi possível salvar.");}finally{setSaving(false);}
  }
  return <section className="mt-5 rounded-lg border border-border bg-[#10141B] p-4">
    <h2 className="font-display font-bold uppercase">Personalizar valores</h2>
    <p className="mb-4 mt-2 text-sm text-muted-foreground">Defina os custos unitários, os totais da temporada e o saldo apurado. Valores em reais.</p>
    <fieldset disabled={saving}><FilterChips label="Temporada" value={season} onChange={setSeason} options={available.map(c=>({value:c.id,label:c.nome}))}/></fieldset>
    {loading?<p className="mt-4" role="status">Carregando valores…</p>:<form onSubmit={save} className="mt-4">
      <fieldset disabled={!loaded||saving} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(([key,label])=><label key={key} className="text-xs font-semibold text-muted-foreground">{label}<div className="mt-1 flex items-center rounded border border-border bg-[#131722] px-3"><span className="mr-2">R$</span><input aria-label={label} inputMode="decimal" value={values[key]} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))} className="h-11 min-w-0 w-full bg-transparent text-base text-foreground outline-none" required/></div></label>)}
      </fieldset>
      <button disabled={!loaded||saving} className="mt-4 min-h-11 rounded bg-[#60A5FA] px-4 text-sm font-bold text-[#0A0C10] disabled:opacity-50">{saving?"Salvando…":"Salvar valores"}</button>
      {!loaded&&<button type="button" className="ml-3 min-h-11 underline" onClick={()=>setReload(v=>v+1)}>Tentar novamente</button>}
    </form>}
    {status&&<p className="mt-3 text-sm" role="status">{status}</p>}
  </section>;
}
function parseMoney(value:string){const normalized=value.trim().replace(",",".");return /^\d+(\.\d{1,2})?$/.test(normalized)?Math.round(Number(normalized)*100):NaN;}
