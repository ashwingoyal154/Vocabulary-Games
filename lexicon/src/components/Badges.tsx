import type { Connotation } from "../data/vocab-data";

export function ConnBadge({ conn, small }: { conn: Connotation; small?: boolean }) {
  let cls = "neu", label = "neutral", glyph = "—";
  if (conn === "+") { cls = "pos"; label = "positive"; glyph = "＋"; }
  else if (conn === "-") { cls = "neg"; label = "negative"; glyph = "－"; }
  return (
    <span className={"conn-badge " + cls} style={small ? { fontSize: 10, padding: "2px 7px" } : undefined}>
      <span aria-hidden="true">{glyph}</span>{label}
    </span>
  );
}

export function MasteryDots({ level, size = 7 }: { level: number; size?: number }) {
  const dots = [0, 1, 2];
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }} title={"Mastery " + level + "/3"}>
      {dots.map((i) => (
        <span key={i} style={{
          width: size, height: size, borderRadius: "50%",
          background: i < level ? "var(--c-gold)" : "transparent",
          border: "1.5px solid " + (i < level ? "var(--c-gold)" : "var(--line-strong)"),
          transition: "all .2s ease"
        }} />
      ))}
    </span>
  );
}
