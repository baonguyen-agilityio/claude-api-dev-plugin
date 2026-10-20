import { describe, expect, it, beforeAll } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from "jose";
import { verifyFirebaseIdToken } from "@/core/auth";
import { TEST_ENV } from "@/tests/helpers/test-app";

// Real verifier against a local JWKS: issuer, audience, expiry and algorithm are checked, not mocked.
let privateKey: CryptoKey, jwks: ReturnType<typeof createLocalJWKSet>;
beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey as CryptoKey;
  const jwk = (await exportJWK(pair.publicKey)) as JWK;
  jwks = createLocalJWKSet({ keys: [{ ...jwk, kid: "k1", alg: "RS256", use: "sig" }] });
});

const token = (claims: Record<string, unknown>, opts: { iss?: string; aud?: string; exp?: string } = {}) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(opts.iss ?? `https://securetoken.google.com/${TEST_ENV.FIREBASE_PROJECT_ID}`)
    .setAudience(opts.aud ?? TEST_ENV.FIREBASE_PROJECT_ID)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "1h")
    .sign(privateKey);

describe("verifyFirebaseIdToken", () => {
  it("returns uid, email and role from a valid token", async () => {
    const t = await token({ sub: "u1", email: "u@example.com", role: "admin" });
    expect(await verifyFirebaseIdToken(jwks)(t, TEST_ENV)).toEqual({ uid: "u1", email: "u@example.com", role: "admin" });
  });
  it("rejects the wrong audience (token from another Firebase project)", async () => {
    await expect(verifyFirebaseIdToken(jwks)(await token({ sub: "u1" }, { aud: "other-project" }), TEST_ENV)).rejects.toThrow();
  });
  it("rejects the wrong issuer and an expired token", async () => {
    await expect(verifyFirebaseIdToken(jwks)(await token({ sub: "u1" }, { iss: "https://evil.example" }), TEST_ENV)).rejects.toThrow();
    await expect(verifyFirebaseIdToken(jwks)(await token({ sub: "u1" }, { exp: "-1h" }), TEST_ENV)).rejects.toThrow();
  });
});
