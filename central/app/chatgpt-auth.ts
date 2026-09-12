import { authConfig, getProviderUser } from "@/lib/auth-provider";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export type ChatGPTUser = {
  id: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const ACCESS_EMAIL_HEADER = "cf-access-authenticated-user-email";
const ACCESS_NAME_HEADER = "cf-access-authenticated-user-name";

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  if (authConfig()) return getProviderUser();
  const requestHeaders = await headers();
  const accessEmail = requestHeaders.get(ACCESS_EMAIL_HEADER);
  const developmentEmail =
    process.env.NODE_ENV !== "production" ? process.env.DEV_AUTH_EMAIL : null;
  const email = (accessEmail ?? developmentEmail)?.trim().toLowerCase();
  if (!email) return null;
  const fullName =
    requestHeaders.get(ACCESS_NAME_HEADER) ??
    (process.env.NODE_ENV !== "production" ? process.env.DEV_AUTH_NAME : null) ??
    null;

  return {
    id: `cloudflare-access:${email}`,
    displayName: fullName ?? email,
    email,
    fullName,
  };
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  if (authConfig()) redirect("/central/entrar");

  throw new Error(
    `Autenticação ausente para ${returnTo}. Proteja esta rota com Cloudflare Access.`,
  );
}

export function chatGPTSignInPath(returnTo: string): string {
  return safeRelativeReturnPath(returnTo);
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  return safeRelativeReturnPath(returnTo);
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
