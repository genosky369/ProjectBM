/**
 * SystemChart.jsx - Recharts LineChart per system with summary table below.
 * Supports rate% / count toggle and metric visibility toggle.
 * Awakening lines use dashed strokes (strokeDasharray="6 3").
 */
import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

export default function SystemChart({ system, chartData, metrics }) {
  const [visible, setVisible] = useState(() =>
    Object.fromEntries(metrics.map(m => [m.key, true]))
  );
  const [viewMode, setViewMode] = useState("rate"); // "rate" | "count"

  const toggleMetric = (key) =>
    setVisible(prev => ({ ...prev, [key]: !prev[key] }));

  const visibleMetrics = metrics.filter(m => visible[m.key]);
  const isCount = viewMode === "count";

  /** Data key depends on view mode */
  const getDataKey = (m) => isCount ? m.key + "_raw" : m.key;

  // Y-axis auto scale based on visible metrics
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

  /** Tooltip shows raw/max alongside the value */
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

      {/* View mode + metric visibility toggles */}
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

      {/* Summary table below chart */}
      <SystemSummaryTable system={system} metrics={metrics} chartData={chartData} visible={visible} viewMode={viewMode} />
    </div>
  );
}

/** Summary table showing date-by-date values for each visible metric */
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
