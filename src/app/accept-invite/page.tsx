import { prisma } from "@/lib/prisma";
import { hashOtp } from "@/lib/otp";
import { redirect } from "next/navigation";
import AcceptInviteClient from "./AcceptInviteClient";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { token } = await searchParams;

  if (!token) redirect("/login?reason=invalid-invite");

  const hashedToken = hashOtp(token);
  const record = await prisma.verificationToken.findFirst({
    where: { token: hashedToken, expires: { gt: new Date() } },
  });

  if (!record) redirect("/login?reason=expired-invite");

  const user = await prisma.user.findFirst({
    where: { email: record.identifier, emailVerified: null },
    select: { name: true, email: true },
  });

  if (!user) redirect("/login?reason=invalid-invite");

  return <AcceptInviteClient email={user.email} name={user.name} token={token} />;
}
