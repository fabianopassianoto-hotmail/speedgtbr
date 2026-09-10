import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getD1Binding } from "@/db";
import { ensureCurrentUserAccess } from "@/db/access";
import { promoteQueueToCompetition } from "@/db/promote-queue";
import { defaultDivisionGroupUrl } from "@/lib/whatsapp-groups";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Autenticação obrigatória." }, { status: 401 });
  const access = await ensureCurrentUserAccess(user);
  if (!access || access.papel !== "administrador") return Response.json({ error: "Somente o administrador pode configurar competições." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return bad("Dados inválidos."); }
  const db = getD1Binding();
  const action = body.action;
  try {
    if (action === "competicao") {
      const nome = required(body.nome, 100); const id = code(body.id, 30) ?? slugCode(nome,30,false);
      const tipo = body.tipoEvento === "4fun" ? "4fun" : body.tipoEvento === "campeonato" ? "campeonato" : null;
      const etapas = positiveInt(body.totalEtapas); const limite = positiveInt(body.pilotosPorSerie);
      const regra = carRule(body.regraCarro);
      if (!id || !nome || !tipo || !etapas || !limite) return bad("Preencha nome, tipo, etapas e limite de pilotos.");
      await db.prepare(`INSERT INTO temporadas (id,nome,ativa,total_etapas,pilotos_por_serie,tipo_evento,gera_classificacao,regra_carro,carro_padrao,fabricante_padrao,whatsapp_group_url) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id,nome,1,etapas,limite,tipo,body.geraClassificacao===false?0:1,regra,optional(body.carroPadrao,100),optional(body.fabricantePadrao,80),whatsappGroupUrl(body.whatsappGroupUrl)).run();
    } else if (action === "editar_competicao") {
      const temporadaId = required(body.temporadaId,30); const nome = required(body.nome,100);
      const tipo = body.tipoEvento === "4fun" ? "4fun" : body.tipoEvento === "campeonato" ? "campeonato" : null;
      const etapas = positiveInt(body.totalEtapas); const limite = positiveInt(body.pilotosPorSerie);
      if (!temporadaId || !nome || !tipo || !etapas || !limite) return bad("Preencha todos os dados obrigatórios da competição.");
      await db.prepare(`UPDATE temporadas SET nome=?,tipo_evento=?,total_etapas=?,pilotos_por_serie=?,gera_classificacao=?,regra_carro=?,carro_padrao=?,fabricante_padrao=?,whatsapp_group_url=? WHERE id=?`)
        .bind(nome,tipo,etapas,limite,body.geraClassificacao===false?0:1,carRule(body.regraCarro),optional(body.carroPadrao,100),optional(body.fabricantePadrao,80),whatsappGroupUrl(body.whatsappGroupUrl),temporadaId).run();
    } else if (action === "divisao") {
      const temporadaId = required(body.temporadaId,30); const nome = required(body.nome,80); const codigo = code(body.codigo,20) ?? slugCode(nome,20,true);
      if (!temporadaId || !codigo || !nome) return bad("Informe a competição e o nome da divisão.");
      const max = await db.prepare(`SELECT COALESCE(MAX(ordem),0) total FROM divisoes WHERE temporada_id=?`).bind(temporadaId).first<{total:number}>();
      await db.prepare(`INSERT INTO divisoes (temporada_id,codigo,nome,cor,ordem,limite_pilotos,data_inicio,frequencia_dias,regra_carro,carro_padrao,fabricante_padrao,whatsapp_group_url,aberto_suplentes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(temporadaId,codigo,nome,color(body.cor),(max?.total??0)+1,positiveInt(body.limitePilotos),isoDate(body.dataInicio),positiveInt(body.frequenciaDias)??7,carRule(body.regraCarro),optional(body.carroPadrao,100),optional(body.fabricantePadrao,80),whatsappGroupUrl(body.whatsappGroupUrl)??defaultDivisionGroupUrl(codigo,nome),body.abertoSuplentes===true?1:0).run();
    } else if (action === "editar_divisao") {
      const temporadaId = required(body.temporadaId,30); const serie = code(body.serie,20); const nome = required(body.nome,80);
      if (!temporadaId || !serie || !nome) return bad("Informe a divisão e o nome exibido.");
      const result = await db.prepare(`UPDATE divisoes SET nome=?,cor=?,limite_pilotos=?,data_inicio=?,frequencia_dias=?,regra_carro=?,carro_padrao=?,fabricante_padrao=?,whatsapp_group_url=?,aberto_suplentes=? WHERE temporada_id=? AND codigo=?`)
        .bind(nome,color(body.cor),positiveInt(body.limitePilotos),isoDate(body.dataInicio),positiveInt(body.frequenciaDias)??7,carRule(body.regraCarro),optional(body.carroPadrao,100),optional(body.fabricantePadrao,80),whatsappGroupUrl(body.whatsappGroupUrl)??defaultDivisionGroupUrl(serie,nome),body.abertoSuplentes===true?1:0,temporadaId,serie).run();
      if (!result.meta.changes) return bad("Divisão não encontrada.");
    } else if (action === "etapa") {
      const temporadaId = required(body.temporadaId,30); const etapa = positiveInt(body.etapa); const pista = required(body.pista,120);
      if (!temporadaId || !etapa || !pista) return bad("Informe competição, número da etapa e pista.");
      await db.prepare(`INSERT INTO calendario (temporada_id,etapa,pista,classe_ou_formato,duracao,data,multiplicador,observacao,regra_carro,carro_padrao,fabricante_padrao) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(temporada_id,etapa) DO UPDATE SET pista=excluded.pista,classe_ou_formato=excluded.classe_ou_formato,duracao=excluded.duracao,data=excluded.data,multiplicador=excluded.multiplicador,observacao=excluded.observacao,regra_carro=excluded.regra_carro,carro_padrao=excluded.carro_padrao,fabricante_padrao=excluded.fabricante_padrao`)
        .bind(temporadaId,etapa,pista,optional(body.classeOuFormato,100),optional(body.duracao,50),optional(body.data,30),positiveInt(body.multiplicador)??1,optional(body.observacao,500),carRule(body.regraCarro),optional(body.carroPadrao,100),optional(body.fabricantePadrao,80)).run();
    } else if (action === "inscricao") {
      const temporadaId = required(body.temporadaId,30); const pilotoId = required(body.pilotoId,20); const serie = code(body.serie,20);
      if (!temporadaId || !pilotoId || !serie) return bad("Informe competição, piloto e divisão.");
      if (/^FIL\d{3}$/.test(pilotoId)) {
        const promotion = await promoteQueueToCompetition({ queueId: pilotoId, competitionId: temporadaId, divisionCode: serie });
        if (!promotion.ok) return Response.json({ error: promotion.error }, { status: promotion.status });
        return Response.json({ ok: true, pilotoId: promotion.pilotId });
      }
      const pilot = await db.prepare(`SELECT 1 ok FROM pilotos WHERE id=? AND arquivado_em IS NULL LIMIT 1`).bind(pilotoId).first();
      if (!pilot) return bad("Piloto não encontrado ou arquivado.");
      const competition = await db.prepare(`SELECT COALESCE((SELECT limite_pilotos FROM divisoes WHERE temporada_id=t.id AND codigo=?),CASE WHEN t.id='2026' AND ? IN ('A','B') THEN 14 WHEN t.id='2026' AND ?='C' THEN 15 ELSE t.pilotos_por_serie END) AS limite FROM temporadas t WHERE t.id=? AND t.status='ativa' AND (EXISTS (SELECT 1 FROM divisoes WHERE temporada_id=? AND codigo=? AND status<>'cancelada') OR EXISTS (SELECT 1 FROM inscricoes WHERE temporada_id=? AND serie=?)) LIMIT 1`).bind(serie,serie,serie,temporadaId,temporadaId,serie,temporadaId,serie).first<{limite:number}>();
      if (!competition) return bad("Competição ou divisão não encontrada ou cancelada.");
      const activeCount = await db.prepare(`SELECT COUNT(*) AS total FROM inscricoes WHERE temporada_id=? AND serie=? AND COALESCE(situacao,'ativo')='ativo' AND piloto_id<>?`).bind(temporadaId,serie,pilotoId).first<{total:number}>();
      if (Number(activeCount?.total??0)>=competition.limite) return Response.json({error:`A divisão já atingiu o limite de ${competition.limite} pilotos ativos.`},{status:409});
      await db.prepare(`INSERT INTO inscricoes (temporada_id,piloto_id,serie,situacao) VALUES (?,?,?,'ativo') ON CONFLICT(temporada_id,piloto_id) DO UPDATE SET serie=excluded.serie,situacao='ativo',saida_em=NULL,motivo_saida=NULL,previsao_volta=NULL`).bind(temporadaId,pilotoId,serie).run();
    } else if (action === "remover_inscricao") {
      const temporadaId = required(body.temporadaId,30); const pilotoId = required(body.pilotoId,20);
      if (!temporadaId || !pilotoId || !/^SGT\d{3}$/.test(pilotoId)) return bad("Informe a competição e o piloto.");
      const result = await db.prepare(`UPDATE inscricoes SET situacao='saiu',saida_em=?,motivo_saida=?,previsao_volta=NULL WHERE temporada_id=? AND piloto_id=? AND COALESCE(situacao,'ativo') <> 'saiu'`)
        .bind(new Date().toISOString().slice(0,10),optional(body.motivoSaida,500),temporadaId,pilotoId).run();
      if (!result.meta.changes) return bad("Piloto não encontrado nesse grid ou já retirado.");
    } else if (action === "status_competicao") {
      const temporadaId = required(body.temporadaId,30);
      const status = body.status === "arquivada" || body.status === "cancelada" || body.status === "ativa" ? body.status : null;
      const motivo = optional(body.motivoArquivamento,500);
      if (!temporadaId || !status) return bad("Competição ou situação inválida.");
      if (status !== "ativa" && !motivo) return bad("Informe o motivo do arquivamento ou cancelamento.");
      await db.prepare(`UPDATE temporadas SET status=?,ativa=?,arquivada_em=?,motivo_arquivamento=? WHERE id=?`)
        .bind(status,status === "ativa" ? 1 : 0,status === "ativa" ? null : new Date().toISOString(),status === "ativa" ? null : motivo,temporadaId).run();
    } else if (action === "status_divisao") {
      const temporadaId = required(body.temporadaId,30); const serie = code(body.serie,20);
      const status = body.status === "arquivada" || body.status === "cancelada" || body.status === "ativa" ? body.status : null;
      const motivo = optional(body.motivoArquivamento,500);
      if (!temporadaId || !serie || !status) return bad("Divisão ou situação inválida.");
      if (status !== "ativa" && !motivo) return bad("Informe o motivo do arquivamento ou cancelamento.");
      const result = await db.prepare(`UPDATE divisoes SET status=?,arquivada_em=?,motivo_arquivamento=? WHERE temporada_id=? AND codigo=?`)
        .bind(status,status === "ativa" ? null : new Date().toISOString(),status === "ativa" ? null : motivo,temporadaId,serie).run();
      if (!result.meta.changes) return bad("Essa divisão precisa ser cadastrada no configurador antes de ser arquivada ou cancelada.");
    } else if (action === "apagar_competicao") {
      const temporadaId = required(body.temporadaId,30);
      if (!temporadaId) return bad("Competição inválida.");
      const history = await db.prepare(`SELECT (SELECT COUNT(*) FROM corridas WHERE temporada_id=?) + (SELECT COUNT(*) FROM caixa WHERE temporada_id=?) AS total`).bind(temporadaId,temporadaId).first<{total:number}>();
      if (Number(history?.total ?? 0) > 0) return bad("Essa competição possui resultados ou movimentações financeiras. Arquive-a para preservar o histórico.");
      await db.batch([
        db.prepare(`DELETE FROM inscricoes WHERE temporada_id=?`).bind(temporadaId),
        db.prepare(`DELETE FROM calendario WHERE temporada_id=?`).bind(temporadaId),
        db.prepare(`DELETE FROM divisoes WHERE temporada_id=?`).bind(temporadaId),
        db.prepare(`DELETE FROM temporadas WHERE id=?`).bind(temporadaId),
      ]);
    } else return bad("Ação inválida.");
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error && /UNIQUE|constraint/i.test(error.message) ? "Esse cadastro já existe ou conflita com outro." : "Não foi possível salvar a configuração.";
    return Response.json({ error: message }, { status: 400 });
  }
}

function bad(error:string){ return Response.json({error},{status:400}); }
function required(v:unknown,max:number){ return typeof v==="string"&&v.trim() ? v.trim().slice(0,max):null; }
function optional(v:unknown,max:number){ return typeof v==="string"&&v.trim()?v.trim().slice(0,max):null; }
function code(v:unknown,max:number){ const value=required(v,max); return value&&/^[\p{L}\p{N}_-]+$/u.test(value)?value:null; }
function slugCode(value:string|null,max:number,upper:boolean){
  if(!value)return null;
  const slug=value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,max);
  if(!slug)return null;
  return upper?slug.toUpperCase():slug.toLowerCase();
}
function positiveInt(v:unknown){ const n=Number(v); return Number.isInteger(n)&&n>0?n:null; }
function isoDate(v:unknown){ const value=optional(v,10); return value&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:null; }
function carRule(v:unknown){ return v==="regulamento"||v==="piloto"||v==="misto"?v:null; }
function color(v:unknown){ return typeof v==="string"&&/^#[0-9A-Fa-f]{6}$/.test(v)?v:null; }
function whatsappGroupUrl(v:unknown){
  const value=optional(v,300);
  if(!value)return null;
  try{const url=new URL(value);return url.protocol==="https:"&&url.hostname==="chat.whatsapp.com"?value:null;}catch{return null;}
}
