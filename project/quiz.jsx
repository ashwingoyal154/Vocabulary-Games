/* ============ QUIZ engine: Lightning (word→family) + Antonyms ============ */

function weightedWord() {
  const Store = window.Store;
  const pool = window.VOCAB.ALL_MEMBER_WORDS;
  const weights = pool.map((w) => (3 - Store.level(w)) + (Store.get().seen[w] ? 0 : 1.6) + 0.3);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

function makeLightningQ() {
  const V = window.VOCAB;
  const word = weightedWord();
  const entries = V.WORD_INDEX[word].filter((e) => e.role === "s" || e.role === "n");
  const correctIds = entries.map((e) => e.clusterId);
  const target = V.CLUSTERS[window.pick(correctIds)];
  // distractor clusters: not any of the word's clusters
  const others = V.CLUSTERS.filter((c) => correctIds.indexOf(c.id) === -1);
  const distract = window.sample(others, 3);
  const options = window.shuffle([
    { id: target.id, label: target.name, correct: true },
    ...distract.map((c) => ({ id: c.id, label: c.name, correct: false }))
  ]);
  return {
    kind: "lightning",
    word,
    conn: target.conn,
    answerLabel: target.name,
    options,
    teach: {
      clusterName: target.name,
      members: target.members.filter((m) => m !== word).slice(0, 5),
      antonyms: target.antonyms
    }
  };
}

function makeAntonymQ() {
  const V = window.VOCAB;
  const c = window.pick(V.ANTONYM_CLUSTERS);
  const antonym = window.pick(c.antonyms);
  const anchors = window.sample(c.members, Math.min(2, c.members.length));
  // distractors: same-family members (they are synonyms, NOT opposites) — tempting traps
  let distractPool = c.members.slice();
  if (distractPool.length < 3) {
    const extra = window.sample(V.ALL_MEMBER_WORDS.filter((w) => c.members.indexOf(w) === -1), 3 - distractPool.length);
    distractPool = distractPool.concat(extra);
  }
  const distract = window.sample(distractPool, 3);
  const options = window.shuffle([
    { w: antonym, correct: true },
    ...distract.map((w) => ({ w, correct: false }))
  ]);
  return {
    kind: "antonym",
    cluster: c,
    answerWord: antonym,
    anchors,
    options,
    conn: c.conn
  };
}

const ROUND_LEN = 12;

function QuizGame({ mode, onExit }) {
  const Store = useStore();
  const upper = Store.get().settings.upper;
  const gen = mode === "antonym" ? makeAntonymQ : makeLightningQ;

  const [q, setQ] = React.useState(() => gen());
  const [idx, setIdx] = React.useState(1);
  const [picked, setPicked] = React.useState(null);    // option index or word
  const [combo, setCombo] = React.useState(0);
  const [bestCombo, setBestCombo] = React.useState(0);
  const [correctCount, setCorrectCount] = React.useState(0);
  const [results, setResults] = React.useState(null);  // {correct, total, best}

  function answer(opt) {
    if (picked !== null) return;
    const isCorrect = !!opt.correct;
    setPicked(opt);
    const word = mode === "antonym" ? q.answerWord : q.word;
    Store.recordWord(word, isCorrect);
    if (isCorrect) {
      const nc = combo + 1;
      setCombo(nc);
      setBestCombo((b) => Math.max(b, nc));
      setCorrectCount((c) => c + 1);
      Store.addPoints(8 + Math.min(12, nc * 2));
    } else {
      setCombo(0);
    }
    Store.commit();
  }

  function next() {
    if (idx >= ROUND_LEN) {
      Store.finishRound({ correct: correctCount, wrong: ROUND_LEN - correctCount });
      setResults({ correct: correctCount, total: ROUND_LEN, best: bestCombo });
      return;
    }
    setQ(gen());
    setIdx((i) => i + 1);
    setPicked(null);
  }

  function restart() {
    setResults(null); setQ(gen()); setIdx(1); setPicked(null);
    setCombo(0); setBestCombo(0); setCorrectCount(0);
  }

  if (results) {
    return <QuizResults mode={mode} results={results} onAgain={restart} onExit={onExit} />;
  }

  const meta = mode === "antonym"
    ? { eyebrow: "Mode 03", title: "Antonyms", sub: "Spot the word that means the OPPOSITE of the family." }
    : { eyebrow: "Mode 02", title: "Lightning", sub: "Which meaning-family does this word belong to?" };

  return (
    <div className="mode-wrap">
      <div className="mode-head">
        <button className="back-link" onClick={onExit}>‹ Hub</button>
        <div className="mode-title">
          <span className="eyebrow">{meta.eyebrow}</span>
          <h2>{meta.title}</h2>
        </div>
        <div className={"combo " + (combo >= 3 ? "hot" : "")}>
          <span className="combo-x">×</span><span className="combo-n">{combo}</span>
        </div>
      </div>

      <div className="q-progress">
        <div className="q-progress-fill" style={{ width: ((idx - 1) / ROUND_LEN * 100) + "%" }} />
        <span className="q-count">{idx} / {ROUND_LEN}</span>
      </div>

      <p className="mode-sub">{meta.sub}</p>

      {mode === "lightning" ? (
        <LightningCard q={q} picked={picked} upper={upper} onAnswer={answer} />
      ) : (
        <AntonymCard q={q} picked={picked} upper={upper} onAnswer={answer} />
      )}

      <div className="q-foot">
        {picked !== null
          ? <button className="btn btn-rust" onClick={next}>{idx >= ROUND_LEN ? "See results →" : "Continue →"}</button>
          : <span className="q-hint-text">{mode === "antonym" ? "Tip: three of these are synonyms — one is the opposite." : "Tap the family that fits."}</span>}
      </div>
    </div>
  );
}

function LightningCard({ q, picked, upper, onAnswer }) {
  return (
    <div className="qcard">
      <div className="q-word-wrap">
        <div className="q-word">{window.displayWord(q.word, upper)}</div>
        {picked !== null && q.conn && (
          <div className="q-word-conn fade-in"><ConnBadge conn={q.conn} /></div>
        )}
      </div>
      <div className="q-options">
        {q.options.map((opt, i) => {
          let cls = "qopt";
          if (picked !== null) {
            if (opt.correct) cls += " right";
            else if (opt === picked) cls += " wrong";
            else cls += " dim";
          }
          return (
            <button key={i} className={cls} onClick={() => onAnswer(opt)} disabled={picked !== null}>
              {opt.label}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="q-teach fade-in">
          <span className="q-teach-label">Family · {q.teach.clusterName}</span>
          {q.teach.members.length > 0 && (
            <div className="q-teach-row">
              <span className="role-tag" style={{ background: "rgba(54,106,156,.12)", color: "var(--c-blue)" }}>also</span>
              {q.teach.members.map((m) => <span key={m} className="teach-word">{window.displayWord(m, upper)}</span>)}
            </div>
          )}
          {q.teach.antonyms.length > 0 && (
            <div className="q-teach-row">
              <span className="role-tag x">opposite</span>
              {q.teach.antonyms.map((m) => <span key={m} className="teach-word ant">{window.displayWord(m, upper)}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AntonymCard({ q, picked, upper, onAnswer }) {
  return (
    <div className="qcard">
      <div className="q-anchor">
        <span className="q-anchor-label">Opposite of</span>
        <div className="q-anchor-name">{q.cluster.name}</div>
        <div className="q-anchor-eg">
          {q.anchors.map((a) => <span key={a} className="teach-word">{window.displayWord(a, upper)}</span>)}
        </div>
      </div>
      <div className="q-options two">
        {q.options.map((opt, i) => {
          let cls = "qopt serif";
          if (picked !== null) {
            if (opt.correct) cls += " right";
            else if (opt === picked) cls += " wrong";
            else cls += " dim";
          }
          return (
            <button key={i} className={cls} onClick={() => onAnswer(opt)} disabled={picked !== null}>
              {window.displayWord(opt.w, upper)}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="q-teach fade-in">
          <span className="q-teach-label">
            <strong>{window.displayWord(q.answerWord, upper)}</strong> is the antonym — the rest are synonyms for “{q.cluster.name.toLowerCase()}”.
          </span>
        </div>
      )}
    </div>
  );
}

function QuizResults({ mode, results, onAgain, onExit }) {
  const pct = Math.round(results.correct / results.total * 100);
  const msg = pct >= 90 ? "Masterful." : pct >= 70 ? "Strong round." : pct >= 50 ? "Getting there." : "Keep grinding.";
  return (
    <div className="results fade-in" style={{ alignItems: "center", textAlign: "center" }}>
      <ProgressRing pct={results.correct / results.total} size={150} stroke={12}
        color="var(--c-green)">
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 40, fontWeight: 600 }}>{pct}%</span>
        <span className="eyebrow" style={{ marginTop: 2 }}>{results.correct}/{results.total}</span>
      </ProgressRing>
      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 28, margin: "14px 0 2px" }}>{msg}</h3>
      <p className="mode-sub" style={{ textAlign: "center" }}>Best combo this round · ×{results.best}</p>
      <div className="results-actions" style={{ justifyContent: "center" }}>
        <button className="btn btn-ghost" onClick={onExit}>Hub</button>
        <button className="btn btn-rust" onClick={onAgain}>Play again →</button>
      </div>
    </div>
  );
}

Object.assign(window, { QuizGame });
