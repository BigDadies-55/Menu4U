import crypto from "crypto";

export function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

export function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}
