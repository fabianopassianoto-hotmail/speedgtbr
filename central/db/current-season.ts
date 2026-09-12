import {getD1Binding} from "@/db";
export async function currentSeasonId(){const row=await getD1Binding().prepare("SELECT id FROM temporadas WHERE ativa=1 AND status='ativa' AND ciclo='ativa' ORDER BY CASE WHEN tipo_evento='campeonato' THEN 0 ELSE 1 END, rowid DESC LIMIT 1").first<{id:string}>();return row?.id??"2026";}
