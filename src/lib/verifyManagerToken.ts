import { jwtVerify } from "jose";

const PIN_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "menu4u-pin-secret"
);

export type ManagerClaims = { managerId: string; managerName: string; restaurantId: string };

export async function verifyManagerToken(token: string): Promise<ManagerClaims | null> {
  try {
    const { payload } = await jwtVerify(token, PIN_SECRET);
    return payload as unknown as ManagerClaims;
  } catch {
    return null;
  }
}
