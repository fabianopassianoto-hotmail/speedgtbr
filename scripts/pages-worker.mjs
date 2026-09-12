import central from "./central/index.js";
import { onRequestGet } from "./championships.js";

function unavailable(status, message) {
  return new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Central | Speed GT Brasil</title><body style="margin:0;background:#0B0B0E;color:#F4F1EA;font:18px Arial;padding:48px"><main><h1 style="color:#60A5FA">Central</h1><p>' + message + '</p><a style="color:#60A5FA" href="/">Voltar ao site</a></main></body></html>', { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    const target = new URL(request.url);
    if (["/comece-aqui", "/comece-aqui/", "/central/central", "/central/central/", "/central/cadastro", "/central/cadastro/", "/cadastro/"].includes(path)) {
      target.pathname = "/cadastro";
      return Response.redirect(target.href, 307);
    }
    if (path === "/central" || path === "/central/" || path === "/admin/") {
      target.pathname = "/admin";
      return Response.redirect(target.href, 307);
    }
    const championship = path.match(/^\/api\/championships\/([^/]+)\/?$/);
    if (championship) {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET" } });
      return onRequestGet({ request, env, params: { id: championship[1] } });
    }
    if (path === "/admin" || path === "/cadastro" || path.startsWith("/central/")) {
      if (/^\/central\/(assets|brand)\//.test(path) || /^\/central\/(og\.png|favicon\.svg)$/.test(path)) return env.ASSETS.fetch(request);
      if (!env.DB) return unavailable(503, "A central está em preparação. Volte em breve.");
      const headers = new Headers(request.headers);
      headers.delete("cf-access-authenticated-user-email");
      headers.delete("cf-access-authenticated-user-name");
      if (path === "/admin") target.pathname = "/central";
      if (path === "/cadastro") target.pathname = "/central/cadastro";
      return central.fetch(new Request(target, new Request(request, { headers })), env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
};
