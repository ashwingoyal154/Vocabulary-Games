import { useState } from "react";
import { CLUSTERS } from "../data/vocab-data";
import { displayWord, useStore } from "../lib/hooks";
import { ConnBadge, MasteryDots } from "../components/Badges";

type Filter = "all" | "mastered" | "learning" | "new";

const FILTERS: [Filter, string][] = [["all", "All"], ["new", "New"], ["learning", "Learning"], ["mastered", "Mastered"]];

export function Library({ onExit }: { onExit: () => void }) {
  const Store = useStore();
  const upper = Store.get().settings.upper;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const q = query.trim().toLowerCase();

  const clusters = CLUSTERS.map((c) => {
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
          {FILTERS.map(([k, l]) => (
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
                      {displayWord(x.w, upper)}
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
