import { prisma } from "@/lib/prisma";
import { hashOtp } from "@/lib/otp";
import ResetPasswordClient from "./ResetPasswordClient";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <InvalidLink reason="לא סופק טוקן" />;
  }

  const hashedToken = hashOtp(token);
  const record = await prisma.verificationToken.findFirst({
    where: { token: hashedToken, expires: { gt: new Date() } },
  });

  if (!record) {
    return <InvalidLink reason="הקישור אינו תקף או שפג תוקפו" />;
  }

  return <ResetPasswordClient token={token} email={record.identifier} />;
}

function InvalidLink({ reason }: { reason: string }) {
  return (
    <div style={{ minHeight: "100vh", background: "#09080a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Arial, sans-serif", direction: "rtl", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#fca5a5", marginBottom: 10 }}>קישור לא תקף</div>
        <p style={{ fontSize: 14, color: "#6b6070", lineHeight: 1.7, marginBottom: 24 }}>{reason}</p>
        <a href="/forgot-password" style={{ display: "inline-block", padding: "12px 28px", background: "linear-gradient(135deg,#6b470d,#C9A452)", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none", borderRadius: 10 }}>
          בקש קישור חדש
        </a>
      </div>
    </div>
  );
}
