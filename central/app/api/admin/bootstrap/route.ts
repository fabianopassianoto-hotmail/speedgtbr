import { getChatGPTUser } from "@/app/chatgpt-auth";
import { bootstrapDatabase } from "@/db/bootstrap";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Autenticação obrigatória." }, { status: 401 });
  }

  try {
    const counts = await bootstrapDatabase();
    return Response.json({ status: "ready", counts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na carga inicial.";
    return Response.json({ error: message }, { status: 409 });
  }
}
