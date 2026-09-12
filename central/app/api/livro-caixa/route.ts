import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureCurrentUserAccess } from "@/db/access";
import { getD1Binding } from "@/db";
export const dynamic="force-dynamic";
async function auth(){const u=await getChatGPTUser();if(!u)return null;const a=await ensureCurrentUserAccess(u);return a?.papel==="administrador"?a:null;}
export async function GET(){if(!await auth())return Response.json({error:"Acesso não autorizado."},{status:403});const db=getD1Binding();const entries=await db.prepare(`SELECT id,'livro' origem,natureza,categoria,descricao,valor,data,responsavel,comprovante,piloto_id,temporada_id FROM livro_caixa UNION ALL SELECT CAST(id AS TEXT),'pagamento','receita',tipo,nome,valor,data,COALESCE((SELECT usuario FROM atividades WHERE entidade='caixa' AND identificador=CAST(caixa.id AS TEXT) AND acao='criou' ORDER BY id LIMIT 1),'Registro anterior ao log'),NULL,piloto_id,temporada_id FROM caixa ORDER BY data DESC`).all();return Response.json({entries:entries.results});}
export async function POST(request:Request){const a=await auth();if(!a)return Response.json({error:"Acesso não autorizado."},{status:403});try{const b=await request.json() as any;
 if(!["receita","despesa"].includes(b.natureza)||!b.categoria?.trim()||!b.descricao?.trim()||!Number.isSafeInteger(b.valor)||b.valor<=0||b.valor>100000000000||!/^\d{4}-\d{2}-\d{2}$/.test(b.data)||new Date(b.data).toISOString().slice(0,10)!==b.data)throw new Error("Preencha tipo, categoria, descrição, data válida e valor positivo.");
 if(b.comprovante && !/^https:\/\//i.test(b.comprovante))throw new Error("Use um link HTTPS para o comprovante.");
 const db=getD1Binding(),id=crypto.randomUUID();
 await db.prepare("INSERT INTO livro_caixa(id,natureza,categoria,descricao,valor,data,responsavel,comprovante,piloto_id,temporada_id) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(id,b.natureza,b.categoria.trim().slice(0,80),b.descricao.trim().slice(0,500),b.valor,b.data,a.email,b.comprovante?.slice(0,2000)||null,b.pilotoId||null,b.temporadaId||null).run();return Response.json({ok:true});
 }catch(e){return Response.json({error:e instanceof Error?e.message:"Não foi possível registrar."},{status:400});}}
export async function DELETE(request:Request){if(!await auth())return Response.json({error:"Acesso não autorizado."},{status:403});const b=await request.json() as any;await getD1Binding().prepare("DELETE FROM livro_caixa WHERE id=?").bind(String(b.id)).run();return Response.json({ok:true});}
