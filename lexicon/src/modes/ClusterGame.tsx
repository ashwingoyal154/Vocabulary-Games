import { useEffect, useRef, useState } from "react";
import type { Cluster } from "../data/vocab-data";
import { BIG_CLUSTERS } from "../data/vocab-data";
import { Store } from "../lib/store";
import type { SessionReview } from "../lib/store";
import { track } from "../lib/analytics";
import { CLUSTER_COLORS, displayWord, pick, shuffle, useStore, useToast } from "../lib/hooks";
import { ConnBadge } from "../components/Badges";
import { ToastStack } from "../components/Toast";
import { ShareReviewButton } from "../components/ShareReviewButton";

interface BoardGroup {
  gid: number;
  clusterId: number;
  name: string;
  conn: Cluster["conn"];
  antonyms: string[];
  /** the 4 tiles that appear on the board for this group */
  words: string[];
  /** every member of the family — used to reveal the full family once solved */
  allMembers: string[];
}

interface Tile {
  w: string;
  gid: number;
}

const MAX_MISTAKES = 4;

function buildClusterBoard(): BoardGroup[] | null {
  const big = BIG_CLUSTERS;

  function clusterWeight(c: Cluster) {
    let w = 1;
    c.members.forEach((m) => { w += (3 - Store.level(m)); });
    return w;
  }

  function pickClusters(): Cluster[] {
    const pool = big.slice();
    const chosen: Cluster[] = [];
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
    const used = new Set<string>();
    const groups: BoardGroup[] = [];
    let ok = true;
    for (let gi = 0; gi < clusters.length; gi++) {
      const c = clusters[gi];
      const avail = c.members.filter((m) => !used.has(m));
      if (avail.length < 4) { ok = false; break; }
      avail.sort((a, b) => Store.level(a) - Store.level(b) || Math.random() - .5);
      const chosenWords = avail.slice(0, 4 + Math.min(2, avail.length - 4));
      const four = shuffle(chosenWords).slice(0, 4);
      four.forEach((w) => used.add(w));
      groups.push({ gid: gi, clusterId: c.id, name: c.name, conn: c.conn, antonyms: c.antonyms, words: four, allMembers: c.members });
    }
    if (ok && groups.length === 4) return groups;
  }
  return null;
}

function layout(grps: BoardGroup[] | null): Tile[] {
  if (!grps) return [];
  const t: Tile[] = [];
  grps.forEach((g) => g.words.forEach((w) => t.push({ w, gid: g.gid })));
  return shuffle(t);
}

function ClusterTile({ word, selected, onClick, upper }: {
  word: string; selected: boolean; onClick: () => void; upper: boolean;
}) {
  let cls = "ctile";
  if (selected) cls += " sel";
  return (
    <button className={cls} onClick={onClick}>
      <span className="ctile-word">{displayWord(word, upper)}</span>
    </button>
  );
}

