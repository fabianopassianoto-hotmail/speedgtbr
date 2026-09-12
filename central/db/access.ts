import { setAuditActor } from "@/db/audit-context";
import type { ChatGPTUser } from "@/app/chatgpt-auth";
import { getD1Binding } from "@/db";

export type UserAccess = {
  id: number;
  accountUserId: string;
  email: string;
  nome: string | null;
  papel: "administrador" | "coordenador";
  serie: string | null;
  ativo: boolean;
};

type AccessRow = {
  id: number;
  account_user_id: string | null;
  email: string;
  nome: string | null;
  papel: "administrador" | "coordenador";
  serie: string | null;
  ativo: number;
};

export type AccessRequest = {
  id: number;
  accountUserId: string;
  email: string;
  nome: string | null;
  status: "pendente" | "aprovado" | "negado";
  criadoEm: string;
};

type AccessRequestRow = {
  id: number;
  account_user_id: string;
  email: string;
  nome: string | null;
  status: "pendente" | "aprovado" | "negado";
  criado_em: string;
};

export async function ensureCurrentUserAccess(
  user: ChatGPTUser,
): Promise<UserAccess | null> {
  setAuditActor(user.fullName ? `${user.fullName} <${user.email}>` : user.email);
  const db = getD1Binding();
  const email = user.email.trim().toLowerCase();
  const found = await db
    .prepare(
      `SELECT id, account_user_id, email, nome, papel, serie, ativo
       FROM usuarios_acessos
       WHERE account_user_id = ? OR email = ?
       LIMIT 1`,
    )
    .bind(user.id, email)
    .first<AccessRow>();

  if (found) {
    if (!found.account_user_id) {
      await db
        .prepare(
          `UPDATE usuarios_acessos
           SET account_user_id = ?, nome = COALESCE(nome, ?)
           WHERE id = ?`,
        )
        .bind(user.id, user.fullName, found.id)
        .run();
      found.account_user_id = user.id;
      found.nome ??= user.fullName;
    }
    return found.ativo ? {...mapAccess({...found,account_user_id:found.account_user_id??user.id}),papel:"administrador",serie:null} : null;
  }

  if(user.id.startsWith("supabase:"))return null;
  const count = await db
    .prepare("SELECT COUNT(*) AS total FROM usuarios_acessos")
    .first<{ total: number }>();
  if (Number(count?.total ?? 0) !== 0) return null;

  const inserted = await db
    .prepare(
      `INSERT INTO usuarios_acessos
       (account_user_id, email, nome, papel, serie, ativo)
       VALUES (?, ?, ?, 'administrador', NULL, 1)
       RETURNING id, account_user_id, email, nome, papel, serie, ativo`,
    )
    .bind(user.id, email, user.fullName)
    .first<AccessRow>();

  if (!inserted) throw new Error("Não foi possível criar o acesso administrador.");
  return mapAccess(inserted);
}

export async function ensureCurrentAccessRequest(
  user: ChatGPTUser,
): Promise<AccessRequest> {
  const db = getD1Binding();
  const email = user.email.trim().toLowerCase();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO solicitacoes_acesso
       (account_user_id, email, nome, status, criado_em)
       VALUES (?, ?, ?, 'pendente', ?)
       ON CONFLICT(account_user_id) DO UPDATE SET
         email = excluded.email,
         nome = COALESCE(excluded.nome, solicitacoes_acesso.nome)`,
    )
    .bind(user.id, email, user.fullName, now)
    .run();
  const request = await db
    .prepare(
      `SELECT id, account_user_id, email, nome, status, criado_em
       FROM solicitacoes_acesso WHERE account_user_id = ? LIMIT 1`,
    )
    .bind(user.id)
    .first<AccessRequestRow>();
  if (!request) throw new Error("Não foi possível registrar a solicitação de acesso.");
  return mapAccessRequest(request);
}

export async function getPendingAccessRequests(): Promise<AccessRequest[]> {
  const db = getD1Binding();
  const rows = await db
    .prepare(
      `SELECT id, account_user_id, email, nome, status, criado_em
       FROM solicitacoes_acesso
       WHERE status = 'pendente'
       ORDER BY criado_em ASC`,
    )
    .all<AccessRequestRow>();
  return rows.results.map(mapAccessRequest);
}

function mapAccess(row: AccessRow): UserAccess {
  if (!row.account_user_id) {
    throw new Error("Usuário autorizado ainda não vinculou sua conta.");
  }
  return {
    id: row.id,
    accountUserId: row.account_user_id,
    email: row.email,
    nome: row.nome,
    papel: row.papel,
    serie: row.serie,
    ativo: Boolean(row.ativo),
  };
}

function mapAccessRequest(row: AccessRequestRow): AccessRequest {
  return {
    id: row.id,
    accountUserId: row.account_user_id,
    email: row.email,
    nome: row.nome,
    status: row.status,
    criadoEm: row.criado_em,
  };
}
