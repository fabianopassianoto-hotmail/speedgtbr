// Cloudflare Pages Function. Only these three public championships may be fetched.
const ids = new Set(['26971', '26974', '26975']);
const clean = (value, limit) => value.replace(/\s+/g, ' ').trim().slice(0, limit);

export async function onRequestGet({ params }) {
  const id = String(params.id);
  const json = (body, status, ttl) => Response.json(body, {
    status,
    headers: { 'Cache-Control': `public, max-age=${ttl}`, 'X-Content-Type-Options': 'nosniff' }
  });
  if (!ids.has(id)) return json({ status: 'not-found' }, 404, 60);
  const url = `https://www.thesimgrid.com/championships/${id}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'error',
      headers: { Accept: 'text/html' },
      cf: { cacheTtl: 300, cacheEverything: true }
    });
    if (!response.ok || response.headers.get('cf-mitigated') === 'challenge' || !response.headers.get('content-type')?.includes('text/html')) {
      throw new Error('Upstream unavailable');
    }
    let heading = '', title = '', description = '';
    // Extract text only; never serve upstream HTML, scripts, cookies or headers.
    await new HTMLRewriter()
      .on('h1', { text(chunk) { heading += chunk.text; } })
      .on('meta[property="og:title"]', { element(el) { title = el.getAttribute('content') || ''; } })
      .on('meta[name="description"]', { element(el) { description = el.getAttribute('content') || ''; } })
      .transform(response).text();
    title = clean(heading || title, 200);
    // Reject challenge/login pages and changed markup rather than showing them as championship data.
    if (!/copa\s+speed/i.test(title) || !/temp(?:orada)?\.?\s*3/i.test(title)) throw new Error('Unexpected page');
    return json({ status: 'available', id, url, title, description: clean(description, 600), fetchedAt: new Date().toISOString() }, 200, 300);
  } catch (error) {
    return json({ status: 'unavailable', id, url }, 503, 30);
  } finally {
    clearTimeout(timeout);
  }
}
