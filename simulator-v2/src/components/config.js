/**
 * config.js - Shared constants for the simulator UI
 * All display-related constants, metric definitions, and default values.
 */

export const STORAGE_KEY_PRESETS = "bm_sim_user_presets";
export const STORAGE_KEY_BM_GROUPS = "bm_sim_bm_groups_v2";

/** PLC maximum values per system/grade */
export const DEFAULT_PLC_MAX = {
  클래스: { 불멸: 11, 전설: 29, 고대: 52, 영웅: 130, 영웅각성: 19, 고대각성: 22, 전설각성: 30 },
  펫:    { 불멸: 6, 전설: 15, 고대: 25, 영웅: 58, 영웅각성: 22, 고대각성: 12, 전설각성: 7 },
  투혼:  { 불멸: 2, 전설: 8, 고대: 14 },
  카드:  { 전설: 3, 고대: 11 },
};

/** Default user spec (starting inventory) */
export const DEFAULT_USER_SPEC = {
  클래스: { 영웅: 0, 고대: 0, 전설: 0, 불멸: 0, 영웅각성: 0, 고대각성: 0, 전설각성: 0 },
  펫:    { 영웅: 0, 고대: 0, 전설: 0, 불멸: 0, 영웅각성: 0, 고대각성: 0, 전설각성: 0 },
  투혼:  { 영웅: 0, 고대: 0, 전설: 0, 불멸: 0, 불멸레벨: [] },
  카드:  { 전설: 0, 고대: 0, 전설레벨: [] },
};

/** Chart metric definitions per system (used for LineChart and summary tables) */
export const SYSTEM_METRICS = {
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

/** Rows for the full table view (null = separator row) */
export const TABLE_ROWS = [
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

/**
 * Calculate rate percentage from value and max.
 * Caps at 100%, rounds to 1 decimal place.
 */
export function getRate(value, max) {
  if (!max) return 0;
  return Math.min(100, Math.round((value / max) * 1000) / 10);
}

/**
 * Group flat package array by date prefix [MMDD].
 * Returns array of { id, dateKey, label, packages }.
 */
export function groupPackagesByDate(packages) {
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

/**
 * Normalize package name for sales matching.
 * Strips [MMDD] prefix and (...) suffix.
 */
export function normalizeName(name) {
  return name.replace(/^\[\d{4}\]\s*/, '').replace(/\s*\(.*?\)\s*$/, '').trim();
}

/** localStorage preset helpers */
export function loadPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRESETS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function savePresets(presets) {
  localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
}

/** Mutable ID counters for dynamic group/package creation */
export let bmGroupIdCounter = 1000;
export function nextBmGroupId() { return ++bmGroupIdCounter; }

export let pkgIdCounter = 2000;
export function nextPkgId() { return ++pkgIdCounter; }
