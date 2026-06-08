import { generateSecret, verifySync, generateURI } from "otplib";

export function createTotpSecret(): string {
  return generateSecret();
}

export function verifyTotpCode(secret: string, token: string): boolean {
  try {
    const result = verifySync({ secret, token, strategy: "totp", epochTolerance: 1 } as Parameters<typeof verifySync>[0]);
    return (result as unknown as { valid: boolean }).valid;
  } catch {
    return false;
  }
}

export function buildTotpUri(email: string, secret: string): string {
  return generateURI({ issuer: "Menu4U", label: email, secret, strategy: "totp" } as Parameters<typeof generateURI>[0]);
}
