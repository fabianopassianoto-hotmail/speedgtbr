import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getD1Binding } from "@/db";
import { ensureCurrentUserAccess } from "@/db/access";

export const dynamic = "force-dynamic";

type FormRow = {
  id: number;
  nome_completo: string;
  psn: string | null;
  simgrid: string | null;
  simgrid_url: string | null;
  whatsapp: string;
  email: string | null;
  cidade: string | null;
  uf: string | null;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  cep: string | null;
  complemento: string | null;
  classificacao_gt7: string | null;
  volante_ou_controle: string | null;
  perfil_pilotagem: string | null;
  disponibilidade: string | null;
  carro_preferido: string | null;
  pista_citada: string | null;
  data_nascimento: string | null;
  curiosidade: string | null;
};

const submittedColumns = [
  ["nome_completo", "nome_completo"],
  ["psn", "psn"],
  ["simgrid", "simgrid"],
  ["simgrid_url", "simgrid_url"],
  ["whatsapp", "whatsapp"],
  ["email", "email"],
  ["cidade", "cidade"],
  ["uf", "uf"],
  ["rua", "rua"],
  ["numero", "numero"],
  ["bairro", "bairro"],
  ["cep", "cep"],
  ["complemento", "complemento"],
  ["classificacao_gt7", "classificacao_gt7"],
  ["volante_ou_controle", "volante_ou_controle"],
  ["perfil_pilotagem", "perfil_pilotagem"],
  ["disponibilidade", "disponibilidade"],
  ["carro_preferido", "carro_preferido"],
  ["pista_citada", "pista_citada"],
  ["data_nascimento", "data_nascimento"],
  ["curiosidade", "curiosidade"],
] as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Autenticação obrigatória." }, { status: 401 });
  }
  const access = await ensureCurrentUserAccess(user);
  if (!access || access.papel !== "administrador") {
    return Response.json(
      { error: "Apenas o administrador aprova formulários." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const formId = Number(id);
  if (!Number.isInteger(formId) || formId <= 0) {
    return Response.json({ error: "Formulário inválido." }, { status: 400 });
  }
  let body: {
    action?: unknown;
    targetKind?: unknown;
    targetId?: unknown;
    apelido?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const db = getD1Binding();
  const form = await db
    .prepare(
      `SELECT id, nome_completo, psn, simgrid, simgrid_url, whatsapp, email,
              cidade, uf, rua, numero, bairro, cep, complemento, classificacao_gt7, volante_ou_controle, perfil_pilotagem,
              disponibilidade, carro_preferido, pista_citada,
              data_nascimento, curiosidade
       FROM formularios_pendentes
       WHERE id = ? AND status = 'pendente'
       LIMIT 1`,
    )
    .bind(formId)
    .first<FormRow>();
  if (!form) {
    return Response.json(
      { error: "Formulário pendente não encontrado." },
      { status: 404 },
    );
  }

  if (body.action === "descartar") {
    await db
      .prepare(
        `UPDATE formularios_pendentes
         SET status = 'descartado', revisado_em = ?
         WHERE id = ?`,
      )
      .bind(new Date().toISOString(), formId)
      .run();
    return Response.json({ ok: true });
  }

  if (body.action === "aplicar") {
    const targetKind = body.targetKind;
    const targetId = body.targetId;
    if (
      (targetKind !== "piloto" && targetKind !== "fila") ||
      typeof targetId !== "string"
    ) {
      return Response.json({ error: "Escolha uma pessoa existente." }, { status: 400 });
    }
    const table = targetKind === "piloto" ? "pilotos" : "fila";
    const idPattern = targetKind === "piloto" ? /^SGT\d{3}$/ : /^FIL\d{3}$/;
    if (!idPattern.test(targetId)) {
      return Response.json({ error: "Pessoa inválida." }, { status: 400 });
    }
    const activeQueueCondition =
      targetKind === "fila" ? " AND promovido_para_piloto_id IS NULL" : "";
    const exists = await db
      .prepare(
        `SELECT id FROM ${table} WHERE id = ?${activeQueueCondition} LIMIT 1`,
      )
      .bind(targetId)
      .first<{ id: string }>();
    if (!exists) {
      return Response.json({ error: "Pessoa não encontrada." }, { status: 404 });
    }

    const filled = submittedColumns.filter(([source]) => form[source] !== null);
    const assignments = filled.map(([, column]) => `${column} = ?`).join(", ");
    const updatePerson = db
      .prepare(`UPDATE ${table} SET ${assignments} WHERE id = ?`)
      .bind(...filled.map(([source]) => form[source]), targetId);
    const finishForm = db
      .prepare(
        `UPDATE formularios_pendentes
         SET status = 'aplicado', revisado_em = ?, destino_tipo = ?, destino_id = ?
         WHERE id = ?`,
      )
      .bind(new Date().toISOString(), targetKind, targetId, formId);
    await db.batch([updatePerson, finishForm]);
    return Response.json({ ok: true });
  }

  if (body.action === "nova_fila") {
    const apelido = typeof body.apelido === "string" ? body.apelido.trim() : "";
    if (!apelido) {
      return Response.json(
        { error: "Informe o apelido antes de adicionar à fila." },
        { status: 400 },
      );
    }
    const maxId = await db
      .prepare(
        `SELECT COALESCE(MAX(CAST(SUBSTR(id, 4) AS INTEGER)), 0) AS maior
         FROM fila`,
      )
      .first<{ maior: number }>();
    const nextNumber = Number(maxId?.maior ?? 0) + 1;
    if (nextNumber > 999) {
      return Response.json(
        { error: "O limite de identificadores da fila foi atingido." },
        { status: 409 },
      );
    }
    const queueId = `FIL${String(nextNumber).padStart(3, "0")}`;
    await db.batch([
      db
        .prepare(
          `INSERT INTO fila (
             id, apelido, nome_completo, psn, simgrid, simgrid_url, whatsapp,
             cidade, uf, rua, numero, bairro, cep, complemento, classificacao_gt7, email, volante_ou_controle, perfil_pilotagem,
             disponibilidade, carro_preferido, pista_citada, data_nascimento,
             curiosidade, data_entrada
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          queueId,
          apelido,
          form.nome_completo,
          form.psn,
          form.simgrid,
          form.simgrid_url,
          form.whatsapp,
          form.cidade,
          form.uf,
          form.rua,
          form.numero,
          form.bairro,
          form.cep,
          form.complemento,
          form.classificacao_gt7,
          form.email,
          form.volante_ou_controle,
          form.perfil_pilotagem,
          form.disponibilidade,
          form.carro_preferido,
          form.pista_citada,
          form.data_nascimento,
          form.curiosidade,
          new Date().toISOString().slice(0, 10),
        ),
      db
        .prepare(
          `UPDATE formularios_pendentes
           SET status = 'aplicado', revisado_em = ?, destino_tipo = 'fila', destino_id = ?
           WHERE id = ?`,
        )
        .bind(new Date().toISOString(), queueId, formId),
    ]);
    return Response.json({ ok: true, queueId });
  }

  return Response.json({ error: "Ação inválida." }, { status: 400 });
}
