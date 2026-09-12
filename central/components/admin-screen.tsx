"use client";
import {useEffect,useState} from "react";
import {FilterChips} from "@/components/filter-chips";
import {CompetitionConfig,PilotCompetitionConfig} from "@/components/race-entry-screen";
import {CashSettings} from "@/components/cash-settings";
import {SeasonWizard} from "@/components/season-wizard";
import type {getRaceEntryData} from "@/db/races";
import type {AccessRequest} from "@/db/access";
type Props={raceData:Awaited<ReturnType<typeof getRaceEntryData>>;isAdmin:boolean;requests:AccessRequest[];onResolved:(id:number)=>void};
export function AdminScreen({raceData,isAdmin,requests,onResolved}:Props){
 const [tab,setTab]=useState("temporadas"),[data,setData]=useState<any>(null),[message,setMessage]=useState("");
 async function load(){try{const r=await fetch("/central/api/admin");const j=await r.json();if(!r.ok)throw new Error(j.error);setData(j);}catch(e){setMessage(e instanceof Error?e.message:"Falha ao carregar.")}}
 useEffect(()=>{if(isAdmin)void load()},[isAdmin]);
 async function action(body:any){setMessage("");try{const r=await fetch("/central/api/admin",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw new Error(j.error);await load();return true}catch(e){setMessage(e instanceof Error?e.message:"Falha ao salvar.");return false}}
 const config={competitions:raceData.competicoes,divisions:raceData.divisoes,stages:raceData.etapas,enrolledPilots:raceData.pilotos,availablePilots:raceData.pilotosDisponiveis,selectedCompetition:raceData.competicoes.find(c=>c.ativa)?.id??raceData.competicoes[0]?.id??""};
 if(!isAdmin)return <main className="mx-auto max-w-6xl p-6"><p>Acesso administrativo necessário.</p></main>;
 return <main className="mx-auto max-w-6xl px-3 py-5 pb-32 md:px-6"><p className="text-sm text-primary">Central da liga</p><h1 className="mb-5">Administração</h1>
 <FilterChips label="Gerenciar" value={tab} onChange={setTab} options={[{value:"temporadas",label:"Temporadas"},{value:"competicoes",label:"Competições"},{value:"config",label:"Configurações"},{value:"logs",label:"Logs de atividade"}]}/>
 {message&&<p role="alert" className="my-4 text-red-300">{message}</p>}
 {tab==="temporadas"&&<SeasonWizard data={data} raceData={raceData} onAction={action}/>}
 {tab==="competicoes"&&<div className="mt-5 space-y-4"><h2>Estrutura da competição</h2><CompetitionConfig {...config} mode="competition"/><PilotCompetitionConfig {...config}/></div>}
 {tab==="config"&&<div className="mt-5 space-y-5"><h2>Configurações financeiras</h2><CashSettings competitions={raceData.competicoes}/></div>}
 {tab==="logs"&&<section className="central-panel mt-5"><h2>Log de atividades</h2><p className="my-2 text-sm text-muted-foreground">Últimas 150 alterações. Os registros anteriores à implantação do log não têm autor retroativo.</p>{!data?.logs.length&&<p className="py-4 text-muted-foreground">Nenhuma atividade registrada ainda.</p>}{data?.logs.map((l:any)=><details key={l.id} className="border-b border-border py-3"><summary className="cursor-pointer text-sm"><span className="text-muted-foreground">{new Date(l.data_hora).toLocaleString("pt-BR")} · </span><strong>{l.usuario}</strong> · {l.acao} · {l.entidade} · {l.identificador}</summary><div className="mt-3 grid gap-3 md:grid-cols-2">{[["Antes",l.anterior],["Depois",l.novo]].map(([label,value])=><div key={label}><p className="mb-1 text-sm text-muted-foreground">{label}</p><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all bg-background p-3 text-xs">{value?JSON.stringify(JSON.parse(value),null,2):"—"}</pre></div>)}</div></details>)}</section>}
 </main>
}
