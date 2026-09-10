const decode = (part) => Uint8Array.from(atob(part.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

export async function authenticatedEmail(request, env) {
  const team = env.ACCESS_TEAM_DOMAIN;
  const audience = env.ACCESS_AUD;
  if (!team || !audience || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team)) return null;
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return null;
  try {
    const [headerPart, payloadPart, signaturePart, extra] = token.split(".");
    if (!headerPart || !payloadPart || !signaturePart || extra !== undefined) return null;
    const header = JSON.parse(new TextDecoder().decode(decode(headerPart)));
    const payload = JSON.parse(new TextDecoder().decode(decode(payloadPart)));
    const now = Date.now() / 1000;
    if (header.alg !== "RS256" || typeof header.kid !== "string" ||
        payload.iss !== "https://" + team ||
        typeof payload.exp !== "number" || payload.exp <= now ||
        (payload.nbf !== undefined && (typeof payload.nbf !== "number" || payload.nbf > now)) ||
        !(Array.isArray(payload.aud) ? payload.aud : [payload.aud]).includes(audience) ||
        typeof payload.email !== "string" || !payload.email.trim()) return null;
    const response = await fetch("https://" + team + "/cdn-cgi/access/certs", { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const { keys } = await response.json();
    const jwk = keys?.find(key => key.kid === header.kid && key.kty === "RSA");
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decode(signaturePart), new TextEncoder().encode(headerPart + "." + payloadPart));
    return valid ? payload.email.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}
