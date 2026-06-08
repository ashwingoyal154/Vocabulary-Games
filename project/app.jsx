/* ============ Hub, Study library, App root ============ */

function Hub({ go }) {
  const Store = useStore();
  const s = Store.get();
  const total = window.VOCAB.ALL_MEMBER_WORDS.length;
  const mastered = Store.masteredCount();
  const learning = Store.learningCount();
  const dailyPct = Math.min(1, s.daily.points / s.daily.goal);
  const goalHit = s.daily.points >= s.daily.goal;

  const modes = [
    { id: "clusters", n: "01", title: "Clusters", color: "--c-blue",
      desc: "Sort sixteen words into four meaning-families. The flagship grind.", tag: "Group" },
    { id: "lightning", n: "02", title: "Lightning", color: "--c-gold",
      desc: "A word flashes — name its family before the combo breaks.", tag: "Recall" },
    { id: "antonym", n: "03", title: "Antonyms", color: "--c-rust",
      desc: "Three synonyms, one impostor. Spot the opposite.", tag: "Contrast" }
  ];

  return (
    <div className="hub fade-in">
      {/* daily banner */}
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

      {/* mastery overview */}
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

      {/* mode cards */}
      <div className="mode-cards">
        {modes.map((m) => (
          <button key={m.id} className="mode-card" onClick={() => go(m.id)}
            style={{ "--accent": "var(" + m.color + ")" }}>
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
        <span className="study-meta">{window.VOCAB.CLUSTERS.length} families · {total} words</span>
      </button>
    </div>
  );
}

function Library({ onExit }) {
  const Store = useStore();
  const upper = Store.get().settings.upper;
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState("all"); // all | mastered | learning | new
  const q = query.trim().toLowerCase();

  const clusters = window.VOCAB.CLUSTERS.map((c) => {
    const words = c.words.filter((x) => {
      if (q && !(x.w.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))) return false;
      if (filter === "all") return true;
      const lvl = Store.level(x.w);
      if (filter === "mastered") return lvl >= 3;
      if (filter === "learning") return lvl >= 1 && lvl < 3;
      if (filter === "new") return lvl === 0;
      return true;
    });
    return { c, words };
  }).filter((g) => g.words.length > 0);

  return (
    <div className="library mode-wrap">
      <div className="mode-head">
        <button className="back-link" onClick={onExit}>‹ Hub</button>
        <div className="mode-title"><span className="eyebrow">Reference</span><h2>The Lexicon</h2></div>
        <span style={{ width: 40 }} />
      </div>

      <div className="lib-controls">
        <input className="lib-search" placeholder="Search a word or family…"
          value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="lib-filters">
          {[["all", "All"], ["new", "New"], ["learning", "Learning"], ["mastered", "Mastered"]].map(([k, l]) => (
            <button key={k} className={"lib-fbtn " + (filter === k ? "on" : "")} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="lib-list">
        {clusters.length === 0 && <p className="lib-empty">No words match.</p>}
        {clusters.map(({ c, words }) => (
          <div key={c.id} className="lib-cluster">
            <div className="lib-cluster-head">
              <span className="lib-cluster-name">{c.name}</span>
              {c.conn && <ConnBadge conn={c.conn} small />}
            </div>
            <div className="lib-words">
              {words.map((x) => {
                const lvl = Store.level(x.w);
                return (
                  <div key={x.w} className="lib-word">
                    <span className={"lw-text" + (x.role === "x" ? " ant" : "")}>
                      {window.displayWord(x.w, upper)}
                    </span>
                    {x.role === "x" && <span className="role-tag x">opp</span>}
                    {x.role === "n" && <span className="role-tag n">near</span>}
                    {x.role === "u" && <span className="role-tag u">rel</span>}
                    <MasteryDots level={lvl} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "wordCase": "Title Case",
  "dailyGoal": 100
}/*EDITMODE-END*/;

function App() {
  const [route, setRoute] = React.useState("hub");
  const Store = useStore();
  const s = Store.get();
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => { Store.setSetting("upper", t.wordCase === "UPPERCASE"); }, [t.wordCase]);
  React.useEffect(() => { Store.setGoal(t.dailyGoal); }, [t.dailyGoal]);

  const go = (r) => setRoute(r);
  const exit = () => setRoute("hub");

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand" onClick={exit}>
          <span className="mark">Lex<em>icon</em></span>
          <span className="tag">GRE Vocabulary</span>
        </div>
        <div className="topbar-stats">
          <span className="stat-pill flame"><span className="ico">▲</span>{s.streak}</span>
          <span className="stat-pill gem"><span className="ico">◆</span>{Store.masteredCount()}</span>
        </div>
      </header>

      <main className="stage">
        {route === "hub" && <Hub go={go} />}
        {route === "clusters" && <ClusterGame onExit={exit} />}
        {route === "lightning" && <QuizGame mode="lightning" onExit={exit} />}
        {route === "antonym" && <QuizGame mode="antonym" onExit={exit} />}
        {route === "study" && <Library onExit={exit} />}
      </main>

      <footer className="appfoot">
        <span className="save-note"><span className="save-dot" />Progress auto-saves &amp; resumes on this device.</span>
        <div className="foot-actions">
          <button className="foot-btn" onClick={() => {
            const code = window.Store.exportCode();
            try { navigator.clipboard && navigator.clipboard.writeText(code); } catch (e) {}
            window.prompt("Backup code copied. Save it somewhere — paste it on another browser/device via “Restore” to carry your progress:", code);
          }}>Back up</button>
          <button className="foot-btn" onClick={() => {
            const code = window.prompt("Paste your backup code to restore progress (this replaces current progress):");
            if (code && code.trim()) {
              const ok = window.Store.importCode(code);
              alert(ok ? "Progress restored." : "That code didn't look valid — nothing was changed.");
            }
          }}>Restore</button>
          <button className="foot-reset" onClick={() => {
            if (confirm("Reset all progress? Tip: back it up first.")) window.Store.reset();
          }}>Reset</button>
        </div>
      </footer>

      <TweaksPanel>
        <TweakSection label="Display" />
        <TweakRadio label="Word case" value={t.wordCase}
          options={["Title Case", "UPPERCASE"]}
          onChange={(v) => setTweak("wordCase", v)} />
        <TweakSection label="Daily goal" />
        <TweakSlider label="Points per day" value={t.dailyGoal} min={40} max={300} step={20} unit=" pts"
          onChange={(v) => setTweak("dailyGoal", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
