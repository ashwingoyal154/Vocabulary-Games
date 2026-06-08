/* ============ CLUSTERS — sort 16 words into 4 meaning-families ============ */
function buildClusterBoard() {
  const Store = window.Store;
  const big = window.VOCAB.BIG_CLUSTERS;

  // weight clusters by how many of their members are not yet mastered
  function clusterWeight(c) {
    let w = 1;
    c.members.forEach((m) => { w += (3 - Store.level(m)); });
    return w;
  }

  // weighted-pick 4 distinct clusters
  function pickClusters() {
    const pool = big.slice();
    const chosen = [];
    while (chosen.length < 4 && pool.length) {
      const weights = pool.map(clusterWeight);
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total, idx = 0;
      for (; idx < pool.length; idx++) { r -= weights[idx]; if (r <= 0) break; }
      idx = Math.min(idx, pool.length - 1);
      chosen.push(pool.splice(idx, 1)[0]);
    }
    return chosen;
  }

  for (let attempt = 0; attempt < 40; attempt++) {
    const clusters = pickClusters();
    const used = new Set();
    const groups = [];
    let ok = true;
    for (let gi = 0; gi < clusters.length; gi++) {
      const c = clusters[gi];
      // members not already used on this board, prefer least mastered
      const avail = c.members.filter((m) => !used.has(m));
      if (avail.length < 4) { ok = false; break; }
      avail.sort((a, b) => Store.level(a) - Store.level(b) || Math.random() - .5);
      const chosenWords = avail.slice(0, 4 + Math.min(2, avail.length - 4)); // small pref pool
      const four = window.shuffle(chosenWords).slice(0, 4);
      four.forEach((w) => used.add(w));
      groups.push({ gid: gi, clusterId: c.id, name: c.name, conn: c.conn, antonyms: c.antonyms, words: four });
    }
    if (ok && groups.length === 4) return groups;
  }
  return null;
}

function ClusterTile({ word, selected, state, onClick, upper }) {
  let cls = "ctile";
  if (selected) cls += " sel";
  if (state === "pop") cls += " pop";
  return (
    <button className={cls} onClick={onClick} disabled={state === "locked"}>
      <span className="ctile-word">{window.displayWord(word, upper)}</span>
    </button>
  );
}

