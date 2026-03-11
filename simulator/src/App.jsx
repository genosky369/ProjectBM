import { useState, useCallback, useMemo, useRef, Fragment } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Play, Plus, Trash2, ChevronDown, ChevronRight, Calendar, Upload, Save, FolderOpen } from "lucide-react";
import { runSimulation, createInventory } from "./engine/simulator";
import { parsePackageItems } from "./engine/packageParser";
import { DEFAULT_PACKAGES, AVAILABLE_ITEMS } from "./data/packages";
import { parseExcelFile, extractDateLabel, parseSalesExcel } from "./utils/excelParser";
import { calcGodaeEquivalent, calcDetailedDrops, computeGodaeValues } from "./utils/expectedValue";
import "./App.css";

const STORAGE_KEY_PRESETS = "bm_sim_user_presets";

const DEFAULT_PLC_MAX = {
  클래스: { 불멸: 1, 전설: 4, 고대: 16, 영웅: 50, 영웅각성: 3, 고대각성: 3, 전설각성: 3 },
  펫:    { 불멸: 1, 전설: 3, 고대: 9, 영웅각성: 5, 고대각성: 5, 전설각성: 5 },
  투혼:  { 불멸: 1, 전설: 5, 고대: 10 },
  카드:  { 전설: 9, 고대: 9 },
};

const DEFAULT_USER_SPEC = {
  클래스: { 영웅: 0, 고대: 0, 전설: 0, 불멸: 0, 영웅각성: 0, 고대각성: 0, 전설각성: 0 },
  펫:    { 영웅: 0, 고대: 0, 전설: 0, 불멸: 0, 영웅각성: 0, 고대각성: 0, 전설각성: 0 },
  투혼:  { 영웅: 0, 고대: 0, 전설: 0, 불멸: 0, 불멸레벨: [] },
  카드:  { 전설: 0, 고대: 0, 전설레벨: [] },
};

// 시스템별 메트릭: 요청3 - 고대/전설/불멸만 (영웅 제거)
const SYSTEM_METRICS = {
  클래스: [
    { key: "불멸", label: "불멸", color: "#dc2626", getValue: s => s.클래스.불멸, plcPath: ["클래스", "불멸"] },
    { key: "전설", label: "전설", color: "#f97316", getValue: s => s.클래스.전설, plcPath: ["클래스", "전설"] },
    { key: "고대", label: "고대", color: "#eab308", getValue: s => s.클래스.고대, plcPath: ["클래스", "고대"] },
    { key: "전설각성", label: "전설 각성", color: "#e11d48", strokeDasharray: "6 3", getValue: s => s.클래스.전설각성, plcPath: ["클래스", "전설각성"] },
    { key: "고대각성", label: "고대 각성", color: "#d97706", strokeDasharray: "6 3", getValue: s => s.클래스.고대각성, plcPath: ["클래스", "고대각성"] },
    { key: "영웅각성", label: "영웅 각성", color: "#65a30d", strokeDasharray: "6 3", getValue: s => s.클래스.영웅각성, plcPath: ["클래스", "영웅각성"] },
  ],
  펫: [
    { key: "불멸", label: "불멸", color: "#dc2626", getValue: s => s.펫.불멸, plcPath: ["펫", "불멸"] },
    { key: "전설", label: "전설", color: "#f97316", getValue: s => s.펫.전설, plcPath: ["펫", "전설"] },
    { key: "고대", label: "고대", color: "#eab308", getValue: s => s.펫.고대, plcPath: ["펫", "고대"] },
    { key: "전설각성", label: "전설 각성", color: "#e11d48", strokeDasharray: "6 3", getValue: s => s.펫.전설각성, plcPath: ["펫", "전설각성"] },
    { key: "고대각성", label: "고대 각성", color: "#d97706", strokeDasharray: "6 3", getValue: s => s.펫.고대각성, plcPath: ["펫", "고대각성"] },
    { key: "영웅각성", label: "영웅 각성", color: "#65a30d", strokeDasharray: "6 3", getValue: s => s.펫.영웅각성, plcPath: ["펫", "영웅각성"] },
  ],
  투혼: [
    { key: "불멸", label: "불멸", color: "#dc2626", getValue: s => s.투혼.불멸, plcPath: ["투혼", "불멸"] },
    { key: "전설", label: "전설", color: "#f97316", getValue: s => s.투혼.전설, plcPath: ["투혼", "전설"] },
    { key: "고대", label: "고대", color: "#eab308", getValue: s => s.투혼.고대, plcPath: ["투혼", "고대"] },
  ],
  카드: [
    { key: "전설", label: "전설", color: "#0891b2", getValue: s => s.카드.전설, plcPath: ["카드", "전설"] },
    { key: "고대", label: "고대", color: "#7c3aed", getValue: s => s.카드.고대, plcPath: ["카드", "고대"] },
  ],
};

