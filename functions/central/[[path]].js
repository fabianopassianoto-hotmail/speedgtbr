export function onRequest() {
  return new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Central | Speed GT Brasil</title><body style="margin:0;background:#0B0B0E;color:#F4F1EA;font:18px Arial;padding:48px"><main><h1 style="color:#60A5FA">Central</h1><p>A central está em preparação. Volte em breve.</p><a style="color:#60A5FA" href="/">Voltar ao site</a></main></body></html>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
