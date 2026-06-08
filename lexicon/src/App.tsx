import { useEffect, useState } from "react";
import { Store } from "./lib/store";
import { useStore } from "./lib/hooks";
import { Hub, type Route } from "./modes/Hub";
import { Library } from "./modes/Library";
import { ClusterGame } from "./modes/ClusterGame";
import { QuizGame } from "./modes/QuizGame";
import { SettingsSheet, SettingsTrigger } from "./components/Settings";

const DEFAULT_DAILY_GOAL = 100;

export default function App() {
  const [route, setRoute] = useState<Route>("hub");
  const StoreH = useStore();
  const s = StoreH.get();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ensure the daily goal has a sane default the first time the app loads
  useEffect(() => {
    if (!Store.get().daily.goal) Store.setGoal(DEFAULT_DAILY_GOAL);
  }, []);

  const go = (r: Route) => setRoute(r);
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
          <span className="stat-pill gem"><span className="ico">◆</span>{StoreH.masteredCount()}</span>
          <SettingsTrigger onOpen={() => setSettingsOpen(true)} />
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
            const code = Store.exportCode();
            try { navigator.clipboard?.writeText(code)?.catch(() => {}); } catch { /* clipboard unavailable */ }
            window.prompt("Backup code copied. Save it somewhere — paste it on another browser/device via “Restore” to carry your progress:", code);
          }}>Back up</button>
          <button className="foot-btn" onClick={() => {
            const code = window.prompt("Paste your backup code to restore progress (this replaces current progress):");
            if (code && code.trim()) {
              const ok = Store.importCode(code);
              alert(ok ? "Progress restored." : "That code didn't look valid — nothing was changed.");
            }
          }}>Restore</button>
          <button className="foot-reset" onClick={() => {
            if (confirm("Reset all progress? Tip: back it up first.")) Store.reset();
          }}>Reset</button>
        </div>
      </footer>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        upper={s.settings.upper}
        dailyGoal={s.daily.goal}
        onChangeUpper={(v) => Store.setSetting("upper", v)}
        onChangeGoal={(v) => Store.setGoal(v)}
      />
    </div>
  );
}
