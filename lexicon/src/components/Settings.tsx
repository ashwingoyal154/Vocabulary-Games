import { useState } from "react";

export interface SettingsValues {
  upper: boolean;
  dailyGoal: number;
}

export function SettingsTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="settings-trigger" onClick={onOpen} aria-label="Open settings">
      <span className="trigger-ico" aria-hidden="true">⚙</span>
      <span className="trigger-label">Settings</span>
    </button>
  );
}

export function SettingsSheet({
  open, onClose, upper, dailyGoal, onChangeUpper, onChangeGoal
}: {
  open: boolean;
  onClose: () => void;
  upper: boolean;
  dailyGoal: number;
  onChangeUpper: (v: boolean) => void;
  onChangeGoal: (v: number) => void;
}) {
  const [goalDraft, setGoalDraft] = useState(dailyGoal);

  if (!open) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <h3>Settings</h3>
          <button className="settings-close" onClick={onClose} aria-label="Close settings">✕</button>
        </div>

        <div className="settings-section">
          <span className="eyebrow">Display</span>
          <div className="settings-row">
            <div className="settings-row-h">
              <span className="settings-label">Word case</span>
            </div>
            <div className="seg-control" role="radiogroup" aria-label="Word case">
              {(["Title Case", "UPPERCASE"] as const).map((opt) => (
                <button
                  key={opt}
                  className={"seg-btn " + (((opt === "UPPERCASE") === upper) ? "on" : "")}
                  onClick={() => onChangeUpper(opt === "UPPERCASE")}
                  role="radio"
                  aria-checked={(opt === "UPPERCASE") === upper}
                >{opt}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="settings-section">
          <span className="eyebrow">Daily goal</span>
          <div className="settings-row">
            <div className="settings-row-h">
              <span className="settings-label">Points per day</span>
              <span className="settings-value">{goalDraft} pts</span>
            </div>
            <input
              className="range-input"
              type="range"
              min={40}
              max={300}
              step={20}
              value={goalDraft}
              onChange={(e) => {
                const v = Number(e.target.value);
                setGoalDraft(v);
                onChangeGoal(v);
              }}
            />
          </div>
        </div>

        <p className="settings-note">Changes apply immediately and are saved with your progress on this device.</p>
      </div>
    </div>
  );
}
