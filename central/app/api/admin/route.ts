import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureCurrentUserAccess } from "@/db/access";
import { getD1Binding } from "@/db";
import { getRaceEntryData } from "@/db/races";
import { officialOrProvisional,seasonClassification } from "@/db/season-lifecycle";
export const dynamic="force-dynamic";
async function auth(){const user=await getChatGPTUser();if(!user)return null;const a=await ensureCurrentUserAccess(user);return a?.papel==="administrador"?a:null;}
export async function GET(request:Request){
 if(!await auth())return Response.json({error:"Acesso não autorizado."},{status:403});
 const db=getD1Binding(),url=new URL(request.url),id=url.searchParams.get("temporadaId"),pilot=url.searchParams.get("pilotoId");
 if(id){const revision=await db.prepare("SELECT COALESCE(MAX(id),0) version FROM atividades WHERE entidade IN ('corridas','inscricoes','calendario','divisoes','pilotos','temporadas')").first<{version:number}>();return Response.json({...await officialOrProvisional(id),revision:revision?.version??0});}
 if(pilot){
  const seasons=await db.prepare("SELECT t.id,t.nome,i.serie FROM temporadas t JOIN inscricoes i ON i.temporada_id=t.id WHERE i.piloto_id=? ORDER BY t.id DESC").bind(pilot).all<{id:string;nome:string;serie:string}>();
  return Response.json({historico:await Promise.all(seasons.results.map(async s=>{
   const c=await officialOrProvisional(s.id),row=c.rows.find(r=>r.pilotoId===pilot);
   let movimento="Transição pendente";
   if(c.oficial){
    const next=await db.prepare("SELECT t.id,i.serie FROM temporadas t LEFT JOIN inscricoes i ON i.temporada_id=t.id AND i.piloto_id=? WHERE t.temporada_anterior_id=? LIMIT 1").bind(pilot,s.id).first<{id:string;serie:string|null}>();
    if(next){
     const divisions=await db.prepare("SELECT codigo,ordem FROM divisoes WHERE temporada_id=?").bind(s.id).all<{codigo:string;ordem:number}>();
     const before=divisions.results.find(d=>d.codigo===(row?.serie??s.serie))?.ordem;
     const after=divisions.results.find(d=>d.codigo===next.serie)?.ordem;
     movimento=!next.serie?"Não inscrito na temporada seguinte":next.serie===(row?.serie??s.serie)?"Permaneceu na série":before!==undefined&&after!==undefined?(after<before?"Promovido":"Rebaixado"):`Transferido para a Série ${next.serie}`;
    }
   }
   return {...s,oficial:c.oficial,...row,movimento};
  }))});
 }
 const [users,logs,seasons]=await Promise.all([db.prepare("SELECT id,nome,email,ativo,papel FROM usuarios_acessos ORDER BY nome,email").all(),db.prepare("SELECT * FROM atividades ORDER BY id DESC LIMIT 150").all(),db.prepare("SELECT id,nome,ciclo,status,encerrada_em,temporada_anterior_id FROM temporadas ORDER BY id DESC").all()]);
 return Response.json({users:users.results,logs:logs.results,seasons:seasons.results});
}
export async function POST(request:Request){
 const access=await auth();if(!access)return Response.json({error:"Acesso não autorizado."},{status:403});
 try{const b=await request.json() as any,db=getD1Binding();
 if(b.action==="usuario"){
  if(!Number.isSafeInteger(b.id)||typeof b.ativo!=="boolean")throw new Error("Usuário inválido.");
  if(b.id===access.id&&!b.ativo)throw new Error("Você não pode bloquear o próprio acesso.");
  await db.prepare("UPDATE usuarios_acessos SET ativo=? WHERE id=?").bind(b.ativo?1:0,b.id).run();return Response.json({ok:true});
 }
 if(b.action==="encerrar"){
  if(b.confirmacao!=="ENCERRAR")throw new Error("Confirme o encerramento oficial.");
  const version=await db.prepare("SELECT COALESCE(MAX(id),0) version FROM atividades WHERE entidade IN ('corridas','inscricoes','calendario','divisoes','pilotos','temporadas')").first<{version:number}>();
  if(b.revision!==undefined&&b.revision!==version?.version)throw new Error("Os dados mudaram desde a revisão. Abra a classificação novamente antes de encerrar.");
  const data=await seasonClassification(b.temporadaId);
  if(data.competition.status!=="ativa"||!data.competition.geraClassificacao)throw new Error("Selecione um campeonato ativo com classificação.");
  if(!data.rows.length||!data.results.length)throw new Error("Não há resultados para oficializar.");
  if(await db.prepare("SELECT 1 FROM classificacoes_oficiais WHERE temporada_id=?").bind(b.temporadaId).first())throw new Error("Esta temporada já está encerrada.");
  const now=new Date().toISOString();await db.batch([
   db.prepare("INSERT INTO classificacoes_oficiais(temporada_id,encerrada_em,usuario,dados) VALUES(?,?,?,CASE WHEN (SELECT COALESCE(MAX(id),0) FROM atividades WHERE entidade IN ('corridas','inscricoes','calendario','divisoes','pilotos','temporadas'))=? THEN ? ELSE NULL END)").bind(b.temporadaId,now,access.email,version?.version??0,JSON.stringify(data.rows)),
   db.prepare("UPDATE temporadas SET ciclo='encerrada',ativa=0,encerrada_em=? WHERE id=? AND ciclo='ativa'").bind(now,b.temporadaId)
  ]);return Response.json({ok:true});
 }
 if(b.action==="ciclo"){
  if(!["ativa","arquivada","planejada"].includes(b.ciclo))throw new Error("Situação inválida.");
  const official=await db.prepare("SELECT 1 FROM classificacoes_oficiais WHERE temporada_id=?").bind(b.temporadaId).first();
  if(official&&b.ciclo!=="arquivada")throw new Error("A classificação oficial permanece congelada.");
  await db.prepare("UPDATE temporadas SET ciclo=?,status=?,ativa=? WHERE id=?").bind(b.ciclo,b.ciclo==="arquivada"?"arquivada":"ativa",b.ciclo==="ativa"?1:0,b.temporadaId).run();return Response.json({ok:true});
 }
 if(b.action==="nova"){
  if(b.confirmacao!==true||!Array.isArray(b.roster)||!b.nome?.trim())throw new Error("Revise e confirme a composição.");
  const source=await db.prepare("SELECT * FROM temporadas WHERE id=?").bind(b.anteriorId).first<any>();
  const official=await db.prepare("SELECT dados FROM classificacoes_oficiais WHERE temporada_id=?").bind(b.anteriorId).first<any>();
  if(!source||!official)throw new Error("Encerre a temporada anterior antes de continuar.");
  if(await db.prepare("SELECT id FROM temporadas WHERE temporada_anterior_id=?").bind(b.anteriorId).first())throw new Error("Já existe uma próxima temporada criada a partir desta.");
  const data=await getRaceEntryData(),divisions=data.divisoes.filter(d=>d.temporadaId===b.anteriorId&&d.status!=="cancelada");
  const officialRows=JSON.parse(official.dados);const ids=new Set<string>(),counts=new Map<string,number>();
  for(const row of b.roster){
   if(ids.has(row.pilotoId)||!data.pilotosDisponiveis.some(p=>p.kind==="piloto"&&p.id===row.pilotoId)||!divisions.some(d=>d.codigo===row.serie))throw new Error("Composição contém piloto repetido, arquivado ou série inválida.");
   ids.add(row.pilotoId);counts.set(row.serie,(counts.get(row.serie)??0)+1);
   const original=officialRows.find((r:any)=>r.pilotoId===row.pilotoId);
   if((!original||original.destino!==row.serie||original.revisar)&&!row.motivo?.trim())throw new Error("Informe o motivo de cada exceção ou desempate.");
  }
  for(const d of divisions)if((counts.get(d.codigo)??0)>(d.limitePilotos??source.pilotos_por_serie))throw new Error(`A ${d.nome} excede a capacidade. Revise a composição.`);
  for(const old of officialRows)if(!ids.has(old.pilotoId)&&!b.retirados?.[old.pilotoId]?.trim())throw new Error("Informe o motivo de cada retirada.");
  const id=crypto.randomUUID().slice(0,8),name=b.nome.trim().slice(0,100);
  const statements=[db.prepare("INSERT INTO temporadas(id,nome,ativa,ciclo,total_etapas,pilotos_por_serie,tipo_evento,gera_classificacao,regra_carro,carro_padrao,fabricante_padrao,temporada_anterior_id) VALUES(?,?,0,'planejada',?,?,?,?,?,?,?,?)").bind(id,name,source.total_etapas,source.pilotos_por_serie,source.tipo_evento,source.gera_classificacao,source.regra_carro,source.carro_padrao,source.fabricante_padrao,b.anteriorId)];
  for(const d of divisions)statements.push(db.prepare("INSERT INTO divisoes(temporada_id,codigo,nome,cor,ordem,limite_pilotos,frequencia_dias,regra_carro,carro_padrao,fabricante_padrao,aberto_suplentes,whatsapp_group_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,d.codigo,d.nome,d.cor,d.ordem,d.limitePilotos,d.frequenciaDias,d.regraCarro,d.carroPadrao,d.fabricantePadrao,d.abertoSuplentes?1:0,d.whatsappGroupUrl));
  for(const s of data.etapas.filter(s=>s.temporadaId===b.anteriorId))statements.push(db.prepare("INSERT INTO calendario(temporada_id,etapa,pista,classe_ou_formato,duracao,multiplicador,observacao,regra_carro,carro_padrao,fabricante_padrao) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(id,s.etapa,s.pista,s.classeOuFormato,s.duracao,s.multiplicador,s.observacao,s.regraCarro,s.carroPadrao,s.fabricantePadrao));
  for(const r of b.roster)statements.push(db.prepare("INSERT INTO inscricoes(temporada_id,piloto_id,serie,situacao) VALUES(?,?,?,'ativo')").bind(id,r.pilotoId,r.serie));
  statements.push(db.prepare("INSERT INTO atividades(usuario,data_hora,acao,entidade,identificador,anterior,novo) VALUES(?,?,'transição revisada','temporadas',?,?,?)").bind(access.email,new Date().toISOString(),id,official.dados,JSON.stringify({roster:b.roster,retirados:b.retirados})));
  await db.batch(statements);return Response.json({ok:true,id});
 }
 throw new Error("Ação desconhecida.");
 }catch(e){return Response.json({error:e instanceof Error?e.message:"Não foi possível salvar."},{status:400});}
}