function ClusterGame({ onExit }) {
  const Store = useStore();
  const upper = Store.get().settings.upper;
  const [toastNode, toast] = useToast();

  const [groups, setGroups] = React.useState(() => buildClusterBoard());
  const [tiles, setTiles] = React.useState(() => layout(groups));
  const [selected, setSelected] = React.useState([]);
  const [solved, setSolved] = React.useState([]);      // array of gid solved (in order)
  const [mistakes, setMistakes] = React.useState(0);
  const [hintsLeft, setHintsLeft] = React.useState(3);
  const [clues, setClues] = React.useState([]);        // gids revealed via hint
  const [shakeKey, setShakeKey] = React.useState(0);
  const [done, setDone] = React.useState(false);       // results overlay
  const [missed, setMissed] = React.useState(false);
  const maxMistakes = 4;

  function layout(grps) {
    const t = [];
    grps.forEach((g) => g.words.forEach((w) => t.push({ w, gid: g.gid })));
    return window.shuffle(t);
  }

  function newBoard() {
    const g = buildClusterBoard();
    setGroups(g); setTiles(layout(g)); setSelected([]); setSolved([]);
    setMistakes(0); setHintsLeft(3); setClues([]); setDone(false); setMissed(false);
  }

  const groupById = (gid) => groups.find((g) => g.gid === gid);

  function toggle(w) {
    if (done) return;
    setSelected((s) => {
      if (s.includes(w)) return s.filter((x) => x !== w);
      if (s.length >= 4) return s;
      return [...s, w];
    });
  }

  function submit() {
    if (selected.length !== 4) return;
    const gids = selected.map((w) => tiles.find((t) => t.w === w).gid);
    const allSame = gids.every((g) => g === gids[0]);
    if (allSame) {
      const gid = gids[0];
      const g = groupById(gid);
      g.words.forEach((w) => Store.recordWord(w, true));
      const noMiss = mistakes === 0;
      Store.addPoints(25 + (noMiss ? 5 : 0));
      Store.commit();
      const newSolved = [...solved, gid];
      setSolved(newSolved);
      setTiles((t) => t.filter((x) => x.gid !== gid));
      setSelected([]);
      toast(g.name, "good");
      if (newSolved.length === 4) finish(false);
    } else {
      // one-away check
      const counts = {};
      gids.forEach((g) => counts[g] = (counts[g] || 0) + 1);
      const max = Math.max(...Object.values(counts));
      setShakeKey((k) => k + 1);
      const m = mistakes + 1;
      setMistakes(m);
      toast(max === 3 ? "So close — one away!" : "Not a group", "bad");
      if (m >= maxMistakes) revealAll();
    }
  }

  function revealAll() {
    // auto-solve remaining groups (no mastery reward for un-found ones)
    const remaining = groups.map((g) => g.gid).filter((gid) => !solved.includes(gid));
    setSolved((s) => [...s, ...remaining]);
    setTiles([]);
    setSelected([]);
    finish(true);
  }

  function finish(wasMissed) {
    setMissed(wasMissed);
    setDone(true);
    Store.finishRound({ correct: wasMissed ? 0 : 4 });
  }

  function useHint() {
    if (hintsLeft <= 0) return;
    const candidates = groups.map((g) => g.gid).filter((gid) => !solved.includes(gid) && !clues.includes(gid));
    if (!candidates.length) { toast("No more clues", "bad"); return; }
    const gid = window.pick(candidates);
    setClues((c) => [...c, gid]);
    setHintsLeft((h) => h - 1);
  }

  // one-away live indicator
  const liveGids = selected.map((w) => { const t = tiles.find((x) => x.w === w); return t ? t.gid : -1; });

  return (
    <div className="mode-wrap">
      {toastNode}
      <div className="mode-head">
        <button className="back-link" onClick={onExit}>‹ Hub</button>
        <div className="mode-title">
          <span className="eyebrow">Mode 01</span>
          <h2>Clusters</h2>
        </div>
        <div className="hearts" title="Mistakes remaining">
          {Array.from({ length: maxMistakes }).map((_, i) => (
            <span key={i} className={"heart " + (i < maxMistakes - mistakes ? "on" : "off")} />
          ))}
        </div>
      </div>

      <p className="mode-sub">Find four groups of four. Each group is a meaning-family — words that mean the same thing.</p>

      {/* solved groups */}
      <div className="solved-stack">
        {solved.map((gid) => {
          const g = groupById(gid);
          const color = "var(" + window.CLUSTER_COLORS[solved.indexOf(gid) % 4] + ")";
          return (
            <div key={gid} className="solved-row fade-in" style={{ background: color }}>
              <div className="solved-row-head">
                <span className="solved-name">{g.name}</span>
                {g.conn && <span className="solved-conn">{g.conn === "+" ? "positive" : "negative"}</span>}
              </div>
              <div className="solved-words">{g.words.map((w) => window.displayWord(w, upper)).join("  ·  ")}</div>
            </div>
          );
        })}
      </div>

      {/* clue banners */}
      {clues.filter((gid) => !solved.includes(gid)).length > 0 && (
        <div className="clue-bar">
          <span className="eyebrow">Clue{clues.length > 1 ? "s" : ""}:</span>
          {clues.filter((gid) => !solved.includes(gid)).map((gid) => (
            <span key={gid} className="clue-chip">{groupById(gid).name}</span>
          ))}
        </div>
      )}

      {/* tile board */}
      {!done && (
        <div key={shakeKey} className={"cboard" + (shakeKey ? " shake-once" : "")}>
          {tiles.map((t) => (
            <ClusterTile key={t.w} word={t.w} upper={upper}
              selected={selected.includes(t.w)}
              onClick={() => toggle(t.w)} />
          ))}
        </div>
      )}

      {/* controls */}
      {!done && (
        <div className="cbar">
          <button className="btn btn-ghost btn-sm" onClick={() => setTiles((t) => window.shuffle(t))}>Shuffle</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected([])} disabled={!selected.length}>Deselect</button>
          <button className="btn btn-ghost btn-sm" onClick={useHint} disabled={hintsLeft <= 0}>
            Hint · {hintsLeft}
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={selected.length !== 4}>Submit</button>
        </div>
      )}

      {done && (
        <ClusterResults groups={groups} solvedOrder={solved} missed={missed}
          upper={upper} onNext={newBoard} onExit={onExit} />
      )}
    </div>
  );
}

function ClusterResults({ groups, missed, upper, onNext, onExit }) {
  return (
    <div className="results fade-in">
      <div className="results-head">
        <span className="eyebrow">{missed ? "Out of guesses" : "Solved"}</span>
        <h3>{missed ? "Here's the full board" : "Four families, mastered"}</h3>
      </div>
      <div className="results-groups">
        {groups.map((g, i) => (
          <div key={g.gid} className="rgroup">
            <div className="rgroup-bar" style={{ background: "var(" + window.CLUSTER_COLORS[i % 4] + ")" }} />
            <div className="rgroup-body">
              <div className="rgroup-top">
                <span className="rgroup-name">{g.name}</span>
                {g.conn && <ConnBadge conn={g.conn} small />}
              </div>
              <div className="rgroup-words">
                {g.words.map((w) => <span key={w} className="rword">{window.displayWord(w, upper)}</span>)}
              </div>
              {g.antonyms.length > 0 && (
                <div className="rgroup-ant">
                  <span className="role-tag x">antonym</span>
                  {g.antonyms.map((w) => <span key={w} className="rant">{window.displayWord(w, upper)}</span>)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="results-actions">
        <button className="btn btn-ghost" onClick={onExit}>Hub</button>
        <button className="btn btn-rust" onClick={onNext}>Next puzzle →</button>
      </div>
    </div>
  );
}

Object.assign(window, { ClusterGame });
