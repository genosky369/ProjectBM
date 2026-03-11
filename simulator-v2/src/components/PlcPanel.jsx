/**
 * PlcPanel.jsx - PLC max values configuration panel.
 * Allows setting the live maximum for each system/grade used to calculate achievement rates.
 */

export default function PlcPanel({ plcMax, setPlcMax }) {
  /** Update a single PLC max field */
  const update = (sys, key, val) =>
    setPlcMax(prev => ({ ...prev, [sys]: { ...prev[sys], [key]: parseFloat(val) || 0 } }));

  /** Section definitions for the PLC form */
  const sections = [
    { sys: "클래스", label: "클래스", keys: ["불멸", "전설", "고대", "영웅"] },
    { sys: "클래스", label: "클래스 각성", keys: ["전설각성", "고대각성", "영웅각성"],
      keyLabels: { "전설각성": "전설", "고대각성": "고대", "영웅각성": "영웅" } },
    { sys: "펫",    label: "펫",    keys: ["불멸", "전설", "고대"] },
    { sys: "펫",    label: "펫 각성", keys: ["전설각성", "고대각성", "영웅각성"],
      keyLabels: { "전설각성": "전설", "고대각성": "고대", "영웅각성": "영웅" } },
    { sys: "투혼",  label: "투혼",  keys: ["불멸", "전설", "고대"] },
    { sys: "카드",  label: "카드",  keys: ["전설", "고대"] },
  ];

  return (
    <div className="plc-panel">
      <p className="plc-desc">라이브 최대치 기준으로 달성률(%)을 산출합니다.</p>
      {sections.map(({ sys, label, keys, keyLabels }, idx) => (
        <div key={sys + "_" + idx} className="plc-section">
          <h4 className="plc-section-title">{label}</h4>
          {keys.map(key => (
            <div key={key} className="plc-row">
              <label className="plc-label">{keyLabels?.[key] || key}</label>
              <input type="number" className="plc-input" min={0}
                value={plcMax[sys]?.[key] ?? 0}
                onChange={e => update(sys, key, e.target.value)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