export function ClusterGame({ onExit }: { onExit: () => void }) {
  const StoreH = useStore();
  const upper = StoreH.get().settings.upper;
  const [toasts, toast] = useToast();

  const [groups, setGroups] = useState<BoardGroup[] | null>(() => buildClusterBoard());
  const [tiles, setTiles] = useState<Tile[]>(() => layout(groups));
  const [selected, setSelected] = useState<string[]>([]);
  const [solved, setSolved] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [clues, setClues] = useState<number[]>([]);
  const [shakeKey, setShakeKey] = useState(0);
  const [done, setDone] = useState(false);
  const [missed, setMissed] = useState(false);
  const [review, setReview] = useState<SessionReview | null>(null);
  // Points earned this board, tracked in a ref so finish() reads the final total.
  const pointsRef = useRef(0);

  // Log the first board once per mount (ref guard avoids a double-fire under
  // StrictMode's double-invoked effects in dev).
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    track("round_start", { mode: "clusters" });
  }, []);

  function newBoard() {
    track("round_start", { mode: "clusters", again: true });
    const g = buildClusterBoard();
    setGroups(g); setTiles(layout(g)); setSelected([]); setSolved([]);
    setMistakes(0); setHintsLeft(3); setClues([]); setDone(false); setMissed(false);
    setReview(null); pointsRef.current = 0;
  }

  const groupById = (gid: number) => groups?.find((g) => g.gid === gid);

  function toggle(w: string) {
    if (done) return;
    setSelected((s) => {
      if (s.includes(w)) return s.filter((x) => x !== w);
      if (s.length >= 4) return s;
      return [...s, w];
    });
  }

  function finish(wasMissed: boolean, solvedCount: number, mistakeCount: number) {
    setMissed(wasMissed);
    setDone(true);
    Store.finishRound({ correct: wasMissed ? 0 : 4 });
    track("round_finish", {
      mode: "clusters",
      correct: solvedCount,
      total: 4,
      points: pointsRef.current,
      missed: wasMissed,
      mistakes: mistakeCount,
    });
    setReview(Store.addReview({
      mode: "clusters",
      day: Store.todayStr(),
      ts: Date.now(),
      correct: solvedCount,
      total: 4,
      points: pointsRef.current,
      missed: wasMissed,
      mistakes: mistakeCount,
    }));
  }

  function revealAll(mistakeCount: number) {
    const remaining = (groups || []).map((g) => g.gid).filter((gid) => !solved.includes(gid));
    const solvedCount = solved.length;
    setSolved((s) => [...s, ...remaining]);
    setTiles([]);
    setSelected([]);
    finish(true, solvedCount, mistakeCount);
  }

  function submit() {
    if (selected.length !== 4 || !groups) return;
    const gids = selected.map((w) => tiles.find((t) => t.w === w)!.gid);
    const allSame = gids.every((g) => g === gids[0]);
    if (allSame) {
      const gid = gids[0];
      const g = groupById(gid)!;
      g.words.forEach((w) => Store.recordWord(w, true));
      const noMiss = mistakes === 0;
      const gain = 25 + (noMiss ? 5 : 0);
      pointsRef.current += gain;
      Store.addPoints(gain);
      Store.commit();
      const newSolved = [...solved, gid];
      setSolved(newSolved);
      setTiles((t) => t.filter((x) => x.gid !== gid));
      setSelected([]);
      toast(g.name, "good");
      if (newSolved.length === 4) finish(false, 4, mistakes);
    } else {
      const counts: Record<number, number> = {};
      gids.forEach((g) => counts[g] = (counts[g] || 0) + 1);
      const max = Math.max(...Object.values(counts));
      setShakeKey((k) => k + 1);
      const m = mistakes + 1;
      setMistakes(m);
      toast(max === 3 ? "So close — one away!" : "Not a group", "bad");
      if (m >= MAX_MISTAKES) revealAll(m);
    }
  }

  function useHint() {
    if (hintsLeft <= 0 || !groups) return;
    const candidates = groups.map((g) => g.gid).filter((gid) => !solved.includes(gid) && !clues.includes(gid));
    if (!candidates.length) { toast("No more clues", "bad"); return; }
    const gid = pick(candidates);
    setClues((c) => [...c, gid]);
    setHintsLeft((h) => h - 1);
  }

  if (!groups) {
    return (
      <div className="mode-wrap">
        <div className="mode-head">
          <button className="back-link" onClick={onExit}>‹ Hub</button>
          <div className="mode-title"><span className="eyebrow">Mode 01</span><h2>Clusters</h2></div>
          <span style={{ width: 40 }} />
        </div>
        <p className="mode-sub">Couldn't build a puzzle — try again.</p>
        <div className="cbar"><button className="btn btn-primary" onClick={newBoard}>Try again</button></div>
      </div>
    );
  }

  return (
    <div className="mode-wrap">
      <ToastStack toasts={toasts} />
      <div className="mode-head">
        <button className="back-link" onClick={onExit}>‹ Hub</button>
        <div className="mode-title">
          <span className="eyebrow">Mode 01</span>
          <h2>Clusters</h2>
        </div>
        <div className="hearts" title="Mistakes remaining">
          {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
            <span key={i} className={"heart " + (i < MAX_MISTAKES - mistakes ? "on" : "off")} />
          ))}
        </div>
      </div>

      <p className="mode-sub">Find four groups of four. Each group is a meaning-family — words that mean the same thing.</p>

      <div className="solved-stack">
        {solved.map((gid) => {
          const g = groupById(gid)!;
          const color = "var(" + CLUSTER_COLORS[solved.indexOf(gid) % 4] + ")";
          const extra = g.allMembers.filter((w) => g.words.indexOf(w) === -1);
          return (
            <div key={gid} className="solved-row fade-in" style={{ background: color }}>
              <div className="solved-row-head">
                <span className="solved-name">{g.name}</span>
                {g.conn && <span className="solved-conn">{g.conn === "+" ? "positive" : "negative"}</span>}
              </div>
              <div className="solved-words">
                {g.words.map((w, i) => (
                  <span key={w}>{(i > 0 ? "  ·  " : "") + displayWord(w, upper)}</span>
                ))}
                {extra.map((w) => (
                  <span key={w} className="fam-extra">{"  ·  " + displayWord(w, upper)}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {clues.filter((gid) => !solved.includes(gid)).length > 0 && (
        <div className="clue-bar">
          <span className="eyebrow">Clue{clues.length > 1 ? "s" : ""}:</span>
          {clues.filter((gid) => !solved.includes(gid)).map((gid) => (
            <span key={gid} className="clue-chip">{groupById(gid)!.name}</span>
          ))}
        </div>
      )}

      {!done && (
        <div key={shakeKey} className={"cboard" + (shakeKey ? " shake-once" : "")}>
          {tiles.map((t) => (
            <ClusterTile key={t.w} word={t.w} upper={upper}
              selected={selected.includes(t.w)}
              onClick={() => toggle(t.w)} />
          ))}
        </div>
      )}

      {!done && (
        <div className="cbar">
          <button className="btn btn-ghost btn-sm" onClick={() => setTiles((t) => shuffle(t))}>Shuffle</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected([])} disabled={!selected.length}>Deselect</button>
          <button className="btn btn-ghost btn-sm" onClick={useHint} disabled={hintsLeft <= 0}>
            Hint · {hintsLeft}
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={selected.length !== 4}>Submit</button>
        </div>
      )}

      {done && review && (
        <ClusterResults groups={groups} missed={missed} review={review} streak={StoreH.get().streak}
          upper={upper} onNext={newBoard} onExit={onExit} />
      )}
    </div>
  );
}

function ClusterResults({ groups, missed, review, streak, upper, onNext, onExit }: {
  groups: BoardGroup[]; missed: boolean; review: SessionReview; streak: number;
  upper: boolean; onNext: () => void; onExit: () => void;
}) {
  return (
    <div className="results fade-in">
      <div className="results-head">
        <span className="eyebrow">{missed ? "Out of guesses" : "Solved"}</span>
        <h3>{missed ? "Here's the full board" : "Four families, mastered"}</h3>
      </div>
      <div className="results-groups">
        {groups.map((g, i) => {
          const extra = g.allMembers.filter((w) => g.words.indexOf(w) === -1);
          return (
          <div key={g.gid} className="rgroup">
            <div className="rgroup-bar" style={{ background: "var(" + CLUSTER_COLORS[i % 4] + ")" }} />
            <div className="rgroup-body">
              <div className="rgroup-top">
                <span className="rgroup-name">{g.name}</span>
                {g.conn && <ConnBadge conn={g.conn} small />}
              </div>
              <div className="rgroup-words">
                {g.words.map((w) => <span key={w} className="rword">{displayWord(w, upper)}</span>)}
                {extra.map((w) => <span key={w} className="rword fam-extra">{displayWord(w, upper)}</span>)}
              </div>
              {g.antonyms.length > 0 && (
                <div className="rgroup-ant">
                  <span className="role-tag x">antonym</span>
                  {g.antonyms.map((w) => <span key={w} className="rant">{displayWord(w, upper)}</span>)}
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>
      <div className="results-actions">
        <button className="btn btn-ghost" onClick={onExit}>Hub</button>
        <ShareReviewButton review={review} streak={streak} className="btn btn-ghost" />
        <button className="btn btn-rust" onClick={onNext}>Next puzzle →</button>
      </div>
    </div>
  );
}
