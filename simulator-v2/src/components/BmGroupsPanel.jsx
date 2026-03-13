/**
 * BmGroupsPanel.jsx - BM group management panel with expand/collapse.
 * Contains ExcelDropZone for file upload and inline BmGroupCard/PackageCard editing.
 */
import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Calendar } from "lucide-react";
import { AVAILABLE_ITEMS } from "../data/packages";
import { nextBmGroupId, nextPkgId } from "./config";
import ExcelDropZone from "./ExcelDropZone";

export default function BmGroupsPanel({ bmGroups, setBmGroups, expandedGroups, toggleGroup, onExcelLoad }) {
  /** Add a new empty date group (today's date) */
  const addGroup = () => {
    const id = "bm_new_" + nextBmGroupId();
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

/** A single BM group card with header and expandable package list */
function BmGroupCard({ group, index, isExpanded, onToggle, onRemove, onUpdate }) {
  const addPackage = () => {
    const id = "pkg_" + nextPkgId();
    onUpdate(g => ({ ...g, packages: [...g.packages, { id, name: "새 패키지", price: null, items: [] }] }));
  };
  const removePackage = pkgId =>
    onUpdate(g => ({ ...g, packages: g.packages.filter(p => p.id !== pkgId) }));
  const updatePackage = (pkgId, fn) =>
    onUpdate(g => ({ ...g, packages: g.packages.map(p => p.id === pkgId ? fn(p) : p) }));
  const toggleExclude = pkgId =>
    onUpdate(g => ({ ...g, packages: g.packages.map(p => p.id === pkgId ? { ...p, excluded: !p.excluded } : p) }));
  const allExcluded = group.packages.length > 0 && group.packages.every(p => p.excluded);
  const toggleAll = () =>
    onUpdate(g => ({ ...g, packages: g.packages.map(p => ({ ...p, excluded: !allExcluded ? true : false })) }));

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
          <label className="group-select-all" onClick={e => e.stopPropagation()}>
            <input type="checkbox" checked={!allExcluded} onChange={toggleAll} />
            <span className="group-select-label">전체</span>
          </label>
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
              onUpdate={fn => updatePackage(pkg.id, fn)}
              onToggleExclude={() => toggleExclude(pkg.id)} />
          ))}
          <button className="add-item-btn" onClick={addPackage} style={{ marginTop: 4 }}>
            <Plus size={11} /> 패키지 추가
          </button>
        </div>
      )}
    </div>
  );
}

/** Individual package card with item rows */
function PackageCard({ pkg, index, onRemove, onUpdate, onToggleExclude }) {
  const addItem = () =>
    onUpdate(p => ({ ...p, items: [...p.items, { name: "찬란한 클래스 11회", quantity: 1 }] }));
  const removeItem = i =>
    onUpdate(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, value) =>
    onUpdate(p => ({ ...p, items: p.items.map((it, idx) => idx === i ? { ...it, [field]: value } : it) }));
  const totalQty = pkg.items.reduce((s, it) => s + (it.quantity || 0), 0);

  const isExcluded = !!pkg.excluded;

  return (
    <div className={"pkg-card" + (isExcluded ? " pkg-excluded" : "")}>
      <div className="pkg-card-header">
        <div className="pkg-header-left">
          <input type="checkbox" className="pkg-checkbox" checked={!isExcluded}
            onChange={onToggleExclude} title={isExcluded ? "시뮬레이션에 포함" : "시뮬레이션에서 제외"} />
          <span className="pkg-index">{index}</span>
          <input className="pkg-name-input" value={pkg.name}
            onChange={e => onUpdate(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="pkg-header-right">
          <span className="pkg-meta">{pkg.items.length}종 &middot; {totalQty}장</span>
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
