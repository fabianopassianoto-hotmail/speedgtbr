import { getD1Binding } from "@/db";
import { getRaceEntryData } from "@/db/races";
import { buildStandings } from "@/db/standings";
export type OfficialRow={pilotoId:string;apelido:string;serie:string;rank:number;total:number;descartado:number;movimento:string;destino:string;revisar:boolean};
export async function seasonClassification(id:string){
 const data=await getRaceEntryData();const c=data.competicoes.find(c=>c.id===id);if(!c)throw new Error("Temporada não encontrada.");
 const divisions=data.divisoes.filter(d=>d.temporadaId===id&&d.status!=="cancelada").sort((a,b)=>a.ordem-b.ordem);
 const stages=data.etapas.filter(s=>s.temporadaId===id);const results=data.resultados.filter(r=>r.temporadaId===id);
 const rows:OfficialRow[]=[];
 divisions.forEach((d,di)=>{
   const roster=data.pilotos.filter(p=>p.temporadaId===id&&p.serie===d.codigo&&p.situacao!=="saiu"&&!p.pilotoArquivado);
   const standings=buildStandings(roster,results,stages,c.totalEtapas);
   standings.forEach((r,index)=>{
    const up=di>0&&index<5,down=di<divisions.length-1&&index>=Math.max(0,standings.length-5);
    const overlap=up&&down;const destino=overlap?d.codigo:up?divisions[di-1].codigo:down?divisions[di+1].codigo:d.codigo;
    const tied=standings.filter(other=>other.total===r.total).length>1;
    rows.push({pilotoId:r.pilot.id,apelido:r.pilot.apelido,serie:d.codigo,rank:r.rank,total:r.total,descartado:r.discarded,movimento:destino===d.codigo?"permanece":up?"promovido":"rebaixado",destino,revisar:overlap||tied});
   });
 });return {competition:c,divisions,stages,rows,results};
}
export async function officialOrProvisional(id:string){const db=getD1Binding();const saved=await db.prepare("SELECT dados,encerrada_em FROM classificacoes_oficiais WHERE temporada_id=?").bind(id).first<{dados:string;encerrada_em:string}>();if(saved)return {rows:JSON.parse(saved.dados) as OfficialRow[],oficial:true,encerradaEm:saved.encerrada_em};const current=await seasonClassification(id);return {rows:current.results.length?current.rows:[],oficial:false,encerradaEm:null};}
