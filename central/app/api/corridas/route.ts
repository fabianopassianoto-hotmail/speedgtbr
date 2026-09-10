import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getD1Binding } from "@/db";
import { ensureCurrentUserAccess } from "@/db/access";
import { calculateRacePoints } from "@/db/scoring";
export const dynamic = "force-dynamic";

type Normalized = { suplente:boolean; pontosSuplente:number|null; pilotoId:string; confirmou:boolean|null; faltaJustificada:boolean|null; posicaoFinal:number|null; voltaMaisRapida:boolean; ausente:boolean; punicao:string|null; abandonoMotivo:string|null; observacao:string|null; compareceu:boolean|null; pontos:number; etapa:number; temporadaId:string; carro:string|null; fabricante:string|null; origemCarro:"regulamento"|"piloto"|null };

export async function POST(request:Request){
 const user=await getChatGPTUser(); if(!user)return Response.json({error:"Autenticação obrigatória."},{status:401});
 const access=await ensureCurrentUserAccess(user); if(!access)return Response.json({error:"Usuário sem acesso ativo."},{status:403});
 let body:any; try{body=await request.json();}catch{return bad("Dados inválidos.");}
 const temporadaId=text(body.temporadaId,30), serie=text(body.serie,20), etapa=Number(body.etapa);
 if(!temporadaId||!serie||!Number.isInteger(etapa)||etapa<1||!Array.isArray(body.resultados))return bad("Competição, divisão, etapa ou resultados inválidos.");
 if(access.papel==="coordenador"&&access.serie!==serie)return Response.json({error:"Você só pode lançar corridas da sua série ou divisão vinculada."},{status:403});
 const db=getD1Binding();
 const [stage,competition,division,roster,previous]=await Promise.all([
  db.prepare(`SELECT multiplicador FROM calendario WHERE temporada_id=? AND etapa=?`).bind(temporadaId,etapa).first<{multiplicador:number}>(),
  db.prepare(`SELECT gera_classificacao,status FROM temporadas WHERE id=?`).bind(temporadaId).first<{gera_classificacao:number;status:string}>(),
  db.prepare(`SELECT status,aberto_suplentes FROM divisoes WHERE temporada_id=? AND codigo=?`).bind(temporadaId,serie).first<{status:string;aberto_suplentes:number}>(),
  db.prepare(`SELECT i.piloto_id,i.situacao FROM inscricoes i JOIN pilotos p ON p.id=i.piloto_id WHERE i.temporada_id=? AND i.serie=? AND COALESCE(i.situacao, 'ativo') IN ('ativo','suplente') AND p.arquivado_em IS NULL ORDER BY i.piloto_id`).bind(temporadaId,serie).all<{piloto_id:string;situacao:string|null}>(),
  db.prepare(`SELECT c.piloto_id,c.suplente FROM corridas c JOIN inscricoes i ON i.temporada_id=c.temporada_id AND i.piloto_id=c.piloto_id WHERE c.temporada_id=? AND c.etapa=? AND i.serie=?`).bind(temporadaId,etapa,serie).all<{piloto_id:string;suplente:number}>()
 ]);
 if(!stage||!competition||!division)return Response.json({error:"Competição, divisão ou etapa não encontrada."},{status:404});
 if(competition.status!=="ativa"||division.status!=="ativa")return bad("Reative a temporada e a divisão antes de lançar resultados.");
 const ids=roster.results.map(r=>r.piloto_id), received=new Set<string>(), positions=new Set<number>(); let fastest=0; const normalized:Normalized[]=[];
 for(const raw of body.resultados){const parsed=normalize(raw,temporadaId,etapa,stage.multiplicador,Boolean(competition.gera_classificacao),body.resultados.length); if("error" in parsed)return bad(parsed.error); const r=parsed.result;
  if(!ids.includes(r.pilotoId))return bad("Há um piloto que não pertence à divisão selecionada.");
  const membership=roster.results.find(p=>p.piloto_id===r.pilotoId)!;
  const old=previous.results.find(p=>p.piloto_id===r.pilotoId);
  if(membership.situacao==="suplente"&&!division.aberto_suplentes&&!old)return bad("Esta divisão não está aberta a suplentes.");
  r.suplente=old?Boolean(old.suplente):membership.situacao==="suplente";
  if(!r.suplente&&r.pontosSuplente!==null)return bad("Pontuação manual só está disponível para suplentes."); if(received.has(r.pilotoId))return bad("Piloto repetido no lançamento."); received.add(r.pilotoId);
  if(r.posicaoFinal!==null){if(positions.has(r.posicaoFinal))return bad(`A posição ${r.posicaoFinal} está repetida.`);positions.add(r.posicaoFinal);} if(r.voltaMaisRapida)fastest++; normalized.push(r);
 }
 if(roster.results.some(p=>(p.situacao??"ativo")==="ativo"&&!received.has(p.piloto_id)))return bad("Envie todos os pilotos ativos da divisão selecionada."); if(fastest>1)return bad("Marque somente uma volta mais rápida.");
 const statements=normalized.map(r=>!hasData(r)?db.prepare(`DELETE FROM corridas WHERE temporada_id=? AND etapa=? AND piloto_id=?`).bind(temporadaId,etapa,r.pilotoId):db.prepare(`INSERT INTO corridas (temporada_id,etapa,piloto_id,confirmou,compareceu,falta_justificada,posicao_final,volta_mais_rapida,punicao,abandono_motivo,observacao,pontos,carro,fabricante,origem_carro,suplente,pontos_suplente) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(temporada_id,etapa,piloto_id) DO UPDATE SET confirmou=excluded.confirmou,compareceu=excluded.compareceu,falta_justificada=excluded.falta_justificada,posicao_final=excluded.posicao_final,volta_mais_rapida=excluded.volta_mais_rapida,punicao=excluded.punicao,abandono_motivo=excluded.abandono_motivo,observacao=excluded.observacao,pontos=excluded.pontos,carro=excluded.carro,fabricante=excluded.fabricante,origem_carro=excluded.origem_carro,suplente=excluded.suplente,pontos_suplente=excluded.pontos_suplente`).bind(temporadaId,etapa,r.pilotoId,bool(r.confirmou),bool(r.compareceu),bool(r.faltaJustificada),r.posicaoFinal,r.voltaMaisRapida?1:0,r.punicao,r.abandonoMotivo,r.observacao,r.pontos,r.carro,r.fabricante,r.origemCarro,r.suplente?1:0,r.pontosSuplente));
 for(const old of previous.results){if(old.suplente&&!received.has(old.piloto_id)&&roster.results.some(p=>p.piloto_id===old.piloto_id&&p.situacao==="suplente"))statements.push(db.prepare(`DELETE FROM corridas WHERE temporada_id=? AND etapa=? AND piloto_id=?`).bind(temporadaId,etapa,old.piloto_id));}
 if(statements.length)await db.batch(statements); return Response.json({resultados:normalized});
}
function normalize(raw:any,temporadaId:string,etapa:number,mult:number,scores:boolean,max:number):{result:Normalized}|{error:string}{
 if(!raw||typeof raw!=="object"||typeof raw.pilotoId!=="string")return{error:"Piloto inválido."}; if(!nullableBool(raw.confirmou)||!nullableBool(raw.faltaJustificada)||typeof raw.ausente!=="boolean"||typeof raw.voltaMaisRapida!=="boolean")return{error:"Resultado inválido."};
 const pos=raw.posicaoFinal===null?null:Number(raw.posicaoFinal); if(pos!==null&&(!Number.isInteger(pos)||pos<1||pos>max))return{error:`A posição deve estar entre 1 e ${max}.`}; if(raw.ausente&&pos!==null)return{error:"Um piloto ausente não pode ter posição."}; if(raw.voltaMaisRapida&&(raw.ausente||pos===null))return{error:"A volta mais rápida precisa de uma posição válida."};
 const punicao=text(raw.punicao,1000),abandonoMotivo=text(raw.abandonoMotivo,1000),observacao=text(raw.observacao,1000),carro=text(raw.carro,100),fabricante=text(raw.fabricante,80); const origem=raw.origemCarro==="regulamento"||raw.origemCarro==="piloto"?raw.origemCarro:null; const compareceu=raw.ausente?false:pos!==null?true:null; let pontos=scores?calculateRacePoints({compareceu,posicaoFinal:pos,multiplicador:mult,voltaMaisRapida:raw.voltaMaisRapida}):0;
 const manual=raw.pontosSuplente??null; if(manual!==null&&(!Number.isSafeInteger(manual)||manual<0||manual>1000000||(raw.ausente&&manual>0)))return{error:"Pontuação do suplente inválida."}; if(scores&&manual!==null)pontos=manual;
 return{result:{suplente:false,pontosSuplente:manual,temporadaId,etapa,pilotoId:raw.pilotoId,confirmou:raw.confirmou,faltaJustificada:raw.faltaJustificada,posicaoFinal:pos,voltaMaisRapida:raw.voltaMaisRapida,ausente:raw.ausente,punicao,abandonoMotivo,observacao,compareceu,pontos,carro,fabricante,origemCarro:origem}};
}
function hasData(r:Normalized){return r.pontosSuplente!==null||r.confirmou!==null||r.compareceu!==null||r.faltaJustificada!==null||r.posicaoFinal!==null||r.voltaMaisRapida||r.punicao!==null||r.abandonoMotivo!==null||r.observacao!==null||r.carro!==null||r.fabricante!==null;}
function text(v:any,max:number){return typeof v==="string"&&v.trim()?v.trim().slice(0,max):null;} function nullableBool(v:any){return v===null||typeof v==="boolean";} function bool(v:boolean|null){return v===null?null:v?1:0;} function bad(error:string){return Response.json({error},{status:400});}
