/**
 * ExcelDropZone.jsx - BM file upload with drag & drop support.
 * Parses Excel files and calls onLoad with { dateKey, label, packages }.
 */
import { useState, useRef } from "react";
import { Upload } from "lucide-react";
import { parseExcelFile, extractDateLabel } from "../utils/excelParser";

export default function ExcelDropZone({ onLoad }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);

  /** Process one or more dropped/selected files */
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
        <span className="drop-hint">0311BM.xlsx 형식 &middot; 여러 파일 동시 가능</span>
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
