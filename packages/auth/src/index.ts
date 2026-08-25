export type AuthClaims = { sub: string; sid?: string; email?: string; iss?: string; aud?: string };
export type IdentityProviderConfig = { issuer: string; audience: string; jwksUri?: string };

export function isProductionIdentityConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.OIDC_ISSUER && env.OIDC_AUDIENCE);
}
