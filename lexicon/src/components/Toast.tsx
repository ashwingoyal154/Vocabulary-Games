import type { Toast } from "../lib/hooks";

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div style={{
      position: "fixed", left: "50%", bottom: 28, transform: "translateX(-50%)",
      display: "flex", flexDirection: "column", gap: 8, zIndex: 200, alignItems: "center", pointerEvents: "none"
    }}>
      {toasts.map((t) => (
        <div key={t.id} className="fade-in" style={{
          padding: "10px 18px", borderRadius: 999,
          background: t.kind === "bad" ? "var(--c-rust)" : "var(--ink)",
          color: "#fff", fontWeight: 600, fontSize: 14, boxShadow: "var(--shadow-lg)"
        }}>{t.msg}</div>
      ))}
    </div>
  );
}
