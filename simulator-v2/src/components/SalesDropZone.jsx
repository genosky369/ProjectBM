/**
 * SalesDropZone.jsx - Sales data file upload zone.
 * Supports multiple file upload, each matched by dateKey to a BM group.
 * Always visible in the analysis tab.
 */
import { useState, useRef } from "react";
import { Upload, Trash2 } from "lucide-react";

export default function SalesDropZone({ salesDataMap, bmGroups, onDrop, onClear, onClearAll }) {
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
