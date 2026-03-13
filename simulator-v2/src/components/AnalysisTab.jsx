/**
 * AnalysisTab.jsx - Package analysis tab with godae conversion and sales matching.
 * Shows grand total, per-date-group breakdowns, and per-package expandable details.
 */
import { useState, Fragment } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { extractDateLabel, parseSalesExcel } from "../utils/excelParser";
import { normalizeName } from "./config";
import SalesDropZone from "./SalesDropZone";

/** Format a numeric value to 2 or 4 decimal places */
const fmtNum = (v) => v >= 0.01 ? v.toFixed(2) : v > 0 ? v.toFixed(4) : "0";
/** Format a won value with thousands separators */
const fmtWon = (v) => v ? Math.round(v).toLocaleString() : "-";
/** System names used across the analysis */
const SYSTEMS = ["클래스", "펫", "투혼", "카드"];

export default function AnalysisTab({ data, salesDataMap, bmGroups, onSalesLoad, onSalesClear, onSalesClearAll }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const hasSalesAny = data.some(g => g.hasSales);
  const salesCount = Object.keys(salesDataMap).length;

  const togglePkg = (key) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Grand totals across all groups
  const grandTotal = { 클래스: 0, 펫: 0, 투혼: 0, 카드: 0 };
  let grandPrice = 0;
  let grandRevenue = 0;
  for (const group of data) {
    for (const sys of SYSTEMS) grandTotal[sys] += group.godae[sys];
    grandPrice += group.totalPrice;
    if (group.totalRevenue) grandRevenue += group.totalRevenue;
  }

  // Monthly aggregation from dateKey (MMDD → MM)
  const monthlyMap = {};
  for (const group of data) {
    const mm = group.dateKey && group.dateKey !== "기타" ? group.dateKey.slice(0, 2) : null;
    if (!mm) continue;
    if (!monthlyMap[mm]) monthlyMap[mm] = { 클래스: 0, 펫: 0, 투혼: 0, 카드: 0, price: 0 };
    for (const sys of SYSTEMS) monthlyMap[mm][sys] += group.godae[sys];
    monthlyMap[mm].price += group.totalPrice;
  }
  const monthlyData = Object.entries(monthlyMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([mm, vals]) => ({ month: `${parseInt(mm)}월`, ...vals }));
  // Find max value for bar scaling
  const monthlyMax = {};
  for (const sys of SYSTEMS) {
    monthlyMax[sys] = Math.max(...monthlyData.map(d => d[sys]), 0.01);
  }

  /** Handle sales file drops - each file matched to a dateKey */
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

      {/* Sales data upload area */}
      <SalesDropZone
        salesDataMap={salesDataMap}
        bmGroups={bmGroups}
        onDrop={handleSalesDrop}
        onClear={onSalesClear}
        onClearAll={onSalesClearAll}
      />

      {/* Grand total summary */}
      <div className="analysis-grand">
        <div className="analysis-grand-title">전체 합계</div>
        <div className="analysis-grand-row">
          {SYSTEMS.map(sys => (
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
        </div>
      </div>

      {/* Monthly breakdown chart */}
      {monthlyData.length > 1 && (
        <div className="analysis-monthly">
          <div className="analysis-grand-title">월간 비교</div>
          <div className="monthly-chart">
            {SYSTEMS.map(sys => (
              <div key={sys} className="monthly-sys-block">
                <div className="monthly-sys-title">{sys} <span className="monthly-sys-unit">(고대 환산)</span></div>
                {monthlyData.map(d => (
                  <div key={d.month} className="monthly-bar-row">
                    <span className="monthly-bar-label">{d.month}</span>
                    <div className="monthly-bar-track">
                      <div
                        className={`monthly-bar-fill monthly-bar-${sys}`}
                        style={{ width: `${Math.max((d[sys] / monthlyMax[sys]) * 100, 2)}%` }}
                      />
                    </div>
                    <span className="monthly-bar-value">{fmtNum(d[sys])}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="monthly-sys-block">
              <div className="monthly-sys-title">총 가격</div>
              {monthlyData.map(d => {
                const maxP = Math.max(...monthlyData.map(m => m.price), 1);
                return (
                  <div key={d.month} className="monthly-bar-row">
                    <span className="monthly-bar-label">{d.month}</span>
                    <div className="monthly-bar-track">
                      <div
                        className="monthly-bar-fill monthly-bar-price"
                        style={{ width: `${Math.max((d.price / maxP) * 100, 2)}%` }}
                      />
                    </div>
                    <span className="monthly-bar-value">{d.price.toLocaleString()}원</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Per-date-group breakdown */}
      {data.map((group, gi) => (
        <div key={gi} className="analysis-group">
          <div className="analysis-group-header">
            <span className="analysis-group-title">{group.label}</span>
            <span className="analysis-group-meta">
              {group.pkgCount}개 패키지 &middot; {group.totalPrice.toLocaleString()}원
              {group.hasSales && group.totalRevenue > 0 && (
                <> &middot; 매출 {fmtWon(group.totalRevenue)}원</>
              )}
              {group.hasSales && group.salesPeriod && (
                <span className="sales-period-badge"> ({group.salesPeriod})</span>
              )}
              {!group.hasSales && salesCount > 0 && <span className="sales-no-data"> (매출지표 미등록)</span>}
            </span>
          </div>
          <div className="analysis-group-summary">
            {SYSTEMS.map(sys => (
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
                  {SYSTEMS.map(sys => <th key={sys} className="td-num">{sys}</th>)}
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
                  const totalCols = 3 + SYSTEMS.length + (group.hasSales ? 3 : 0);
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
                        {SYSTEMS.map(sys => (
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
                  {SYSTEMS.map(sys => (
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
