import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (await readFile(new URL("../scripts/pages-worker.mjs", import.meta.url), "utf8"))
  .replace('import central from "./central/index.js";', 'const central = { fetch: async request => Response.json({ path: new URL(request.url).pathname, email: request.headers.get("cf-access-authenticated-user-email") }) };')
  .replace('import { onRequestGet } from "./championships.js";', 'const onRequestGet = () => new Response("championship");')
  .replace('import { authenticatedEmail } from "./access-auth.mjs";', 'const authenticatedEmail = async () => null;');
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("registration shortcut preserves query parameters", async () => {
  for (const path of ["/cadastro", "/cadastro/", "/comece-aqui", "/comece-aqui/", "/central/central", "/central/central/"]) {
    const response = await worker.fetch(new Request(`https://example.com${path}?origem=convite`), {}, {});
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "https://example.com/central/cadastro?origem=convite");
  }
});

test("public registration works without Access and discards forged identity", async () => {
  for (const path of ["/central/cadastro", "/central/api/cadastro", "/central/api/cadastro/reenviar"]) {
    const response = await worker.fetch(new Request(`https://example.com${path}`, { headers: { "cf-access-authenticated-user-email": "forged@example.com" } }), { DB: {} }, {});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { path, email: null });
  }
  assert.equal((await worker.fetch(new Request("https://example.com/central"), { DB: {} }, {})).status, 503);
  assert.equal((await worker.fetch(new Request("https://example.com/central"), { DB: {}, ACCESS_TEAM_DOMAIN: "test", ACCESS_AUD: "test" }, {})).status, 401);
});
