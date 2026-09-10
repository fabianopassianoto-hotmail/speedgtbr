import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getD1Binding } from "@/db";
import { ensureCurrentUserAccess } from "@/db/access";

export const dynamic = "force-dynamic";

const pilotColumns = {
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
  ativo: "ativo",
  cadastroStatus: "cadastro_status",
  dataNascimento: "data_nascimento",
  dataEntrada: "data_entrada",
} as const;

const enrollmentColumns = {
  saidaEm: "saida_em",
  motivoSaida: "motivo_saida",
  previsaoVolta: "previsao_volta",
} as const;

type PilotField = keyof typeof pilotColumns;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Autenticação obrigatória." }, { status: 401 });
  }

  const access = await ensureCurrentUserAccess(user);
  if (!access) {
    return Response.json({ error: "Usuário sem acesso ativo." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!/^SGT\d{3}$/.test(id)) {
    return Response.json({ error: "Piloto inválido." }, { status: 400 });
  }

  let body: { field?: unknown; value?: unknown };
  try {
    body = (await request.json()) as { field?: unknown; value?: unknown };
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  if (typeof body.field !== "string") {
    return Response.json({ error: "Campo inválido." }, { status: 400 });
  }

  const db = getD1Binding();
  const enrollment = await db
    .prepare(
      `SELECT serie, situacao FROM inscricoes
       WHERE temporada_id = '2026' AND piloto_id = ?
       LIMIT 1`,
    )
    .bind(id)
    .first<{
      serie: "A" | "B" | "C";
      situacao: "ativo" | "suplente" | "inativo" | "saiu" | null;
    }>();

  if (
    access.papel === "coordenador" &&
    (!enrollment || !access.serie || access.serie !== enrollment.serie)
  ) {
    return Response.json(
      { error: "Você só pode editar pilotos da sua série." },
      { status: 403 },
    );
  }

  if (body.field === "participacaoTemporada") {
    if (access.papel !== "administrador") {
      return Response.json(
        { error: "Apenas o administrador altera a participação na temporada." },
        { status: 403 },
      );
    }
    if (!body.value || typeof body.value !== "object") {
      return Response.json({ error: "Participação inválida." }, { status: 400 });
    }
    if (!enrollment) {
      return Response.json({ error: "Piloto não inscrito em 2026." }, { status: 404 });
    }
    const value = body.value as { serie?: unknown; situacao?: unknown };
    if (value.serie !== "A" && value.serie !== "B" && value.serie !== "C") {
      return Response.json({ error: "Série inválida." }, { status: 400 });
    }
    if (
      value.situacao !== "ativo" &&
      value.situacao !== "suplente" &&
      value.situacao !== "inativo" &&
      value.situacao !== "saiu"
    ) {
      return Response.json({ error: "Situação inválida." }, { status: 400 });
    }
    const willBecomeActive =
      value.situacao === "ativo" &&
      (enrollment.serie !== value.serie ||
        (enrollment.situacao !== null && enrollment.situacao !== "ativo"));
    if (willBecomeActive) {
      const limitRow = await db
        .prepare(
          `SELECT d.limite_pilotos AS limite, t.pilotos_por_serie AS geral
           FROM temporadas t LEFT JOIN divisoes d
             ON d.temporada_id = t.id AND d.codigo = ?
           WHERE t.id = '2026'`,
        )
        .bind(value.serie)
        .first<{ limite: number | null; geral: number }>();
      const activeCount = await db
        .prepare(
          `SELECT COUNT(*) AS total FROM inscricoes
           WHERE temporada_id = '2026' AND serie = ?
             AND COALESCE(situacao, 'ativo') = 'ativo'`,
        )
        .bind(value.serie)
        .first<{ total: number }>();
      const limit = Number(limitRow?.limite ?? (value.serie === "A" || value.serie === "B" ? 14 : value.serie === "C" ? 15 : limitRow?.geral ?? 15));
      if (Number(activeCount?.total ?? 0) >= limit) {
        return Response.json(
          { error: `A Série ${value.serie} já atingiu o limite de ${limit} pilotos ativos.` },
          { status: 409 },
        );
      }
    }
    await db
      .prepare(
        `UPDATE inscricoes SET serie = ?, situacao = ?
         WHERE temporada_id = '2026' AND piloto_id = ?`,
      )
      .bind(value.serie, value.situacao, id)
      .run();
    return Response.json({
      ok: true,
      serie: value.serie,
      situacao: value.situacao,
    });
  }

  if (body.field in enrollmentColumns) {
    if (access.papel !== "administrador") {
      return Response.json(
        { error: "Apenas o administrador edita o histórico de saída." },
        { status: 403 },
      );
    }
    if (!enrollment) return Response.json({ error: "Piloto sem inscrição atual." }, { status: 404 });
    if (body.value !== null && typeof body.value !== "string") {
      return Response.json({ error: "Valor inválido." }, { status: 400 });
    }
    const field = body.field as keyof typeof enrollmentColumns;
    const value = body.value?.trim() || null;
    if (field === "saidaEm" && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return Response.json({ error: "Data de saída inválida." }, { status: 400 });
    }
    if (value && value.length > 500) {
      return Response.json({ error: "Texto muito longo." }, { status: 400 });
    }
    await db
      .prepare(
        `UPDATE inscricoes SET ${enrollmentColumns[field]} = ?
         WHERE temporada_id = '2026' AND piloto_id = ?`,
      )
      .bind(value, id)
      .run();
    return Response.json({ ok: true, value });
  }

  if (body.field === "serie") {
    if (access.papel !== "administrador") {
      return Response.json(
        { error: "Apenas o administrador altera a série." },
        { status: 403 },
      );
    }
    if (!enrollment) return Response.json({ error: "Piloto sem inscrição atual." }, { status: 404 });
    if (body.value !== "A" && body.value !== "B" && body.value !== "C") {
      return Response.json({ error: "Série inválida." }, { status: 400 });
    }
    if (body.value !== enrollment.serie && enrollment.situacao !== "saiu" && enrollment.situacao !== "suplente") {
      const limitRow = await db
        .prepare(
          `SELECT d.limite_pilotos AS limite, t.pilotos_por_serie AS geral
           FROM temporadas t LEFT JOIN divisoes d
             ON d.temporada_id = t.id AND d.codigo = ?
           WHERE t.id = '2026'`,
        )
        .bind(body.value)
        .first<{ limite: number | null; geral: number }>();
      const targetCount = await db
        .prepare(
          `SELECT COUNT(*) AS total FROM inscricoes
           WHERE temporada_id = '2026' AND serie = ?
             AND COALESCE(situacao, 'ativo') = 'ativo'`,
        )
        .bind(body.value)
        .first<{ total: number }>();
      const limit = Number(limitRow?.limite ?? (body.value === "A" || body.value === "B" ? 14 : body.value === "C" ? 15 : limitRow?.geral ?? 15));
      if (Number(targetCount?.total ?? 0) >= limit) {
        return Response.json(
          { error: `A Série ${body.value} já atingiu o limite de ${limit} pilotos ativos.` },
          { status: 409 },
        );
      }
    }
    await db
      .prepare(
        `UPDATE inscricoes SET serie = ?
         WHERE temporada_id = '2026' AND piloto_id = ?`,
      )
      .bind(body.value, id)
      .run();
    return Response.json({ ok: true, value: body.value });
  }

  if (body.field === "situacao") {
    if (access.papel !== "administrador") {
      return Response.json(
        { error: "Apenas o administrador altera a situação no campeonato." },
        { status: 403 },
      );
    }
    if (!enrollment) return Response.json({ error: "Piloto sem inscrição atual." }, { status: 404 });
    if (
      body.value !== "ativo" &&
      body.value !== "suplente" &&
      body.value !== "inativo" &&
      body.value !== "saiu"
    ) {
      return Response.json({ error: "Situação inválida." }, { status: 400 });
    }
    if (body.value === "ativo" && enrollment.situacao !== null && enrollment.situacao !== "ativo") {
      const limitRow = await db
        .prepare(
          `SELECT d.limite_pilotos AS limite, t.pilotos_por_serie AS geral
           FROM temporadas t LEFT JOIN divisoes d
             ON d.temporada_id = t.id AND d.codigo = ?
           WHERE t.id = '2026'`,
        )
        .bind(enrollment.serie)
        .first<{ limite: number | null; geral: number }>();
      const activeCount = await db
        .prepare(
          `SELECT COUNT(*) AS total FROM inscricoes
           WHERE temporada_id = '2026' AND serie = ?
             AND COALESCE(situacao, 'ativo') = 'ativo'`,
        )
        .bind(enrollment.serie)
        .first<{ total: number }>();
      const limit = Number(limitRow?.limite ?? (enrollment.serie === "A" || enrollment.serie === "B" ? 14 : enrollment.serie === "C" ? 15 : limitRow?.geral ?? 15));
      if (Number(activeCount?.total ?? 0) >= limit) {
        return Response.json(
          { error: `A Série ${enrollment.serie} já atingiu o limite de ${limit} pilotos ativos.` },
          { status: 409 },
        );
      }
    }
    await db
      .prepare(
        `UPDATE inscricoes SET situacao = ?
         WHERE temporada_id = '2026' AND piloto_id = ?`,
      )
      .bind(body.value, id)
      .run();
    return Response.json({ ok: true, value: body.value });
  }

  if (!(body.field in pilotColumns)) {
    return Response.json({ error: "Campo não editável." }, { status: 400 });
  }

  const field = body.field as PilotField;
  let value: string | number | null;
  if (field === "ativo") {
    if (body.value === null) value = null;
    else if (body.value === true) value = 1;
    else if (body.value === false) value = 0;
    else {
      return Response.json({ error: "Estado inválido." }, { status: 400 });
    }
  } else {
    if (body.value !== null && typeof body.value !== "string") {
      return Response.json({ error: "Valor inválido." }, { status: 400 });
    }
    const normalized = body.value?.trim() || null;
    if ((field === "dataNascimento" || field === "dataEntrada") && normalized && !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return Response.json({ error: "Data inválida." }, { status: 400 });
    }
    if (field === "dataNascimento" && normalized && normalized > new Date().toISOString().slice(0, 10)) {
      return Response.json({ error: "A data de nascimento não pode estar no futuro." }, { status: 400 });
    }
    if (field === "apelido" && !normalized) {
      return Response.json(
        { error: "O apelido de narração é obrigatório." },
        { status: 400 },
      );
    }
    if (
      field === "cadastroStatus" &&
      normalized !== null &&
      normalized !== "completo" &&
      normalized !== "incompleto"
    ) {
      return Response.json(
        { error: "Controle de cadastro inválido." },
        { status: 400 },
      );
    }
    value = normalized;
  }

  const column = pilotColumns[field];
  await db
    .prepare(`UPDATE pilotos SET ${column} = ? WHERE id = ?`)
    .bind(value, id)
    .run();

  return Response.json({
    ok: true,
    value: field === "ativo" ? body.value : value,
  });
}
