/* ============ Shared hooks + small components ============ */

// ---- store hook ----
function useStore() {
  const [, force] = React.useState(0);
  React.useEffect(() => window.Store.subscribe(() => force((n) => n + 1)), []);
  return window.Store;
}

// ---- helpers ----
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sample(arr, n) { return shuffle(arr).slice(0, n); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function displayWord(w, upper) {
  if (upper) return w.toUpperCase();
  // Title-case but keep accents; preserve hyphen/space parts
  return w
    .toLowerCase()
    .split(/([ \-])/)
    .map((part) =>
      /[ \-]/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join("");
}

const CLUSTER_COLORS = ["--c-blue", "--c-rust", "--c-gold", "--c-green"];

// ---- connotation badge ----
function ConnBadge({ conn, small }) {
  let cls = "neu", label = "neutral", glyph = "—";
  if (conn === "+") { cls = "pos"; label = "positive"; glyph = "＋"; }
  else if (conn === "-") { cls = "neg"; label = "negative"; glyph = "－"; }
  return (
    <span className={"conn-badge " + cls} style={small ? { fontSize: 10, padding: "2px 7px" } : null}>
      <span aria-hidden="true">{glyph}</span>{label}
    </span>
  );
}

// ---- mastery dots ----
function MasteryDots({ level, size }) {
  size = size || 7;
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

// ---- progress ring ----
function ProgressRing({ pct, size, stroke, color, track, children }) {
  size = size || 64; stroke = stroke || 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={track || "var(--line)"} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color || "var(--c-rust)"} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset .6s cubic-bezier(.4,0,.2,1)" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center", flexDirection: "column"
      }}>{children}</div>
    </div>
  );
}

// ---- toast ----
function useToast() {
  const [toasts, setToasts] = React.useState([]);
  const push = React.useCallback((msg, kind) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1800);
  }, []);
  const node = (
    <div style={{
      position: "fixed", left: "50%", bottom: 28, transform: "translateX(-50%)",
      display: "flex", flexDirection: "column", gap: 8, zIndex: 200, alignItems: "center", pointerEvents: "none"
    }}>
      {toasts.map((t) => (
        <div key={t.id} className="fade-in" style={{
          padding: "10px 18px", borderRadius: 999,
          background: t.kind === "bad" ? "var(--c-rust)" : t.kind === "good" ? "var(--ink)" : "var(--ink)",
          color: "#fff", fontWeight: 600, fontSize: 14, boxShadow: "var(--shadow-lg)"
        }}>{t.msg}</div>
      ))}
    </div>
  );
  return [node, push];
}

Object.assign(window, {
  useStore, shuffle, sample, pick, displayWord, CLUSTER_COLORS,
  ConnBadge, MasteryDots, ProgressRing, useToast
});
