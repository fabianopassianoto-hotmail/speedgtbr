export async function GET() { return new Response(null, { status: 303, headers: { Location: "/central" } }); }
export async function POST() { return Response.json({ error: "Login removido. A Central tem acesso direto." }, { status: 410 }); }
