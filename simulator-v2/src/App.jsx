/**
 * App.jsx - Thin orchestrator for the BM Simulator.
 * Manages global state and renders the layout shell.
 * All heavy rendering is delegated to child components.
 */
import { useState, useCallback, useMemo, useEffect } from "react";
import { Play } from "lucide-react";
import { runSimulation, createInventory } from "./engine/simulator";
import { parsePackageItems } from "./engine/packageParser";
import { calcGodaeEquivalent } from "./utils/expectedValue";
import { DEFAULT_PACKAGES, DEFAULT_SALES_DATA } from "./data/packages";

import {
  DEFAULT_PLC_MAX, DEFAULT_USER_SPEC, SYSTEM_METRICS, STORAGE_KEY_BM_GROUPS,
  groupPackagesByDate, getRate, normalizeName, nextBmGroupId,
} from "./components/config";

import SpecPanel from "./components/SpecPanel";
import BmGroupsPanel from "./components/BmGroupsPanel";
import PlcPanel from "./components/PlcPanel";
import SystemChart from "./components/SystemChart";
import FullTable from "./components/FullTable";
import AnalysisTab from "./components/AnalysisTab";

import "./App.css";

/**
 * Convert a user spec object into a simulator-compatible inventory.
 */
function createInventoryFromSpec(spec) {
  const inv = createInventory();
  for (const grade of ["영웅", "고대", "전설", "불멸"]) {
    inv.클래스[grade] = spec.클래스?.[grade] || 0;
    inv.펫[grade] = spec.펫?.[grade] || 0;
  }
  if (!inv.투혼.enhanced) inv.투혼.enhanced = {};
  for (const grade of ["영웅", "고대", "전설"]) {
    inv.투혼.gradeCount[grade] = spec.투혼?.[grade] || 0;
  }
  inv.투혼.enhanced["불멸"] = spec.투혼?.불멸 || 0;
  inv.투혼.existingLevels = spec.투혼?.불멸레벨 || [];
  inv.카드.gradeCount["전설"] = spec.카드?.전설 || 0;
  inv.카드.gradeCount["고대"] = spec.카드?.고대 || 0;
  inv.카드.existingLevels = { 전설: spec.카드?.전설레벨 || [] };
  for (const grade of ["영웅", "고대", "전설"]) {
    inv.awakening.클래스[grade] = spec.클래스?.[grade + "각성"] || 0;
    inv.awakening.펫[grade] = spec.펫?.[grade + "각성"] || 0;
  }
  return inv;
}

export default function App() {
  // --- State ---
  const [bmGroups, setBmGroups] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BM_GROUPS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return groupPackagesByDate(DEFAULT_PACKAGES);
  });
  const [plcMax, setPlcMax] = useState(DEFAULT_PLC_MAX);
  const [userSpec, setUserSpec] = useState(DEFAULT_USER_SPEC);
  const [simResult, setSimResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activePanel, setActivePanel] = useState("spec");
  const [activeChart, setActiveChart] = useState("상품 분석");
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const [salesDataMap, setSalesDataMap] = useState(() => {
    // Preload sales data: convert plain objects back to Map format for compatibility
    const map = {};
    for (const [dateKey, data] of Object.entries(DEFAULT_SALES_DATA || {})) {
      map[dateKey] = {
        periodLabel: data.periodLabel,
        items: new Map(Object.entries(data.items)),
      };
    }
    return map;
  });

  // Persist bmGroups to localStorage
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_BM_GROUPS, JSON.stringify(bmGroups)); }
    catch { /* ignore quota errors */ }
  }, [bmGroups]);

  // --- Callbacks ---
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
      const id = "bm_xl_" + nextBmGroupId();
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
      const result = runSimulation(pkgsForSim, startInv, plcMax);
      setSimResult(result);
    } finally {
      setIsRunning(false);
    }
  }, [bmGroups, userSpec, plcMax]);

  // Chart data for the currently selected system tab
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

  // Sales handlers
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

  // Analysis data (no simulation needed)
  const analysisData = useMemo(() => {
    const sorted = [...bmGroups].sort((a, b) => (b.dateKey || "").localeCompare(a.dateKey || ""));
    return sorted.map(group => {
      const allItems = group.packages
        .filter(p => p.items.length > 0)
        .flatMap(p => parsePackageItems(p.items));
      const godae = calcGodaeEquivalent(allItems);
      const totalPrice = group.packages.reduce((s, p) => s + (p.price || 0), 0);
      const groupSales = salesDataMap[group.dateKey] || null;
      const hasSales = !!groupSales;
      const pkgDetails = group.packages.map(pkg => {
        const items = parsePackageItems(pkg.items);
        const baseName = normalizeName(pkg.name);
        let sales = null;
        if (hasSales) {
          sales = groupSales.items.get(baseName) || null;
          if (!sales) {
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

  // --- Render ---
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <h1 className="app-title">캐릭터 성장 시뮬레이터</h1>
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="panel-tabs">
            {[
              { key: "spec", label: "유저 스펙" },
              { key: "bm", label: "기획서" },
              { key: "plc", label: "PLC" },
            ].map(tab => (
              <button key={tab.key}
                className={"panel-tab" + (activePanel === tab.key ? " active" : "")}
                onClick={() => setActivePanel(tab.key)}>
                {tab.label}
              </button>
            ))}
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
            <span className="pkg-count-label">{bmGroups.length}개 기획서 &middot; {totalPkgCount}개 패키지</span>
            <button className="run-btn" onClick={runSim}
              disabled={isRunning || totalPkgCount === 0}>
              <Play size={14} />
              {isRunning ? "시뮬레이션 중..." : "시뮬레이션 실행"}
            </button>
          </div>
        </aside>

        {/* Main content area */}
        <main className="main-area">
          <div className="chart-section">
            {/* System tabs */}
            <div className="chart-sys-tabs">
              {CHART_TABS.map(tab => (
                <button key={tab}
                  className={"chart-sys-tab" + (activeChart === tab ? " active" : "")}
                  onClick={() => setActiveChart(tab)}>
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeChart === "상품 분석" ? (
              <AnalysisTab
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
