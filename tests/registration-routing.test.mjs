import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (await readFile(new URL("../scripts/pages-worker.mjs", import.meta.url), "utf8"))
  .replace('import central from "./central/index.js";', 'const central = { fetch: async request => Response.json({ path: new URL(request.url).pathname, email: request.headers.get("cf-access-authenticated-user-email") }) };')
  .replace('import { onRequestGet } from "./championships.js";', 'const onRequestGet = () => new Response("championship");')
  .replace('import { authenticatedEmail } from "./access-auth.mjs";', 'const authenticatedEmail = async () => null;');
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("registration shortcut preserves query parameters", async () => {
  for (const path of ["/cadastro", "/cadastro/"]) {
    const response = await worker.fetch(new Request(`https://example.com${path}?origem=convite`), {}, {});
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "https://example.com/central/cadastro?origem=convite");
  }
});

test("public registration works without Access and discards forged identity", async () => {
  for (const path of ["/central/cadastro", "/central/api/cadastro"]) {
    const response = await worker.fetch(new Request(`https://example.com${path}`, { headers: { "cf-access-authenticated-user-email": "forged@example.com" } }), { DB: {} }, {});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { path, email: null });
  }
  assert.equal((await worker.fetch(new Request("https://example.com/central"), {}, {})).status, 503);
  assert.equal((await worker.fetch(new Request("https://example.com/central"), { DB: {} }, {})).status, 200);
});

test("Central forwards reads and edits without credentials or an Access provider", async () => {
  const env = { DB: {} };
  for (const [path, method] of [["/central", "GET"], ["/central/api/caixa", "POST"], ["/central/api/pilotos/SGT001", "PATCH"], ["/central/api/caixa", "DELETE"]]) {
    const response = await worker.fetch(new Request(`https://example.com${path}`, { method, headers: { "cf-access-authenticated-user-email": "forged@example.com" } }), env, {});
    assert.deepEqual(await response.json(), { path, email: null });
  }
});
