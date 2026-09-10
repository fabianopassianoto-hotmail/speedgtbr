import assert from "node:assert/strict";
import test from "node:test";
import { authenticatedEmail } from "../scripts/access-auth.mjs";

test("Access accepts signed identities and rejects forged, expired and foreign tokens", async () => {
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const jwk = { ...await crypto.subtle.exportKey("jwk", pair.publicKey), kid: "test" };
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const env = { ACCESS_TEAM_DOMAIN: "test.cloudflareaccess.com", ACCESS_AUD: "central" };
  const claims = { iss: "https://" + env.ACCESS_TEAM_DOMAIN, aud: ["central"], exp: Math.floor(Date.now() / 1000) + 60, email: "Admin@example.com" };
  async function token(payload) {
    const input = encode({ alg: "RS256", kid: "test" }) + "." + encode(payload);
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(input));
    return input + "." + Buffer.from(signature).toString("base64url");
  }
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ keys: [jwk] });
  try {
    const request = value => new Request("https://example.com/central", { headers: { "cf-access-jwt-assertion": value, "cf-access-authenticated-user-email": "forged@example.com" } });
    assert.equal(await authenticatedEmail(new Request("https://example.com", { headers: { "cf-access-authenticated-user-email": "forged@example.com" } }), env), null);
    assert.equal(await authenticatedEmail(request(await token(claims)), env), "admin@example.com");
    assert.equal(await authenticatedEmail(request(await token({ ...claims, aud: ["other"] })), env), null);
    assert.equal(await authenticatedEmail(request(await token({ ...claims, exp: 1 })), env), null);
    const signed = await token(claims);
    const parts = signed.split(".");
    parts[1] = encode({ ...claims, email: "forged@example.com" });
    assert.equal(await authenticatedEmail(request(parts.join(".")), env), null);
    assert.equal(await authenticatedEmail(request(signed), {}), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
