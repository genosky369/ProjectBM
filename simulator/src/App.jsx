import { useState, useCallback, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Play, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { runSimulation, createInventory } from "./engine/simulator";
import { parsePackageItems } from "./engine/packageParser";
import { DEFAULT_PACKAGES, AVAILABLE_ITEMS } from "./data/packages";
import "./App.css";

const DEFAULT_PLC_MAX = {
  클래스: { 불멸: 1, 전설: 4, 고대: 16, 영웅: 50 },
  펛:   { 불멸: 1, 전설: 3, 고대: 9 },
  투혼: { 불멸: 1 },
  카드: { 전설레벨: 5, 고대레벨: 5 },
};

const METRICS = [
  { key: "클래스_불멸", label: "클래스 불멸", color: "#dc2626", getValue: s => s.클래스.불멸, plcPath: ["클래스", "불멸"] },
  { key: "클래스_전설", label: "클래스 전설", color: "#f97316", getValue: s => s.클래스.전설, plcPath: ["클래스", "전설"] },
  { key: "펛_불멸",    label: "펛 불멸",    color: "#2563eb", getValue: s => s.펛.불멸,    plcPath: ["펛", "불멸"] },
  { key: "펛_전설",    label: "펛 전설",    color: "#7c3aed", getValue: s => s.펛.전설,    plcPath: ["펛", "전설"] },
  { key: "투혼_불멸",  label: "투혼 불멸",  color: "#16a34a", getValue: s => s.투혼.불멸,  plcPath: ["투혼", "불멸"] },
  { key: "카드_전설강", label: "카드 전설강", color: "#0891b2", getValue: s => s.카드.전설레벨, plcPath: ["카드", "전설레벨"] },
];

function getRate(value, max) {
  if (!max) return 0;
  return Math.min(100, Math.round((value / max) * 1000) / 10);
}

let pkgIdCounter = 200;

export default function App() {
  const [packages, setPackages]   = useState(DEFAULT_PACKAGES);
  const [plcMax, setPlcMax]       = useState(DEFAULT_PLC_MAX);
  const [simResult, setSimResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activePanel, setActivePanel] = useState("packages");
  const [expandedPkgs, setExpandedPkgs] = useState(() => new Set(["pkg_001"]));

  const toggleExpand = useCallback((id) => {
    setExpandedPkgs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const runSim = useCallback(() => {
    setIsRunning(true);
    try {
      const pkgsForSim = packages
        .filter(p => p.items.length > 0)
        .map(p => ({ date: p.name, ticketItems: parsePackageItems(p.items) }));
      const result = runSimulation(pkgsForSim, createInventory());
      setSimResult(result);
    } finally {
      setIsRunning(false);
    }
  }, [packages]);

  const chartData = useMemo(() => {
    if (!simResult) return [];
    return simResult.map(({ date, snapshot }) => {
      const point = { name: date };
      for (const m of METRICS) {
        const val = m.getValue(snapshot);
        const max = m.plcPath.reduce((o, k) => o?.[k], plcMax);
        point[m.key] = getRate(val, max);
      }
      return point;
    });
  }, [simResult, plcMax]);

  const finalSnap = simResult?.[simResult.length - 1]?.snapshot;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title-row">
          <h1 className="app-title">캐릭터 성장 시뮬레이터</h1>
          <span className="badge">Monte Carlo 500회</span>
        </div>
        <p className="app-subtitle">패키지 구매 순서에 따른 PLC 달성률 누적 분석</p>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <div className="panel-tabs">
            <button className={"panel-tab" + (activePanel === "packages" ? " active" : "")}
              onClick={() => setActivePanel("packages")}>패키지 설정</button>
            <button className={"panel-tab" + (activePanel === "plc" ? " active" : "")}
              onClick={() => setActivePanel("plc")}>PLC 최대치</button>
          </div>

          <div className="panel-body">
            {activePanel === "packages" && (
              <PackagePanel packages={packages} setPackages={setPackages}
                expandedPkgs={expandedPkgs} toggleExpand={toggleExpand} />
            )}
            {activePanel === "plc" && <PlcPanel plcMax={plcMax} setPlcMax={setPlcMax} />}
          </div>

          <div className="sidebar-footer">
            <span className="pkg-count-label">{packages.length}개 패키지</span>
            <button className="run-btn" onClick={runSim}
              disabled={isRunning || packages.length === 0}>
              <Play size={14} />
              {isRunning ? "시뮬레이션 중..." : "시뮬레이션 실행"}
            </button>
          </div>
        </aside>

        <main className="main-area">
          {!simResult ? (
            <div className="chart-empty">
              <div className="empty-icon">📊</div>
              <p className="empty-main">패키지를 설정하고 시뮬레이션을 실행하세요</p>
              <p className="empty-sub">샘플 유저가 패키지를 순서대로 모두 구매했을 때 성장 곡선을<br />분석합니다</p>
            </div>
          ) : (
            <div className="chart-section">
              <div className="chart-top">
                <h2 className="chart-title">PLC 달성률 추이</h2>
                <span className="chart-note">패키지 구매 후 누적 달성률 (%)</span>
              </div>
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-28} textAnchor="end" height={64} interval={0} />
                  <YAxis domain={[0, 105]} tickFormatter={v => v + "%"} tick={{ fontSize: 11 }} width={44} />
                  <ReferenceLine y={100} stroke="#9ca3af" strokeDasharray="5 3"
                    label={{ value: "PLC 100%", position: "insideTopRight", fill: "#9ca3af", fontSize: 10 }} />
                  <Tooltip formatter={(v, name) => [v + "%", name]} contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
                  {METRICS.map(m => (
                    <Line key={m.key} type="monotone" dataKey={m.key} name={m.label}
                      stroke={m.color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              {finalSnap && <SummaryTable snapshot={finalSnap} plcMax={plcMax} />}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function PackagePanel({ packages, setPackages, expandedPkgs, toggleExpand }) {
  const addPackage = () => {
    const id = "pkg_" + (++pkgIdCounter);
    setPackages(prev => [...prev, { id, name: "새 패키지 " + (prev.length + 1), items: [] }]);
  };
  const removePackage = id => setPackages(prev => prev.filter(p => p.id !== id));
  const updatePackage = (id, fn) => setPackages(prev => prev.map(p => p.id === id ? fn(p) : p));
  return (
    <div className="pkg-list">
      {packages.map((pkg, idx) => (
        <PackageCard key={pkg.id} pkg={pkg} index={idx + 1}
          isExpanded={expandedPkgs.has(pkg.id)}
          onToggle={() => toggleExpand(pkg.id)}
          onRemove={() => removePackage(pkg.id)}
          onUpdate={fn => updatePackage(pkg.id, fn)} />
      ))}
      <button className="add-pkg-btn" onClick={addPackage}>
        <Plus size={13} /> 패키지 추가
      </button>
    </div>
  );
}

function PackageCard({ pkg, index, isExpanded, onToggle, onRemove, onUpdate }) {
  const addItem = () =>
    onUpdate(p => ({ ...p, items: [...p.items, { name: "찬란한 클래스 11회", quantity: 1 }] }));
  const removeItem = i =>
    onUpdate(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, value) =>
    onUpdate(p => ({ ...p, items: p.items.map((it, idx) => idx === i ? { ...it, [field]: value } : it) }));
  const totalQty = pkg.items.reduce((s, it) => s + (it.quantity || 0), 0);
  return (
    <div className="pkg-card">
      <div className="pkg-card-header" onClick={onToggle}>
        <div className="pkg-header-left">
          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span className="pkg-index">{index}</span>
          <input className="pkg-name-input" value={pkg.name}
            onChange={e => { e.stopPropagation(); onUpdate(p => ({ ...p, name: e.target.value })); }}
            onClick={e => e.stopPropagation()} />
        </div>
        <div className="pkg-header-right">
          <span className="pkg-meta">{pkg.items.length}종 · {totalQty}장</span>
          <button className="icon-btn" onClick={e => { e.stopPropagation(); onRemove(); }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="pkg-card-body">
          {pkg.items.map((item, i) => (
            <div key={i} className="item-row">
              <select className="item-name-sel" value={item.name}
                onChange={e => updateItem(i, "name", e.target.value)}>
                {AVAILABLE_ITEMS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <input type="number" className="item-qty-inp" value={item.quantity} min={1}
                onChange={e => updateItem(i, "quantity", parseInt(e.target.value) || 1)} />
              <span className="item-qty-unit">장</span>
              <button className="icon-btn" onClick={() => removeItem(i)}><Trash2 size={11} /></button>
            </div>
          ))}
          <button className="add-item-btn" onClick={addItem}><Plus size={11} /> 아이템 추가</button>
        </div>
      )}
    </div>
  );
}

function PlcPanel({ plcMax, setPlcMax }) {
  const update = (sys, key, val) =>
    setPlcMax(prev => ({ ...prev, [sys]: { ...prev[sys], [key]: parseFloat(val) || 0 } }));
  const sections = [
    { sys: "클래스", label: "클래스", keys: ["불멸", "전설", "고대", "영웅"] },
    { sys: "펛",    label: "펛",    keys: ["불멸", "전설", "고대"] },
    { sys: "투혼",  label: "투혼",  keys: ["불멸"] },
    { sys: "카드",  label: "카드",  keys: ["전설레벨", "고대레벨"] },
  ];
  return (
    <div className="plc-panel">
      <p className="plc-desc">라이브 최대치 기준으로 달성률(%)을 산출합니다.</p>
      {sections.map(({ sys, label, keys }) => (
        <div key={sys} className="plc-section">
          <h4 className="plc-section-title">{label}</h4>
          {keys.map(key => (
            <div key={key} className="plc-row">
              <label className="plc-label">{key}</label>
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

function SummaryTable({ snapshot, plcMax }) {
  const rows = [
    { label: "클래스 불멸", v: snapshot.클래스.불멸, max: plcMax.클래스?.불멸 },
    { label: "클래스 전설", v: snapshot.클래스.전설, max: plcMax.클래스?.전설 },
    { label: "클래스 고대", v: snapshot.클래스.고대, max: plcMax.클래스?.고대 },
    { label: "클래스 영웅", v: snapshot.클래스.영웅, max: plcMax.클래스?.영웅 },
    null,
    { label: "펛 불멸", v: snapshot.펛.불멸, max: plcMax.펛?.불멸 },
    { label: "펛 전설", v: snapshot.펛.전설, max: plcMax.펛?.전설 },
    { label: "펛 고대",  v: snapshot.펛.고대,  max: plcMax.펛?.고대 },
    null,
    { label: "투혼 불멸", v: snapshot.투혼.불멸, max: plcMax.투혼?.불멸 },
    null,
    { label: "카드 전설강", v: snapshot.카드.전설레벨, max: plcMax.카드?.전설레벨 },
    { label: "카드 고대강", v: snapshot.카드.고대레벨, max: plcMax.카드?.고대레벨 },
  ];
  return (
    <div className="summary-wrap">
      <h3 className="summary-title">
        최종 달성 현황 <span className="summary-note">(전 패키지 구매 완료 기준, 평균값)</span>
      </h3>
      <table className="summary-table">
        <thead><tr>
          <th>지표</th><th>평균값</th><th>PLC 최대</th><th>달성률</th><th>소모 수준</th>
        </tr></thead>
        <tbody>
          {rows.map((row, i) => row === null
            ? <tr key={"s"+i}><td colSpan={5} className="td-sep" /></tr>
            : <SummaryRow key={row.label} row={row} />
          )}
        </tbody>
      </table>
    </div>
  );
}

function SummaryRow({ row }) {
  const rate = getRate(row.v, row.max);
  const color = rate >= 80 ? "#dc2626" : rate >= 50 ? "#f97316" : "#16a34a";
  return (
    <tr>
      <td className="td-label">{row.label}</td>
      <td className="td-num">{row.v.toFixed(2)}</td>
      <td className="td-num">{row.max ?? "-"}</td>
      <td className="td-num"><span style={{ color, fontWeight: 600 }}>{row.max ? rate + "%" : "-"}</span></td>
      <td>{row.max
        ? <div className="rate-bar"><div className="rate-fill" style={{ width: Math.min(rate, 100) + "%", background: color }} /></div>
        : "-"}</td>
    </tr>
  );
}