const TABLE_ROWS = [
  { label: "클래스 불멸", getValue: s => s.클래스.불멸, plcPath: ["클래스", "불멸"] },
  { label: "클래스 전설", getValue: s => s.클래스.전설, plcPath: ["클래스", "전설"] },
  { label: "클래스 고대", getValue: s => s.클래스.고대, plcPath: ["클래스", "고대"] },
  { label: "클래스 전설각성", getValue: s => s.클래스.전설각성, plcPath: ["클래스", "전설각성"] },
  { label: "클래스 고대각성", getValue: s => s.클래스.고대각성, plcPath: ["클래스", "고대각성"] },
  { label: "클래스 영웅각성", getValue: s => s.클래스.영웅각성, plcPath: ["클래스", "영웅각성"] },
  null,
  { label: "펫 불멸",  getValue: s => s.펫.불멸,  plcPath: ["펫", "불멸"] },
  { label: "펫 전설",  getValue: s => s.펫.전설,  plcPath: ["펫", "전설"] },
  { label: "펫 고대",  getValue: s => s.펫.고대,  plcPath: ["펫", "고대"] },
  { label: "펫 전설각성", getValue: s => s.펫.전설각성, plcPath: ["펫", "전설각성"] },
  { label: "펫 고대각성", getValue: s => s.펫.고대각성, plcPath: ["펫", "고대각성"] },
  { label: "펫 영웅각성", getValue: s => s.펫.영웅각성, plcPath: ["펫", "영웅각성"] },
  null,
  { label: "투혼 불멸", getValue: s => s.투혼.불멸, plcPath: ["투혼", "불멸"] },
  { label: "투혼 전설", getValue: s => s.투혼.전설, plcPath: ["투혼", "전설"] },
  { label: "투혼 고대", getValue: s => s.투혼.고대, plcPath: ["투혼", "고대"] },
  null,
  { label: "카드 전설", getValue: s => s.카드.전설, plcPath: ["카드", "전설"] },
  { label: "카드 고대", getValue: s => s.카드.고대, plcPath: ["카드", "고대"] },
];

function getRate(value, max) {
  if (!max) return 0;
  return Math.min(100, Math.round((value / max) * 1000) / 10);
}

function groupPackagesByDate(packages) {
  const groups = new Map();
  let counter = 0;
  for (const pkg of packages) {
    const match = pkg.name.match(/^\[(\d{4})\]/);
    const key = match ? match[1] : "기타";
    if (!groups.has(key)) {
      counter++;
      const mm = key === "기타" ? "" : key.slice(0, 2);
      const dd = key === "기타" ? "" : key.slice(2, 4);
      const label = key === "기타" ? "기타 패키지" : `${parseInt(mm)}월 ${parseInt(dd)}일 기획서`;
      groups.set(key, { id: "bm_" + key + "_" + counter, dateKey: key, label, packages: [] });
    }
    groups.get(key).packages.push(pkg);
  }
  return Array.from(groups.values());
}

function createInventoryFromSpec(spec) {
  const inv = createInventory();
  for (const grade of ["영웅", "고대", "전설", "불멸"]) {
    inv.클래스[grade] = spec.클래스?.[grade] || 0;
    inv.펫[grade] = spec.펫?.[grade] || 0;
  }
  // 투혼: 등급별 개수 + 불멸 강화
  if (!inv.투혼.enhanced) inv.투혼.enhanced = {};
  for (const grade of ["영웅", "고대", "전설"]) {
    inv.투혼.gradeCount[grade] = spec.투혼?.[grade] || 0;
  }
  inv.투혼.enhanced["불멸"] = spec.투혼?.불멸 || 0;
  inv.투혼.existingLevels = spec.투혼?.불멸레벨 || [];
  // 카드: 등급별 개수
  inv.카드.gradeCount["전설"] = spec.카드?.전설 || 0;
  inv.카드.gradeCount["고대"] = spec.카드?.고대 || 0;
  inv.카드.existingLevels = { 전설: spec.카드?.전설레벨 || [] };
  // 각성 초기값
  for (const grade of ["영웅", "고대", "전설"]) {
    inv.awakening.클래스[grade] = spec.클래스?.[grade + "각성"] || 0;
    inv.awakening.펫[grade] = spec.펫?.[grade + "각성"] || 0;
  }
  return inv;
}

let bmGroupIdCounter = 1000;
let pkgIdCounter = 2000;

// ============================================================
// localStorage 프리셋 관리
// ============================================================
function loadPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRESETS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function savePresets(presets) {
  localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
}

