export default function MenuExpired({
  name,
  logo,
  reason,
}: {
  name: string;
  logo: string | null;
  reason: "expired" | "not_started";
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "linear-gradient(135deg,#0a0a0a 0%,#1a1208 100%)" }}
    >
      {logo && (
        <img src={logo} alt={name} className="w-20 h-20 rounded-2xl object-cover mb-6 opacity-60" />
      )}
      <div
        className="text-4xl font-bold mb-3 text-center"
        style={{ background: "linear-gradient(90deg,#c9a35d,#e0c084)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
      >
        {name}
      </div>
      <div className="w-12 h-px mb-6" style={{ background: "linear-gradient(90deg,transparent,#c9a35d,transparent)" }} />
      <p className="text-gray-400 text-center text-base max-w-xs leading-relaxed">
        {reason === "expired"
          ? "התפריט הדיגיטלי של מסעדה זו אינו זמין כרגע."
          : "התפריט הדיגיטלי טרם הופעל."}
      </p>
      <p className="text-gray-600 text-sm mt-3 text-center">
        לפרטים נוספים, צרו קשר עם המסעדה ישירות.
      </p>
    </div>
  );
}
