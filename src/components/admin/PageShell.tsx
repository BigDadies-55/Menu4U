import { T } from "@/lib/ui";

export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 24, color: T.text }} dir="rtl">
      {children}
    </div>
  );
}
