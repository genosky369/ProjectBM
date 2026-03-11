/**
 * SpecPanel.jsx - User spec input panel with presets and dynamic level inputs.
 * Handles: class/pet/touhon/card grade counts, awakening points, level arrays.
 */
import { useState, Fragment } from "react";
import { Save, FolderOpen, Trash2 } from "lucide-react";
import { loadPresets, savePresets } from "./config";

export default function SpecPanel({ userSpec, setUserSpec }) {
  const [presets, setPresets] = useState(() => loadPresets());
  const [presetName, setPresetName] = useState("");
  const [showSave, setShowSave] = useState(false);

  /** Update a single numeric field */
  const update = (sys, key, val) =>
    setUserSpec(prev => ({ ...prev, [sys]: { ...prev[sys], [key]: parseInt(val) || 0 } }));

  /** Save current spec as a named preset */
  const handleSave = () => {
    if (!presetName.trim()) return;
    const next = [
      ...presets.filter(p => p.name !== presetName.trim()),
      { name: presetName.trim(), spec: JSON.parse(JSON.stringify(userSpec)), savedAt: Date.now() },
    ];
    setPresets(next);
    savePresets(next);
    setPresetName("");
    setShowSave(false);
  };

  /** Load a preset into the current spec */
  const handleLoad = (preset) => {
    setUserSpec(JSON.parse(JSON.stringify(preset.spec)));
  };

  /** Delete a named preset */
  const handleDelete = (name) => {
    const next = presets.filter(p => p.name !== name);
    setPresets(next);
    savePresets(next);
  };

  /**
   * Update a count field that has associated level arrays.
   * When count changes, the level array is resized to match.
   */
  const updateWithLevels = (sys, key, val) => {
    const count = parseInt(val) || 0;
    setUserSpec(prev => {
      const next = { ...prev, [sys]: { ...prev[sys], [key]: count } };
      if (sys === "투혼" && key === "불멸") {
        const old = prev.투혼?.불멸레벨 || [];
        next.투혼.불멸레벨 = Array.from({ length: count }, (_, i) => old[i] ?? 0);
      }
      if (sys === "카드" && key === "전설") {
        const old = prev.카드?.전설레벨 || [];
        next.카드.전설레벨 = Array.from({ length: count }, (_, i) => old[i] ?? 0);
      }
      return next;
    });
  };

  /** Update a single level value (clamped 0-5) */
  const updateLevel = (sys, levelKey, index, val) => {
    const lv = Math.min(5, Math.max(0, parseInt(val) || 0));
    setUserSpec(prev => {
      const arr = [...(prev[sys]?.[levelKey] || [])];
      arr[index] = lv;
      return { ...prev, [sys]: { ...prev[sys], [levelKey]: arr } };
    });
  };

  /** Section definitions for the spec form */
  const sections = [
    { sys: "클래스", label: "클래스", keys: ["영웅", "고대", "전설", "불멸"], unit: "개" },
    { sys: "클래스", label: "클래스 각성", keys: ["영웅각성", "고대각성", "전설각성"], unit: "pt",
      keyLabels: { "영웅각성": "영웅", "고대각성": "고대", "전설각성": "전설" } },
    { sys: "펫",    label: "펫",    keys: ["영웅", "고대", "전설", "불멸"], unit: "개" },
    { sys: "펫",    label: "펫 각성", keys: ["영웅각성", "고대각성", "전설각성"], unit: "pt",
      keyLabels: { "영웅각성": "영웅", "고대각성": "고대", "전설각성": "전설" } },
    { sys: "투혼",  label: "투혼",  keys: ["영웅", "고대", "전설", "불멸"], unit: "개" },
    { sys: "카드",  label: "카드",  keys: ["고대", "전설"],                   unit: "개" },
  ];

  /** Level input configs: which count keys trigger level sub-rows */
  const levelConfigs = [
    { sys: "투혼", countKey: "불멸", levelKey: "불멸레벨", label: "불멸" },
    { sys: "카드", countKey: "전설", levelKey: "전설레벨", label: "전설" },
  ];

  return (
    <div className="spec-panel">
      {/* Preset save/load area */}
      <div className="preset-area">
        <div className="preset-header">
          <button className="preset-btn" onClick={() => setShowSave(!showSave)}>
            <Save size={12} /> 저장
          </button>
        </div>
        {showSave && (
          <div className="preset-save-row">
            <input className="preset-name-input" placeholder="프리셋 이름"
              value={presetName} onChange={e => setPresetName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()} />
            <button className="preset-save-btn" onClick={handleSave}>확인</button>
          </div>
        )}
        {presets.length > 0 && (
          <div className="preset-list">
            {presets.map(p => (
              <div key={p.name} className="preset-item">
                <button className="preset-load-btn" onClick={() => handleLoad(p)}>
                  <FolderOpen size={11} /> {p.name}
                </button>
                <button className="icon-btn" onClick={() => handleDelete(p.name)}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Spec input sections */}
      {sections.map(({ sys, label, keys, unit, keyLabels }, idx) => (
        <div key={sys + "_" + idx} className="spec-section">
          <h4 className="spec-section-title">{label}</h4>
          {keys.map(key => {
            const hasLevels = levelConfigs.find(c => c.sys === sys && c.countKey === key);
            const count = userSpec[sys]?.[key] ?? 0;
            const levels = hasLevels ? (userSpec[sys]?.[hasLevels.levelKey] || []) : [];
            return (
              <Fragment key={key}>
                <div className="spec-row">
                  <label className="spec-label">{keyLabels?.[key] || key}</label>
                  <input type="number" className="spec-input" min={0}
                    value={count}
                    onChange={e => hasLevels
                      ? updateWithLevels(sys, key, e.target.value)
                      : update(sys, key, e.target.value)} />
                  <span className="spec-unit">{unit}</span>
                </div>
                {hasLevels && count > 0 && (
                  <div className="spec-levels">
                    {levels.map((lv, i) => (
                      <div key={i} className="spec-row spec-level-row">
                        <label className="spec-label spec-level-label">
                          {hasLevels.label} #{i + 1}
                        </label>
                        <input type="number" className="spec-input spec-level-input"
                          min={0} max={5} value={lv}
                          onChange={e => updateLevel(sys, hasLevels.levelKey, i, e.target.value)} />
                        <span className="spec-unit">강</span>
                      </div>
                    ))}
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
}
