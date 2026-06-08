import { CLUSTERS, ALL_MEMBER_WORDS } from "../data/vocab-data";
import { useStore } from "../lib/hooks";
import { ProgressRing } from "../components/ProgressRing";

export type Route = "hub" | "clusters" | "lightning" | "antonym" | "study";

const MODES: { id: Route; n: string; title: string; color: string; desc: string; tag: string }[] = [
  { id: "clusters", n: "01", title: "Clusters", color: "--c-blue",
    desc: "Sort sixteen words into four meaning-families. The flagship grind.", tag: "Group" },
  { id: "lightning", n: "02", title: "Lightning", color: "--c-gold",
    desc: "A word flashes — name its family before the combo breaks.", tag: "Recall" },
  { id: "antonym", n: "03", title: "Antonyms", color: "--c-rust",
    desc: "Three synonyms, one impostor. Spot the opposite.", tag: "Contrast" }
];

export function Hub({ go }: { go: (r: Route) => void }) {
  const Store = useStore();
  const s = Store.get();
  const total = ALL_MEMBER_WORDS.length;
  const mastered = Store.masteredCount();
  const learning = Store.learningCount();
  const dailyPct = Math.min(1, s.daily.points / s.daily.goal);
  const goalHit = s.daily.points >= s.daily.goal;

  return (
    <div className="hub fade-in">
      <div className="daily panel">
        <ProgressRing pct={dailyPct} size={88} stroke={9}
          color={goalHit ? "var(--c-green)" : "var(--c-rust)"}>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, lineHeight: 1 }}>
            {goalHit ? "✓" : Math.round(dailyPct * 100) + "%"}
          </span>
        </ProgressRing>
        <div className="daily-body">
          <span className="eyebrow">Daily goal</span>
          <div className="daily-line">
            <strong>{s.daily.points}</strong> / {s.daily.goal} pts
            {goalHit && <span className="daily-done">complete</span>}
          </div>
          <div className="daily-streak">
            <span className="flame-ico">▲</span>
            <strong>{s.streak}</strong> day streak — keep the chain alive
          </div>
        </div>
      </div>

      <div className="mastery-row">
        <div className="mstat panel">
          <span className="mstat-num" style={{ color: "var(--c-gold)" }}>{mastered}</span>
          <span className="mstat-label">Mastered</span>
        </div>
        <div className="mstat panel">
          <span className="mstat-num" style={{ color: "var(--c-blue)" }}>{learning}</span>
          <span className="mstat-label">Learning</span>
        </div>
        <div className="mstat panel">
          <span className="mstat-num">{total}</span>
          <span className="mstat-label">Total words</span>
        </div>
      </div>
      <div className="mastery-bar">
        <div className="mb-seg gold" style={{ width: (mastered / total * 100) + "%" }} />
        <div className="mb-seg blue" style={{ width: (learning / total * 100) + "%" }} />
      </div>

      <div className="mode-cards">
        {MODES.map((m) => (
          <button key={m.id} className="mode-card" onClick={() => go(m.id)}
            style={{ "--accent": "var(" + m.color + ")" } as React.CSSProperties}>
            <div className="mode-card-top">
              <span className="mc-num">{m.n}</span>
              <span className="mc-tag">{m.tag}</span>
            </div>
            <h3 className="mc-title">{m.title}</h3>
            <p className="mc-desc">{m.desc}</p>
            <span className="mc-go">Play →</span>
          </button>
        ))}
      </div>

      <button className="study-link" onClick={() => go("study")}>
        <span>Browse the lexicon</span>
        <span className="study-meta">{CLUSTERS.length} families · {total} words</span>
      </button>
    </div>
  );
}
