import { getD1Binding } from "@/db";

export const dynamic = "force-dynamic";

const fieldNames = [
  "nomeCompleto",
  "psn",
  "simgrid",
  "simgridUrl",
  "whatsapp",
  "email",
  "cidade",
  "uf",
  "volanteOuControle",
  "perfilPilotagem",
  "disponibilidade",
  "carroPreferido",
  "pistaCitada",
  "dataNascimento",
  "curiosidade",
] as const;

type FormBody = Partial<Record<(typeof fieldNames)[number], unknown>> & {
  empresa?: unknown;
};

export async function POST(request: Request) {
  let body: FormBody;
  try {
    body = (await request.json()) as FormBody;
  } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  if (body.empresa) {
    return Response.json({ ok: true });
  }

  const values = Object.fromEntries(
    fieldNames.map((field) => {
      const value = body[field];
      return [field, typeof value === "string" ? value.trim() || null : null];
    }),
  ) as Record<(typeof fieldNames)[number], string | null>;

  if (!values.nomeCompleto || values.nomeCompleto.length < 3) {
    return Response.json(
      { error: "Informe seu nome completo." },
      { status: 400 },
    );
  }
  const phoneDigits = values.whatsapp?.replace(/\D/g, "") ?? "";
  if (phoneDigits.length < 10 || phoneDigits.length > 13) {
    return Response.json(
      { error: "Informe um WhatsApp válido com DDD." },
      { status: 400 },
    );
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }
  if (values.uf && !/^[A-Za-z]{2}$/.test(values.uf)) {
    return Response.json({ error: "Informe a UF com duas letras." }, { status: 400 });
  }
  if (values.dataNascimento && !/^\d{4}-\d{2}-\d{2}$/.test(values.dataNascimento)) {
    return Response.json({ error: "Informe uma data de nascimento válida." }, { status: 400 });
  }
  if (values.dataNascimento && values.dataNascimento > new Date().toISOString().slice(0, 10)) {
    return Response.json({ error: "A data de nascimento não pode estar no futuro." }, { status: 400 });
  }
  if (values.volanteOuControle && !["Volante", "Controle", "Volante e controle"].includes(values.volanteOuControle)) {
    return Response.json({ error: "Escolha uma opção válida para volante ou controle." }, { status: 400 });
  }
  if (Object.values(values).some((value) => value && value.length > 500)) {
    return Response.json(
      { error: "Um dos campos ultrapassou o tamanho permitido." },
      { status: 400 },
    );
  }

  const db = getD1Binding();
  const pendingPhones = await db
    .prepare(
      `SELECT whatsapp FROM formularios_pendentes
       WHERE status = 'pendente'`,
    )
    .all<{ whatsapp: string }>();
  if (
    pendingPhones.results.some(
      (row) => row.whatsapp.replace(/\D/g, "") === phoneDigits,
    )
  ) {
    return Response.json(
      { error: "Já existe um formulário pendente para este WhatsApp." },
      { status: 409 },
    );
  }

  await db
    .prepare(
      `INSERT INTO formularios_pendentes (
         criado_em, nome_completo, psn, simgrid, simgrid_url, whatsapp,
         email, cidade, uf, volante_ou_controle, perfil_pilotagem,
         disponibilidade, carro_preferido, pista_citada, data_nascimento,
         curiosidade, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')`,
    )
    .bind(
      new Date().toISOString(),
      values.nomeCompleto,
      values.psn,
      values.simgrid,
      values.simgridUrl,
      values.whatsapp,
      values.email,
      values.cidade,
      values.uf?.toUpperCase() ?? null,
      values.volanteOuControle,
      values.perfilPilotagem,
      values.disponibilidade,
      values.carroPreferido,
      values.pistaCitada,
      values.dataNascimento,
      values.curiosidade,
    )
    .run();

  return Response.json({ ok: true });
}