// ============================================================
// App
// ============================================================
export default function App() {
  const [bmGroups, setBmGroups] = useState(() => groupPackagesByDate(DEFAULT_PACKAGES));
  const [plcMax, setPlcMax] = useState(DEFAULT_PLC_MAX);
  const [userSpec, setUserSpec] = useState(DEFAULT_USER_SPEC);
  const [simResult, setSimResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activePanel, setActivePanel] = useState("spec");
  const [activeChart, setActiveChart] = useState("클래스");
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  // 매출지표: { periodStart, periodEnd, periodLabel, items: Map<name, {revenue,buyers,purchases,quantity}> }
  // 매출지표: dateKey별 매출 데이터 { "0128": { periodLabel, items: Map }, ... }
  const [salesDataMap, setSalesDataMap] = useState({});

  const toggleGroup = useCallback((id) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const totalPkgCount = bmGroups.reduce((s, g) => s + g.packages.length, 0);

  const handleExcelLoad = useCallback(({ dateKey, label, packages }) => {
    setBmGroups(prev => {
      const existing = prev.find(g => g.dateKey === dateKey);
      if (existing) {
        return prev.map(g => g.dateKey === dateKey
          ? { ...g, packages: [...g.packages, ...packages] }
          : g
        );
      }
      const id = "bm_xl_" + (++bmGroupIdCounter);
      return [...prev, { id, dateKey, label, packages }];
    });
  }, []);

  const runSim = useCallback(() => {
    setIsRunning(true);
    try {
      const pkgsForSim = bmGroups
        .map(g => ({
          date: g.label,
          ticketItems: g.packages
            .filter(p => p.items.length > 0)
            .flatMap(p => parsePackageItems(p.items)),
        }))
        .filter(e => e.ticketItems.length > 0);
      if (pkgsForSim.length === 0) return;
      const startInv = createInventoryFromSpec(userSpec);
      const result = runSimulation(pkgsForSim, startInv);
      setSimResult(result);
    } finally {
      setIsRunning(false);
    }
  }, [bmGroups, userSpec]);

  // 선택된 시스템의 차트 데이터 (%, raw, max 포함)
  const chartData = useMemo(() => {
    if (!simResult) return [];
    const metrics = SYSTEM_METRICS[activeChart];
    if (!metrics) return [];
    return simResult.map(({ date, snapshot }) => {
      const point = { name: date };
      for (const m of metrics) {
        const max = m.plcPath.reduce((o, k) => o?.[k], plcMax);
        const raw = m.getValue(snapshot);
        point[m.key] = getRate(raw, max);
        point[m.key + "_raw"] = Math.round(raw * 100) / 100;
        point[m.key + "_max"] = max || 0;
      }
      return point;
    });
  }, [simResult, plcMax, activeChart]);

  // 패키지명 정규화 (매출 매칭용): [MMDD] 접두사 + " (캐릭터 귀속)" 등 괄호 접미사 제거
  const normalizeName = (name) => name.replace(/^\[\d{4}\]\s*/, '').replace(/\s*\(.*?\)\s*$/, '').trim();

  // 매출 파일 추가 핸들러
  const handleSalesLoad = (dateKey, salesResult) => {
    setSalesDataMap(prev => ({ ...prev, [dateKey]: salesResult }));
  };
  const handleSalesClear = (dateKey) => {
    setSalesDataMap(prev => {
      const next = { ...prev };
      delete next[dateKey];
      return next;
    });
  };
  const handleSalesClearAll = () => setSalesDataMap({});

  // 상품 분석 데이터 (시뮬 필요 없음)
  const analysisData = useMemo(() => {
    return bmGroups.map(group => {
      const allItems = group.packages
        .filter(p => p.items.length > 0)
        .flatMap(p => parsePackageItems(p.items));
      const godae = calcGodaeEquivalent(allItems);
      const totalPrice = group.packages.reduce((s, p) => s + (p.price || 0), 0);

      // dateKey로 매출 데이터 매칭
      const groupSales = salesDataMap[group.dateKey] || null;
      const hasSales = !!groupSales;

      // 패키지별 개별 환산 + 매출 매칭
      const pkgDetails = group.packages.map(pkg => {
        const items = parsePackageItems(pkg.items);
        const baseName = normalizeName(pkg.name);
        // 매출 데이터에서 매칭: 정확 매칭 → 정규화 매칭
        let sales = null;
        if (hasSales) {
          sales = groupSales.items.get(baseName) || null;
          if (!sales) {
            // 매출지표 아이템명도 정규화해서 재매칭
            for (const [salesName, salesVal] of groupSales.items) {
              if (normalizeName(salesName) === baseName) {
                sales = salesVal;
                break;
              }
            }
          }

        }
        return {
          name: pkg.name, price: pkg.price,
          purchaseLimit: pkg.purchaseLimit || null,
          godae: calcGodaeEquivalent(items),
          items: pkg.items, rawItems: pkg.rawItems,
          sales,
        };
      });

      // 그룹 전체 매출 합계
      const totalRevenue = hasSales
        ? pkgDetails.reduce((s, p) => s + (p.sales?.revenue || 0), 0)
        : null;

      return {
        label: group.label, dateKey: group.dateKey,
        godae, totalPrice, pkgDetails, pkgCount: group.packages.length,
        hasSales, totalRevenue,
        salesPeriod: groupSales?.periodLabel || null,
      };
    });
  }, [bmGroups, salesDataMap]);

  const CHART_TABS = simResult
    ? ["클래스", "펫", "투혼", "카드", "표", "상품 분석"]
    : ["상품 분석"];

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title-row">
          <h1 className="app-title">캐릭터 성장 시뮬레이터</h1>
          <span className="badge">Monte Carlo 500회</span>
        </div>
        <p className="app-subtitle">BM 기획서 드롭 → 패키지 자동 추출 → PLC 달성률 시각화</p>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <div className="panel-tabs">
            <button className={"panel-tab" + (activePanel === "spec" ? " active" : "")}
              onClick={() => setActivePanel("spec")}>유저 스펙</button>
            <button className={"panel-tab" + (activePanel === "bm" ? " active" : "")}
              onClick={() => setActivePanel("bm")}>기획서</button>
            <button className={"panel-tab" + (activePanel === "plc" ? " active" : "")}
              onClick={() => setActivePanel("plc")}>PLC</button>
          </div>

          <div className="panel-body">
            {activePanel === "spec" && (
              <SpecPanel userSpec={userSpec} setUserSpec={setUserSpec} />
            )}
            {activePanel === "bm" && (
              <BmGroupsPanel
                bmGroups={bmGroups}
                setBmGroups={setBmGroups}
                expandedGroups={expandedGroups}
                toggleGroup={toggleGroup}
                onExcelLoad={handleExcelLoad}
              />
            )}
            {activePanel === "plc" && <PlcPanel plcMax={plcMax} setPlcMax={setPlcMax} />}
          </div>

          <div className="sidebar-footer">
            <span className="pkg-count-label">{bmGroups.length}개 기획서 · {totalPkgCount}개 패키지</span>
            <button className="run-btn" onClick={runSim}
              disabled={isRunning || totalPkgCount === 0}>
              <Play size={14} />
              {isRunning ? "시뮬레이션 중..." : "시뮬레이션 실행"}
            </button>
          </div>
        </aside>

        <main className="main-area">
          <div className="chart-section">
            <div className="chart-sys-tabs">
              {CHART_TABS.map(tab => (
                <button key={tab}
                  className={"chart-sys-tab" + (activeChart === tab ? " active" : "")}
                  onClick={() => setActiveChart(tab)}>
                  {tab}
                </button>
              ))}
            </div>

            {activeChart === "상품 분석" ? (
              <PackageAnalysisTab
                data={analysisData}
                salesDataMap={salesDataMap}
                bmGroups={bmGroups}
                onSalesLoad={handleSalesLoad}
                onSalesClear={handleSalesClear}
                onSalesClearAll={handleSalesClearAll}
              />
            ) : activeChart === "표" && simResult ? (
              <FullTable simResult={simResult} plcMax={plcMax} />
            ) : SYSTEM_METRICS[activeChart] && simResult ? (
              <SystemChart
                system={activeChart}
                chartData={chartData}
                metrics={SYSTEM_METRICS[activeChart]}
              />
            ) : !simResult && activeChart !== "상품 분석" ? (
              <div className="chart-empty">
                <div className="empty-icon">&#x1F4CA;</div>
                <p className="empty-main">시뮬레이션을 실행하면 그래프가 표시됩니다</p>
                <p className="empty-sub">
                  유저 스펙/기획서/PLC를 설정 후 하단 실행 버튼을 눌러주세요
                </p>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

// ============================================================
// 시스템별 차트 (요청3: Y축 자동스케일)
// ============================================================
function SystemChart({ system, chartData, metrics }) {
  const [visible, setVisible] = useState(() =>
    Object.fromEntries(metrics.map(m => [m.key, true]))
  );
  const [viewMode, setViewMode] = useState("rate"); // "rate" | "count"

  const toggleMetric = (key) =>
    setVisible(prev => ({ ...prev, [key]: !prev[key] }));

  const visibleMetrics = metrics.filter(m => visible[m.key]);
  const isCount = viewMode === "count";

  // 차트에 사용할 dataKey: rate면 m.key(%), count면 m.key+"_raw"
  const getDataKey = (m) => isCount ? m.key + "_raw" : m.key;

  // Y축 자동 스케일: 보이는 메트릭 기준
  const allValues = visibleMetrics.length > 0
    ? chartData.flatMap(d => visibleMetrics.map(m => d[getDataKey(m)] ?? 0))
    : isCount ? [0, 1] : [0, 100];
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);

  let yDomain, yTickFormatter;
  if (isCount) {
    const step = Math.max(1, Math.ceil((dataMax - dataMin) / 8));
    const yMinC = Math.max(0, Math.floor(dataMin / step) * step - step);
    const yMaxC = Math.ceil(dataMax / step) * step + step;
    yDomain = [yMinC, yMaxC];
    yTickFormatter = v => String(v);
  } else {
    const yMin = Math.max(0, Math.floor(dataMin / 5) * 5 - 5);
    const yMax = Math.min(105, Math.ceil(dataMax / 5) * 5 + 10);
    yDomain = [yMin, yMax];
    yTickFormatter = v => v + "%";
  }

  // Tooltip
  const tooltipFormatter = (value, name, props) => {
    const m = metrics.find(m => m.label === name);
    if (isCount) {
      if (m) {
        const max = props.payload[m.key + "_max"] ?? "?";
        return [`${value} / ${max}`, name];
      }
      return [value, name];
    }
    if (m && chartData.length > 0) {
      const raw = props.payload[m.key + "_raw"] ?? "?";
      const max = props.payload[m.key + "_max"] ?? "?";
      return [`${value}%  (${raw} / ${max})`, name];
    }
    return [value + "%", name];
  };

  const showRefLine = !isCount && yDomain[1] >= 100;

  return (
    <div className="sys-chart-wrap">
      <div className="chart-top">
        <h2 className="chart-title">{system} PLC {isCount ? "보유 개수" : "달성률"} 추이</h2>
        <span className="chart-note">기획서 날짜별 {isCount ? "누적 보유 개수" : "누적 달성률 (%)"}</span>
      </div>

      {/* 뷰 모드 + 등급 토글 */}
      <div className="chart-controls">
        <div className="view-mode-toggles">
          <button className={"view-mode-btn" + (viewMode === "rate" ? " active" : "")}
            onClick={() => setViewMode("rate")}>달성률 %</button>
          <button className={"view-mode-btn" + (viewMode === "count" ? " active" : "")}
            onClick={() => setViewMode("count")}>개수</button>
        </div>
        <div className="metric-toggles">
          {metrics.map(m => (
            <button key={m.key}
              className={"metric-toggle" + (visible[m.key] ? " on" : " off")}
              style={visible[m.key] ? { borderColor: m.color, color: m.color } : {}}
              onClick={() => toggleMetric(m.key)}>
              <span className="metric-dot" style={{ background: visible[m.key] ? m.color : "#d1d5db" }} />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 52 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={68} interval={0} />
          <YAxis domain={yDomain} tickFormatter={yTickFormatter} tick={{ fontSize: 11 }} width={44} allowDataOverflow />
          {showRefLine && (
            <ReferenceLine y={100} stroke="#9ca3af" strokeDasharray="5 3"
              label={{ value: "PLC 100%", position: "insideTopRight", fill: "#9ca3af", fontSize: 10 }} />
          )}
          <Tooltip formatter={tooltipFormatter} contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
          {metrics.map(m => (
            <Line key={m.key} type="monotone" dataKey={getDataKey(m)} name={m.label}
              stroke={m.color} strokeWidth={visible[m.key] ? 2.5 : 0}
              strokeDasharray={m.strokeDasharray || undefined}
              dot={visible[m.key] ? { r: 4 } : false}
              activeDot={visible[m.key] ? { r: 6 } : false}
              hide={!visible[m.key]} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <SystemSummaryTable system={system} metrics={metrics} chartData={chartData} visible={visible} viewMode={viewMode} />
    </div>
  );
}

function SystemSummaryTable({ system, metrics, chartData, visible, viewMode }) {
  if (chartData.length === 0) return null;
  const shownMetrics = visible ? metrics.filter(m => visible[m.key]) : metrics;
  const isCount = viewMode === "count";
  return (
    <div className="summary-wrap">
      <h3 className="summary-title">{system} 날짜별 {isCount ? "보유 개수" : "달성률"}</h3>
      <div className="full-table-scroll">
        <table className="summary-table full-table">
          <thead>
            <tr>
              <th className="td-label">등급</th>
              {chartData.map(d => <th key={d.name} className="td-num">{d.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {shownMetrics.map(m => (
              <tr key={m.key}>
                <td className="td-label" style={{ color: m.color, fontWeight: 600 }}>{m.label}</td>
                {chartData.map((d, di) => {
                  const v = d[m.key] ?? 0;
                  const raw = d[m.key + "_raw"] ?? 0;
                  const max = d[m.key + "_max"] ?? 0;
                  if (isCount) {
                    const prevRaw = di > 0 ? (chartData[di - 1][m.key + "_raw"] ?? 0) : 0;
                    const delta = raw - prevRaw;
                    return (
                      <td key={d.name} className="td-num">
                        <span style={{ fontWeight: 600 }}>{raw}</span>
                        <span className="td-abs">/ {max}</span>
                        {delta > 0 && <span className="td-delta">+{(Math.round(delta * 100) / 100)}</span>}
                      </td>
                    );
                  }
                  const prev = di > 0 ? (chartData[di - 1][m.key] ?? 0) : 0;
                  const delta = v - prev;
                  const color = v >= 80 ? "#dc2626" : v >= 50 ? "#f97316" : "#16a34a";
                  return (
                    <td key={d.name} className="td-num">
                      <span style={{ color, fontWeight: 600 }}>{v}%</span>
                      <span className="td-abs">{raw}/{max}</span>
                      {delta > 0 && <span className="td-delta">+{delta.toFixed(1)}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// 전체 표 뷰
// ============================================================
function FullTable({ simResult, plcMax }) {
  const dates = simResult.map(r => r.date);
  return (
    <div className="sys-chart-wrap">
      <div className="chart-top">
        <h2 className="chart-title">전체 지표 달성률 표</h2>
        <span className="chart-note">날짜별 누적 PLC 달성률 (%)</span>
      </div>
      <div className="full-table-scroll">
        <table className="summary-table full-table">
          <thead>
            <tr>
              <th className="td-label" style={{ minWidth: 90 }}>지표</th>
              <th className="td-num" style={{ minWidth: 50 }}>PLC</th>
              {dates.map(d => <th key={d} className="td-num" style={{ minWidth: 80 }}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {TABLE_ROWS.map((row, i) => {
              if (row === null) {
                return <tr key={"sep" + i}><td colSpan={2 + dates.length} className="td-sep" /></tr>;
              }
              const max = row.plcPath.reduce((o, k) => o?.[k], plcMax);
              return (
                <tr key={row.label}>
                  <td className="td-label">{row.label}</td>
                  <td className="td-num">{max ?? "-"}</td>
                  {simResult.map(({ date, snapshot }, idx) => {
                    const v = getRate(row.getValue(snapshot), max);
                    const prev = idx > 0 ? getRate(row.getValue(simResult[idx - 1].snapshot), max) : 0;
                    const delta = v - prev;
                    const color = v >= 80 ? "#dc2626" : v >= 50 ? "#f97316" : "#16a34a";
                    return (
                      <td key={date} className="td-num">
                        {max ? <>
                          <span style={{ color, fontWeight: 600 }}>{v}%</span>
                          {delta > 0 && <span className="td-delta">+{delta.toFixed(1)}</span>}
                        </> : "-"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// 상품 분석 탭 (요청2)
// ============================================================
function PackageAnalysisTab({ data, salesDataMap, bmGroups, onSalesLoad, onSalesClear, onSalesClearAll }) {
  const fmtNum = (v) => v >= 0.01 ? v.toFixed(2) : v > 0 ? v.toFixed(4) : "0";
  const fmtWon = (v) => v ? Math.round(v).toLocaleString() : "-";
  const systems = ["클래스", "펫", "투혼", "카드"];
  const [expanded, setExpanded] = useState(() => new Set());
  const hasSalesAny = data.some(g => g.hasSales);
  const salesCount = Object.keys(salesDataMap).length;

  const togglePkg = (key) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // 전체 합계
  const grandTotal = { 클래스: 0, 펫: 0, 투혼: 0, 카드: 0 };
  let grandPrice = 0;
  let grandRevenue = 0;
  for (const group of data) {
    for (const sys of systems) grandTotal[sys] += group.godae[sys];
    grandPrice += group.totalPrice;
    if (group.totalRevenue) grandRevenue += group.totalRevenue;
  }

  // 매출 드롭존 핸들러 — 여러 파일을 각각 dateKey로 매칭
  const handleSalesDrop = async (files) => {
    const xlsxFiles = Array.from(files).filter(f => /\.xlsx?$/i.test(f.name));
    for (const file of xlsxFiles) {
      try {
        const { dateKey } = extractDateLabel(file.name);
        const result = await parseSalesExcel(file);

        onSalesLoad(dateKey, result);
      } catch (err) {
        console.error(`매출지표 파싱 오류 (${file.name}):`, err);
      }
    }
  };

  return (
    <div className="sys-chart-wrap analysis-tab">
      <div className="chart-top">
        <h2 className="chart-title">상품 분석 (고대 환산)</h2>
        <span className="chart-note">패키지 소환권의 기댓값을 고대 등가로 환산</span>
      </div>

      {/* 매출지표 업로드 영역 */}
      <SalesDropZone
        salesDataMap={salesDataMap}
        bmGroups={bmGroups}
        onDrop={handleSalesDrop}
        onClear={onSalesClear}
        onClearAll={onSalesClearAll}
      />

      {/* 전체 요약 */}
      <div className="analysis-grand">
        <div className="analysis-grand-title">전체 합계</div>
        <div className="analysis-grand-row">
          {systems.map(sys => (
            <div key={sys} className="analysis-grand-cell">
              <span className="analysis-sys-label">{sys}</span>
              <span className="analysis-sys-value">{fmtNum(grandTotal[sys])}</span>
              <span className="analysis-sys-unit">고대</span>
            </div>
          ))}
          <div className="analysis-grand-cell">
            <span className="analysis-sys-label">총 가격</span>
            <span className="analysis-sys-value">{grandPrice.toLocaleString()}</span>
            <span className="analysis-sys-unit">원</span>
          </div>
          {grandRevenue > 0 && (
            <div className="analysis-grand-cell">
              <span className="analysis-sys-label">총 매출</span>
              <span className="analysis-sys-value">{fmtWon(grandRevenue)}</span>
              <span className="analysis-sys-unit">원</span>
            </div>
          )}
        </div>
      </div>

      {/* 날짜별 그룹 */}
      {data.map((group, gi) => (
        <div key={gi} className="analysis-group">
          <div className="analysis-group-header">
            <span className="analysis-group-title">{group.label}</span>
            <span className="analysis-group-meta">
              {group.pkgCount}개 패키지 · {group.totalPrice.toLocaleString()}원
              {group.hasSales && group.totalRevenue > 0 && (
                <> · 매출 {fmtWon(group.totalRevenue)}원</>
              )}
              {group.hasSales && group.salesPeriod && (
                <span className="sales-period-badge"> ({group.salesPeriod})</span>
              )}
              {!group.hasSales && salesCount > 0 && <span className="sales-no-data"> (매출지표 미등록)</span>}
            </span>
          </div>
          <div className="analysis-group-summary">
            {systems.map(sys => (
              <span key={sys} className="analysis-chip">
                {sys} <strong>{fmtNum(group.godae[sys])}</strong>
              </span>
            ))}
          </div>
          <div className="full-table-scroll">
            <table className="summary-table full-table analysis-table">
              <thead>
                <tr>
                  <th className="td-label">패키지</th>
                  <th className="td-num">가격</th>
                  <th className="td-num">구매제한</th>
                  {systems.map(sys => <th key={sys} className="td-num">{sys}</th>)}
                  {group.hasSales && <>
                    <th className="td-num td-sales-h">매출</th>
                    <th className="td-num td-sales-h">구매유저</th>
                    <th className="td-num td-sales-h">구매횟수</th>
                  </>}
                </tr>
              </thead>
              <tbody>
                {group.pkgDetails.map((pkg, pi) => {
                  const key = gi + "_" + pi;
                  const isOpen = expanded.has(key);
                  const totalCols = 3 + systems.length + (group.hasSales ? 3 : 0);
                  return (
                    <Fragment key={key}>
                      <tr className={"pkg-row-clickable" + (isOpen ? " pkg-row-open" : "")}
                        onClick={() => togglePkg(key)}>
                        <td className="td-label td-pkg-name">
                          {isOpen ? <ChevronDown size={12} className="pkg-expand-icon" /> : <ChevronRight size={12} className="pkg-expand-icon" />}
                          {pkg.name}
                        </td>
                        <td className="td-num">{pkg.price ? pkg.price.toLocaleString() : "-"}</td>
                        <td className="td-num td-limit">{pkg.purchaseLimit || "-"}</td>
                        {systems.map(sys => (
                          <td key={sys} className="td-num">
                            <strong>{fmtNum(pkg.godae[sys])}</strong>
                          </td>
                        ))}
                        {group.hasSales && <>
                          <td className="td-num td-sales">{pkg.sales ? fmtWon(pkg.sales.revenue) : "-"}</td>
                          <td className="td-num td-sales">{pkg.sales ? Math.round(pkg.sales.buyers) : "-"}</td>
                          <td className="td-num td-sales">{pkg.sales ? Math.round(pkg.sales.purchases) : "-"}</td>
                        </>}
                      </tr>
                      {isOpen && (pkg.rawItems || pkg.items || []).map((item, ii) => (
                        <tr key={pi + "_item_" + ii} className="pkg-item-row">
                          <td className="td-label td-item-name">{item.name}</td>
                          <td className="td-num td-item-qty">{item.quantity}개</td>
                          <td colSpan={totalCols - 2} className="td-num td-item-spacer"></td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
                <tr className="analysis-subtotal">
                  <td className="td-label"><strong>소계</strong></td>
                  <td className="td-num"><strong>{group.totalPrice.toLocaleString()}</strong></td>
                  <td className="td-num"></td>
                  {systems.map(sys => (
                    <td key={sys} className="td-num">
                      <strong>{fmtNum(group.godae[sys])}</strong>
                    </td>
                  ))}
                  {group.hasSales && <>
                    <td className="td-num td-sales"><strong>{fmtWon(group.totalRevenue)}</strong></td>
                    <td className="td-num"></td>
                    <td className="td-num"></td>
                  </>}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// 매출지표 드롭존 — 여러 파일 지원, 기획서별 1:1 매칭
function SalesDropZone({ salesDataMap, bmGroups, onDrop, onClear, onClearAll }) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const salesCount = Object.keys(salesDataMap).length;

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    onDrop(e.dataTransfer.files);
  };

  return (
    <div className="sales-drop-area">
      <div
        className={"sales-drop-zone" + (dragging ? " dragging" : "")}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <Upload size={14} />
        <span>{dragging ? "여기에 놓으세요" : "매출지표 Excel 드롭 (파일명 = 기획서명, 여러 파일 가능)"}</span>
      </div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" multiple style={{ display: 'none' }}
        onChange={e => { onDrop(e.target.files); e.target.value = ''; }} />
      {salesCount > 0 && (
        <div className="sales-loaded-list">
          <div className="sales-loaded-header">
            <span className="sales-loaded-label">매출지표 {salesCount}건 로드됨</span>
            <button className="sales-clear-btn" onClick={onClearAll}><Trash2 size={11} /> 전체 초기화</button>
          </div>
          {Object.entries(salesDataMap).map(([dk, sd]) => {
            const matchedGroup = bmGroups.find(g => g.dateKey === dk);
            return (
              <div key={dk} className="sales-loaded-item">
                <span className="sales-loaded-dk">{matchedGroup ? matchedGroup.label : dk}</span>
                <span className="sales-loaded-period">{sd.periodLabel}</span>
                <span className="sales-loaded-count">{sd.items.size}개 아이템</span>
                <button className="sales-item-clear-btn" onClick={() => onClear(dk)}><Trash2 size={10} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 유저 스펙 패널 (요청1: 저장/불러오기)
// ============================================================
function SpecPanel({ userSpec, setUserSpec }) {
  const [presets, setPresets] = useState(() => loadPresets());
  const [presetName, setPresetName] = useState("");
  const [showSave, setShowSave] = useState(false);

  const update = (sys, key, val) =>
    setUserSpec(prev => ({ ...prev, [sys]: { ...prev[sys], [key]: parseInt(val) || 0 } }));

  const handleSave = () => {
    if (!presetName.trim()) return;
    const next = [...presets.filter(p => p.name !== presetName.trim()),
      { name: presetName.trim(), spec: JSON.parse(JSON.stringify(userSpec)), savedAt: Date.now() }];
    setPresets(next);
    savePresets(next);
    setPresetName("");
    setShowSave(false);
  };

  const handleLoad = (preset) => {
    setUserSpec(JSON.parse(JSON.stringify(preset.spec)));
  };

  const handleDelete = (name) => {
    const next = presets.filter(p => p.name !== name);
    setPresets(next);
    savePresets(next);
  };

  // 투혼 불멸 개수 변경 시 레벨 배열 자동 조정
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

  const updateLevel = (sys, levelKey, index, val) => {
    const lv = Math.min(5, Math.max(0, parseInt(val) || 0));
    setUserSpec(prev => {
      const arr = [...(prev[sys]?.[levelKey] || [])];
      arr[index] = lv;
      return { ...prev, [sys]: { ...prev[sys], [levelKey]: arr } };
    });
  };

  const sections = [
    { sys: "클래스", label: "클래스", keys: ["영웅", "고대", "전설", "불멸"], unit: "개" },
    { sys: "클래스", label: "클래스 각성", keys: ["영웅각성", "고대각성", "전설각성"], unit: "pt",
      keyLabels: { "영웅각성": "영웅", "고대각성": "고대", "전설각성": "전설" } },
    { sys: "펫",    label: "펫",    keys: ["영웅", "고대", "전설", "불멸"], unit: "개" },
    { sys: "펫",    label: "펫 각성", keys: ["영웅각성", "고대각성", "전설각성"], unit: "pt",
      keyLabels: { "영웅각성": "영웅", "고대각성": "고대", "전설각성": "전설" } },
    { sys: "투혼",  label: "투혼",  keys: ["영웅", "고대", "전설", "불멸"], unit: "개" },
    { sys: "카드",  label: "카드",  keys: ["전설", "고대"],                   unit: "개" },
  ];

  // 레벨 입력이 필요한 키 설정: { sys, countKey, levelKey }
  const levelConfigs = [
    { sys: "투혼", countKey: "불멸", levelKey: "불멸레벨", label: "불멸" },
    { sys: "카드", countKey: "전설", levelKey: "전설레벨", label: "전설" },
  ];

  return (
    <div className="spec-panel">
      {/* 프리셋 영역 */}
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

// ============================================================
// Excel 드래그앤드롭
// ============================================================
function ExcelDropZone({ onLoad }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);

  const processFiles = async (files) => {
    const xlsxFiles = Array.from(files).filter(f => /\.xlsx?$/i.test(f.name));
    if (xlsxFiles.length === 0) {
      setMessage({ type: 'error', text: '.xlsx 파일만 지원합니다.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    let loaded = 0;
    for (const file of xlsxFiles) {
      try {
        const { dateKey, label } = extractDateLabel(file.name);
        const packages = await parseExcelFile(file);
        onLoad({ dateKey, label, packages });
        loaded++;
      } catch (err) {
        setMessage({ type: 'error', text: `${file.name}: ${err.message}` });
      }
    }
    setLoading(false);
    if (loaded > 0) {
      setMessage({ type: 'ok', text: `${loaded}개 기획서 로드 완료` });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div
        className={"drop-zone" + (dragging ? " dragging" : "") + (loading ? " loading" : "")}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !loading && fileInputRef.current?.click()}
      >
        <Upload size={20} className="drop-icon" />
        <span className="drop-text">
          {loading ? "파싱 중..." : dragging ? "여기에 놓으세요" : "기획서 Excel 파일을 드롭하거나 클릭"}
        </span>
        <span className="drop-hint">0311BM.xlsx 형식 · 여러 파일 동시 가능</span>
      </div>
      {message && (
        <div className={"drop-msg" + (message.type === 'error' ? " drop-msg-error" : " drop-msg-ok")}>
          {message.text}
        </div>
      )}
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" multiple style={{ display: 'none' }}
        onChange={e => { processFiles(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

// ============================================================
// 기획서 그룹 패널
// ============================================================
function BmGroupsPanel({ bmGroups, setBmGroups, expandedGroups, toggleGroup, onExcelLoad }) {
  const addGroup = () => {
    const id = "bm_new_" + (++bmGroupIdCounter);
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    setBmGroups(prev => [...prev, {
      id, dateKey: `${mm}${dd}`,
      label: `${parseInt(mm)}월 ${parseInt(dd)}일 기획서`,
      packages: [],
    }]);
  };
  const removeGroup = id => setBmGroups(prev => prev.filter(g => g.id !== id));
  const updateGroup = (id, fn) => setBmGroups(prev => prev.map(g => g.id === id ? fn(g) : g));

  return (
    <div className="pkg-list">
      <ExcelDropZone onLoad={onExcelLoad} />
      <div className="bm-divider">또는 직접 입력</div>
      {bmGroups.map((group, idx) => (
        <BmGroupCard key={group.id} group={group} index={idx + 1}
          isExpanded={expandedGroups.has(group.id)}
          onToggle={() => toggleGroup(group.id)}
          onRemove={() => removeGroup(group.id)}
          onUpdate={fn => updateGroup(group.id, fn)} />
      ))}
      <button className="add-pkg-btn" onClick={addGroup}>
        <Plus size={13} /> 기획서 날짜 추가
      </button>
    </div>
  );
}

function BmGroupCard({ group, index, isExpanded, onToggle, onRemove, onUpdate }) {
  const addPackage = () => {
    const id = "pkg_" + (++pkgIdCounter);
    onUpdate(g => ({ ...g, packages: [...g.packages, { id, name: "새 패키지", price: null, items: [] }] }));
  };
  const removePackage = pkgId =>
    onUpdate(g => ({ ...g, packages: g.packages.filter(p => p.id !== pkgId) }));
  const updatePackage = (pkgId, fn) =>
    onUpdate(g => ({ ...g, packages: g.packages.map(p => p.id === pkgId ? fn(p) : p) }));

  return (
    <div className="bm-group-card">
      <div className="bm-group-header" onClick={onToggle}>
        <div className="pkg-header-left">
          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <Calendar size={12} className="bm-calendar-icon" />
          <input className="pkg-name-input" value={group.label}
            onChange={e => { e.stopPropagation(); onUpdate(g => ({ ...g, label: e.target.value })); }}
            onClick={e => e.stopPropagation()} />
        </div>
        <div className="pkg-header-right">
          <span className="pkg-meta">{group.packages.length}개 패키지</span>
          <button className="icon-btn" onClick={e => { e.stopPropagation(); onRemove(); }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="bm-group-body">
          {group.packages.map((pkg, i) => (
            <PackageCard key={pkg.id} pkg={pkg} index={i + 1}
              onRemove={() => removePackage(pkg.id)}
              onUpdate={fn => updatePackage(pkg.id, fn)} />
          ))}
          <button className="add-item-btn" onClick={addPackage} style={{ marginTop: 4 }}>
            <Plus size={11} /> 패키지 추가
          </button>
        </div>
      )}
    </div>
  );
}

function PackageCard({ pkg, index, onRemove, onUpdate }) {
  const addItem = () =>
    onUpdate(p => ({ ...p, items: [...p.items, { name: "찬란한 클래스 11회", quantity: 1 }] }));
  const removeItem = i =>
    onUpdate(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, value) =>
    onUpdate(p => ({ ...p, items: p.items.map((it, idx) => idx === i ? { ...it, [field]: value } : it) }));
  const totalQty = pkg.items.reduce((s, it) => s + (it.quantity || 0), 0);

  return (
    <div className="pkg-card">
      <div className="pkg-card-header">
        <div className="pkg-header-left">
          <span className="pkg-index">{index}</span>
          <input className="pkg-name-input" value={pkg.name}
            onChange={e => onUpdate(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="pkg-header-right">
          <span className="pkg-meta">{pkg.items.length}종 · {totalQty}장</span>
          {pkg.price && <span className="pkg-price">{Number(pkg.price).toLocaleString()}원</span>}
          <button className="icon-btn" onClick={onRemove}><Trash2 size={12} /></button>
        </div>
      </div>
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
    </div>
  );
}

// ============================================================
// PLC 패널
// ============================================================
function PlcPanel({ plcMax, setPlcMax }) {
  const update = (sys, key, val) =>
    setPlcMax(prev => ({ ...prev, [sys]: { ...prev[sys], [key]: parseFloat(val) || 0 } }));
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
