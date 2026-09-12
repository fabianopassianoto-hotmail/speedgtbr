// Compatibility names retained for the existing route handlers. No login is required.
export type ChatGPTUser = { id: string; displayName: string; email: string; fullName: string | null };
export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  return { id: "central-public", displayName: "Acesso público", email: "Acesso público", fullName: null };
}
export async function requireChatGPTUser(_returnTo: string): Promise<ChatGPTUser> {
  return (await getChatGPTUser())!;
}
export function chatGPTSignInPath(_returnTo: string) { return "/central"; }
export function chatGPTSignOutPath(_returnTo = "/") { return "/central"; }
