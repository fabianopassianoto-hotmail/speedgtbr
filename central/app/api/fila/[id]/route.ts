import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getD1Binding } from "@/db";
import { ensureCurrentUserAccess } from "@/db/access";

export const dynamic = "force-dynamic";

const textColumns = {
  apelido: "apelido",
  nomeCompleto: "nome_completo",
  psn: "psn",
  simgrid: "simgrid",
  simgridUrl: "simgrid_url",
  whatsapp: "whatsapp",
  email: "email",
  cidade: "cidade",
  uf: "uf",
  volanteOuControle: "volante_ou_controle",
  perfilPilotagem: "perfil_pilotagem",
  disponibilidade: "disponibilidade",
  carroPreferido: "carro_preferido",
  pistaCitada: "pista_citada",
  relacoes: "relacoes",
  curiosidade: "curiosidade",
  observacoesAdm: "observacoes_adm",
  cadastroStatus: "cadastro_status",
  conduta: "conduta",
  dataNascimento: "data_nascimento",
  dataEntrada: "data_entrada",
} as const;

const booleanColumns = {
  ativo: "ativo",
  prontoParaSerie: "pronto_para_serie",
} as const;

export async function PATCH(
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
      { error: "Apenas o administrador edita a fila." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  if (!/^FIL\d{3}$/.test(id)) {
    return Response.json({ error: "Pessoa da fila inválida." }, { status: 400 });
  }

  let body: { field?: unknown; value?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (typeof body.field !== "string") {
    return Response.json({ error: "Campo inválido." }, { status: 400 });
  }

  const db = getD1Binding();
  const exists = await db
    .prepare(
      `SELECT id FROM fila
       WHERE id = ? AND promovido_para_piloto_id IS NULL
       LIMIT 1`,
    )
    .bind(id)
    .first<{ id: string }>();
  if (!exists) {
    return Response.json({ error: "Pessoa não encontrada na fila." }, { status: 404 });
  }

  if (body.field in textColumns) {
    if (body.value !== null && typeof body.value !== "string") {
      return Response.json({ error: "Valor inválido." }, { status: 400 });
    }
    const field = body.field as keyof typeof textColumns;
    const value = body.value?.trim() || null;
    if ((field === "dataNascimento" || field === "dataEntrada") && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return Response.json({ error: "Data inválida." }, { status: 400 });
    }
    if (field === "dataNascimento" && value && value > new Date().toISOString().slice(0, 10)) {
      return Response.json({ error: "A data de nascimento não pode estar no futuro." }, { status: 400 });
    }
    if (field === "apelido" && !value) {
      return Response.json({ error: "O apelido é obrigatório." }, { status: 400 });
    }
    if (
      field === "cadastroStatus" &&
      value !== null &&
      value !== "completo" &&
      value !== "incompleto"
    ) {
      return Response.json(
        { error: "Controle de cadastro inválido." },
        { status: 400 },
      );
    }
    await db
      .prepare(`UPDATE fila SET ${textColumns[field]} = ? WHERE id = ?`)
      .bind(value, id)
      .run();
    return Response.json({ ok: true, value });
  }

  if (body.field in booleanColumns) {
    if (body.value !== null && typeof body.value !== "boolean") {
      return Response.json({ error: "Estado inválido." }, { status: 400 });
    }
    const field = body.field as keyof typeof booleanColumns;
    const value = body.value === null ? null : body.value ? 1 : 0;
    await db
      .prepare(`UPDATE fila SET ${booleanColumns[field]} = ? WHERE id = ?`)
      .bind(value, id)
      .run();
    return Response.json({ ok: true, value: body.value });
  }

  if (body.field === "corridas4fun") {
    if (
      body.value !== null &&
      (!Number.isInteger(body.value) || Number(body.value) < 0)
    ) {
      return Response.json(
        { error: "Informe um número de corridas válido." },
        { status: 400 },
      );
    }
    await db
      .prepare("UPDATE fila SET corridas_4fun = ? WHERE id = ?")
      .bind(body.value, id)
      .run();
    return Response.json({ ok: true, value: body.value });
  }

  return Response.json({ error: "Campo não editável." }, { status: 400 });
}
