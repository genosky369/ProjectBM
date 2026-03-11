/**
 * FullTable.jsx - Complete metrics table view showing all systems at once.
 * Displays PLC max, date-by-date rate%, and delta changes.
 */
import { TABLE_ROWS, getRate } from "./config";

export default function FullTable({ simResult, plcMax }) {
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
