import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getD1Binding } from "@/db";
import { ensureCurrentUserAccess } from "@/db/access";
import { defaultDivisionGroupUrl } from "@/lib/whatsapp-groups";

export const dynamic = "force-dynamic";

export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 const user=await getChatGPTUser(); if(!user)return Response.json({error:"Autenticação obrigatória."},{status:401});
 const access=await ensureCurrentUserAccess(user); if(!access||access.papel!=="administrador")return Response.json({error:"Somente o administrador altera inscrições."},{status:403});
 const {id}=await context.params; if(!/^SGT\d{3}$/.test(id))return bad("Piloto inválido.");
 let body:any; try{body=await request.json();}catch{return bad("Dados inválidos.");}
 const temporadaId=typeof body.temporadaId==="string"?body.temporadaId.trim():""; const serie=typeof body.serie==="string"?body.serie.trim():"";
 const situacao=body.situacao;
 if(!temporadaId||!serie||!['ativo','suplente','inativo','saiu'].includes(situacao))return bad("Competição, divisão ou situação inválida.");
 const db=getD1Binding();
 const [competition,division,pilot]=await Promise.all([
  db.prepare(`SELECT pilotos_por_serie,status FROM temporadas WHERE id=?`).bind(temporadaId).first<{pilotos_por_serie:number;status:string}>(),
  db.prepare(`SELECT status,nome,whatsapp_group_url,limite_pilotos FROM divisoes WHERE temporada_id=? AND codigo=? UNION SELECT 'ativa',NULL,NULL,NULL FROM inscricoes WHERE temporada_id=? AND serie=? LIMIT 1`).bind(temporadaId,serie,temporadaId,serie).first<{status:string;nome:string|null;whatsapp_group_url:string|null;limite_pilotos:number|null}>(),
  db.prepare(`SELECT 1 ok FROM pilotos WHERE id=? AND arquivado_em IS NULL`).bind(id).first(),
 ]);
 if(!competition||!division||!pilot)return Response.json({error:"Competição, divisão ou piloto não encontrado."},{status:404});
 if(competition.status!=="ativa"||division.status!=="ativa")return bad("Reative a temporada e a divisão antes de alterar o grid.");
 if(situacao==="ativo"){
  const count=await db.prepare(`SELECT COUNT(*) total FROM inscricoes WHERE temporada_id=? AND serie=? AND COALESCE(situacao,'ativo')='ativo' AND piloto_id<>?`).bind(temporadaId,serie,id).first<{total:number}>();
  const limit=division.limite_pilotos??(temporadaId==="2026"?(serie==="A"||serie==="B"?14:serie==="C"?15:competition.pilotos_por_serie):competition.pilotos_por_serie);
  if(Number(count?.total??0)>=limit)return Response.json({error:`A divisão já atingiu o limite de ${limit} pilotos ativos.`},{status:409});
 }
 await db.prepare(`INSERT INTO inscricoes (temporada_id,piloto_id,serie,situacao) VALUES (?,?,?,?) ON CONFLICT(temporada_id,piloto_id) DO UPDATE SET serie=excluded.serie,situacao=excluded.situacao`).bind(temporadaId,id,serie,situacao).run();
 return Response.json({
  ok:true,
  temporadaId,
  serie,
  situacao,
  divisionName:division.nome??`Série ${serie}`,
  whatsappGroupUrl:division.whatsapp_group_url??defaultDivisionGroupUrl(serie,division.nome),
 });
}

export async function DELETE(request:Request,context:{params:Promise<{id:string}>}){
 const user=await getChatGPTUser(); if(!user)return Response.json({error:"Autenticação obrigatória."},{status:401});
 const access=await ensureCurrentUserAccess(user); if(!access||access.papel!=="administrador")return Response.json({error:"Somente o administrador altera inscrições."},{status:403});
 const {id}=await context.params; if(!/^SGT\d{3}$/.test(id))return bad("Piloto inválido.");
 let body:any; try{body=await request.json();}catch{return bad("Dados inválidos.");}
 const temporadaId=typeof body.temporadaId==="string"?body.temporadaId.trim():"";
 if(!temporadaId)return bad("Temporada inválida.");
 const db=getD1Binding();
 const started=await db.prepare("SELECT COUNT(*) total FROM corridas WHERE temporada_id=?").bind(temporadaId).first<{total:number}>();
 if(Number(started?.total??0)>0)return Response.json({error:"A temporada já começou. Use ‘Não vai participar’ para preservar o histórico."},{status:409});
 const removed=await db.prepare("DELETE FROM inscricoes WHERE temporada_id=? AND piloto_id=? RETURNING serie,situacao").bind(temporadaId,id).first<{serie:string;situacao:string|null}>();
 if(!removed)return Response.json({error:"O piloto não está nesta temporada."},{status:404});
 return Response.json({ok:true,temporadaId,serie:removed.serie,situacao:removed.situacao});
}
function bad(error:string){return Response.json({error},{status:400});}
