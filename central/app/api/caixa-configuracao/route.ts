import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureCurrentUserAccess } from "@/db/access";
import { getD1Binding } from "@/db";

const fields = ["medalhaIndividual", "medalhaTemporada", "freteIndividual", "freteTemporada", "saldoCaixa"] as const;
async function authorized() {
  const user = await getChatGPTUser();
  return user && (await ensureCurrentUserAccess(user))?.papel === "administrador";
}
export async function GET(request: Request) {
  if (!await authorized()) return Response.json({error:"Acesso restrito ao administrador."},{status:403});
  const id = new URL(request.url).searchParams.get("temporadaId");
  if (!id) return Response.json({error:"Selecione uma temporada."},{status:400});
  const config = await getD1Binding().prepare(`SELECT medalha_individual AS medalhaIndividual, medalha_temporada AS medalhaTemporada, frete_individual AS freteIndividual, frete_temporada AS freteTemporada, saldo_caixa AS saldoCaixa FROM caixa_configuracao WHERE temporada_id=?`).bind(id).first();
  return Response.json({config:config ?? Object.fromEntries(fields.map(f=>[f,0]))});
}
export async function POST(request: Request) {
  if (!await authorized()) return Response.json({error:"Acesso restrito ao administrador."},{status:403});
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({error:"Dados inválidos."},{status:400}); }
  if (typeof body.temporadaId !== "string" || fields.some(f=>typeof body[f]!=="number"||!Number.isSafeInteger(body[f])||Number(body[f])<0||Number(body[f])>100000000)) return Response.json({error:"Informe valores válidos, sem números negativos."},{status:400});
  const db=getD1Binding();
  if (!await db.prepare(`SELECT id FROM temporadas WHERE id=? AND status<>'cancelada'`).bind(body.temporadaId).first()) return Response.json({error:"Temporada indisponível."},{status:400});
  await db.prepare(`INSERT INTO caixa_configuracao (temporada_id,medalha_individual,medalha_temporada,frete_individual,frete_temporada,saldo_caixa) VALUES (?,?,?,?,?,?) ON CONFLICT(temporada_id) DO UPDATE SET medalha_individual=excluded.medalha_individual,medalha_temporada=excluded.medalha_temporada,frete_individual=excluded.frete_individual,frete_temporada=excluded.frete_temporada,saldo_caixa=excluded.saldo_caixa`).bind(body.temporadaId,...fields.map(f=>body[f])).run();
  return Response.json({ok:true});
}
