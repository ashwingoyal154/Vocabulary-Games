import { useRef, useState } from "react";
import type { Cluster, Connotation } from "../data/vocab-data";
import { ALL_MEMBER_WORDS, ANTONYM_CLUSTERS, CLUSTERS, WORD_INDEX } from "../data/vocab-data";
import { Store } from "../lib/store";
import type { SessionReview } from "../lib/store";
import { displayWord, pick, sample, shuffle, useStore } from "../lib/hooks";
import { ConnBadge } from "../components/Badges";
import { ProgressRing } from "../components/ProgressRing";
import { ShareReviewButton } from "../components/ShareReviewButton";

const ROUND_LEN = 12;

function weightedWord(): string {
  const pool = ALL_MEMBER_WORDS;
  const weights = pool.map((w) => (3 - Store.level(w)) + (Store.get().seen[w] ? 0 : 1.6) + 0.3);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

interface LightningOption { id: number; label: string; correct: boolean; }
interface LightningQ {
  kind: "lightning";
  word: string;
  conn: Connotation;
  answerLabel: string;
  options: LightningOption[];
  teach: { clusterName: string; members: string[]; antonyms: string[] };
}

function makeLightningQ(): LightningQ {
  const word = weightedWord();
  const entries = WORD_INDEX[word].filter((e) => e.role === "s" || e.role === "n");
  const correctIds = entries.map((e) => e.clusterId);
  const target = CLUSTERS[pick(correctIds)];
  const others = CLUSTERS.filter((c) => correctIds.indexOf(c.id) === -1);
  const distract = sample(others, 3);
  const options = shuffle<LightningOption>([
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

interface AntonymOption { w: string; correct: boolean; }
interface AntonymQ {
  kind: "antonym";
  cluster: Cluster;
  answerWord: string;
  anchors: string[];
  options: AntonymOption[];
  conn: Connotation;
}

function makeAntonymQ(): AntonymQ {
  const c = pick(ANTONYM_CLUSTERS);
  const antonym = pick(c.antonyms);
  const anchors = sample(c.members, Math.min(2, c.members.length));
  let distractPool = c.members.slice();
  if (distractPool.length < 3) {
    const extra = sample(ALL_MEMBER_WORDS.filter((w) => distractPool.indexOf(w) === -1), 3 - distractPool.length);
    distractPool = distractPool.concat(extra);
  }
  const distract = sample(distractPool, 3);
  const options = shuffle<AntonymOption>([
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

type Q = LightningQ | AntonymQ;
type Mode = "lightning" | "antonym";
type Picked = LightningOption | AntonymOption | null;

export function QuizGame({ mode, onExit }: { mode: Mode; onExit: () => void }) {
  const StoreH = useStore();
  const upper = StoreH.get().settings.upper;
  const gen = mode === "antonym" ? makeAntonymQ : makeLightningQ;

  const [q, setQ] = useState<Q>(() => gen());
  const [idx, setIdx] = useState(1);
  const [picked, setPicked] = useState<Picked>(null);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [review, setReview] = useState<SessionReview | null>(null);
  // Per-round accumulators kept in refs so the recap built at the end always reads
  // the final values (no stale closures, no extra renders).
  const pointsRef = useRef(0);
  const marksRef = useRef<boolean[]>([]);

  function answer(opt: LightningOption | AntonymOption) {
    if (picked !== null) return;
    const isCorrect = !!opt.correct;
    setPicked(opt);
    marksRef.current = [...marksRef.current, isCorrect];
    const word = mode === "antonym" ? (q as AntonymQ).answerWord : (q as LightningQ).word;
    Store.recordWord(word, isCorrect);
    if (isCorrect) {
      const nc = combo + 1;
      setCombo(nc);
      setBestCombo((b) => Math.max(b, nc));
      setCorrectCount((c) => c + 1);
      const gain = 8 + Math.min(12, nc * 2);
      pointsRef.current += gain;
      Store.addPoints(gain);
    } else {
      setCombo(0);
    }
    Store.commit();
  }

  function next() {
    if (idx >= ROUND_LEN) {
      Store.finishRound({ correct: correctCount, wrong: ROUND_LEN - correctCount });
      setReview(Store.addReview({
        mode,
        day: Store.todayStr(),
        ts: Date.now(),
        correct: correctCount,
        total: ROUND_LEN,
        points: pointsRef.current,
        bestCombo,
        marks: marksRef.current,
      }));
      return;
    }
    setQ(gen());
    setIdx((i) => i + 1);
    setPicked(null);
  }

  function restart() {
    setReview(null); setQ(gen()); setIdx(1); setPicked(null);
    setCombo(0); setBestCombo(0); setCorrectCount(0);
    pointsRef.current = 0; marksRef.current = [];
  }

  if (review) {
    return <QuizResults review={review} streak={StoreH.get().streak} onAgain={restart} onExit={onExit} />;
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
        <LightningCard q={q as LightningQ} picked={picked as LightningOption | null} upper={upper} onAnswer={answer} />
      ) : (
        <AntonymCard q={q as AntonymQ} picked={picked as AntonymOption | null} upper={upper} onAnswer={answer} />
      )}

      <div className="q-foot">
        {picked !== null
          ? <button className="btn btn-rust" onClick={next}>{idx >= ROUND_LEN ? "See results →" : "Continue →"}</button>
          : <span className="q-hint-text">{mode === "antonym" ? "Tip: three of these are synonyms — one is the opposite." : "Tap the family that fits."}</span>}
      </div>
    </div>
  );
}

function LightningCard({ q, picked, upper, onAnswer }: {
  q: LightningQ; picked: LightningOption | null; upper: boolean; onAnswer: (opt: LightningOption) => void;
}) {
  return (
    <div className="qcard">
      <div className="q-word-wrap">
        <div className="q-word">{displayWord(q.word, upper)}</div>
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
              {q.teach.members.map((m) => <span key={m} className="teach-word">{displayWord(m, upper)}</span>)}
            </div>
          )}
          {q.teach.antonyms.length > 0 && (
            <div className="q-teach-row">
              <span className="role-tag x">opposite</span>
              {q.teach.antonyms.map((m) => <span key={m} className="teach-word ant">{displayWord(m, upper)}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AntonymCard({ q, picked, upper, onAnswer }: {
  q: AntonymQ; picked: AntonymOption | null; upper: boolean; onAnswer: (opt: AntonymOption) => void;
}) {
  return (
    <div className="qcard">
      <div className="q-anchor">
        <span className="q-anchor-label">Opposite of</span>
        <div className="q-anchor-name">{q.cluster.name}</div>
        <div className="q-anchor-eg">
          {q.anchors.map((a) => <span key={a} className="teach-word">{displayWord(a, upper)}</span>)}
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
              {displayWord(opt.w, upper)}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="q-teach fade-in">
          <span className="q-teach-label">
            <strong>{displayWord(q.answerWord, upper)}</strong> is the antonym — the rest are synonyms for "{q.cluster.name.toLowerCase()}".
          </span>
        </div>
      )}
    </div>
  );
}

function QuizResults({ review, streak, onAgain, onExit }: {
  review: SessionReview; streak: number; onAgain: () => void; onExit: () => void;
}) {
  const pct = Math.round(review.correct / review.total * 100);
  const msg = pct >= 90 ? "Masterful." : pct >= 70 ? "Strong round." : pct >= 50 ? "Getting there." : "Keep grinding.";
  return (
    <div className="results fade-in" style={{ alignItems: "center", textAlign: "center" }}>
      <ProgressRing pct={review.correct / review.total} size={150} stroke={12} color="var(--c-green)">
        <span style={{ fontFamily: "var(--font-serif)", fontSize: 40, fontWeight: 600 }}>{pct}%</span>
        <span className="eyebrow" style={{ marginTop: 2 }}>{review.correct}/{review.total}</span>
      </ProgressRing>
      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 28, margin: "14px 0 2px" }}>{msg}</h3>
      <p className="mode-sub" style={{ textAlign: "center" }}>Best combo this round · ×{review.bestCombo ?? 0}</p>
      {review.marks && review.marks.length > 0 && (
        <div className="recap-grid" aria-label="per-question results">
          {review.marks.map((m, i) => (
            <span key={i} className={"recap-cell " + (m ? "hit" : "miss")} />
          ))}
        </div>
      )}
      <div className="results-actions" style={{ justifyContent: "center" }}>
        <button className="btn btn-ghost" onClick={onExit}>Hub</button>
        <ShareReviewButton review={review} streak={streak} className="btn btn-ghost" />
        <button className="btn btn-rust" onClick={onAgain}>Play again →</button>
      </div>
    </div>
  );
}
