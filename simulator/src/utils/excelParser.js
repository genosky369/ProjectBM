// ============================================================
// excelParser.js
// 브라우저에서 Excel(.xlsx) 파일을 직접 파싱해 패키지 데이터 추출
// gen_packages.py의 로직을 JS로 이식
// ============================================================

import * as XLSX from 'xlsx';

// 시뮬레이터 아이템 매핑 (substring 매칭, 긴 패턴 우선)
const SIMULATOR_ITEMS = [
  // 11회 소환권 - 클래스
  ['찬란한 클래스 11회',  '찬란한 클래스 11회'],
  ['신비로운 클래스 11회','신비로운 클래스 11회'],
  ['눈부신 클래스 11회',  '눈부신 클래스 11회'],
  ['영롱한 클래스 11회',  '영롱한 클래스 11회'],
  // 11회 소환권 - 펫
  ['찬란한 펫 11회',  '찬란한 펫 11회'],
  ['신비로운 펫 11회','신비로운 펫 11회'],
  ['눈부신 펫 11회',  '눈부신 펫 11회'],
  ['영롱한 펫 11회',  '영롱한 펫 11회'],
  // 11회 소환권 - 투혼
  ['찬란한 투혼 11회',  '찬란한 투혼 11회'],
  ['신비로운 투혼 11회','신비로운 투혼 11회'],
  ['눈부신 투혼 11회',  '눈부신 투혼 11회'],
  ['영롱한 투혼 11회',  '영롱한 투혼 11회'],
  // 11회 소환권 - 카드
  ['찬란한 카드 11회',  '찬란한 카드 11회'],
  ['신비로운 카드 11회','신비로운 카드 11회'],
  ['눈부신 카드 11회',  '눈부신 카드 11회'],
  // 도전 소환권 - 클래스
  ['영웅 클래스 도전','영웅 클래스 도전'],
  ['고대 클래스 도전','고대 클래스 도전'],
  ['전설 클래스 도전','전설 클래스 도전'],
  // 도전 소환권 - 펫
  ['영웅 펫 도전','영웅 펫 도전'],
  ['고대 펫 도전','고대 펫 도전'],
  ['전설 펫 도전','전설 펫 도전'],
  // 도전 소환권 - 투혼
  ['영웅 투혼 도전','영웅 투혼 도전'],
  ['고대 투혼 도전','고대 투혼 도전'],
  ['전설 투혼 도전','전설 투혼 도전'],
  // 도전 소환권 - 카드
  ['영웅 카드 도전','영웅 카드 도전'],
  ['고대 카드 도전','고대 카드 도전'],
  ['전설 카드 도전','전설 카드 도전'],
  // 확정 소환권 - 클래스
  ['영웅 클래스 확정','영웅 클래스 확정'],
  ['고대 클래스 확정','고대 클래스 확정'],
  ['전설 클래스 확정','전설 클래스 확정'],
  // 확정 소환권 - 펫
  ['영웅 펫 확정','영웅 펫 확정'],
  ['고대 펫 확정','고대 펫 확정'],
  ['전설 펫 확정','전설 펫 확정'],
  // 확정 소환권 - 투혼
  ['영웅 투혼 확정','영웅 투혼 확정'],
  ['고대 투혼 확정','고대 투혼 확정'],
  ['전설 투혼 확정','전설 투혼 확정'],
  // 확정 소환권 - 카드
  ['영웅 카드 확정','영웅 카드 확정'],
  ['고대 카드 확정','고대 카드 확정'],
  ['전설 카드 확정','전설 카드 확정'],
  // 보물사냥꾼
  ['미숙한 보물사냥꾼','미숙한 보물사냥꾼'],
  ['숙달된 보물사냥꾼','숙달된 보물사냥꾼'],
  ['능숙한 보물사냥꾼','능숙한 보물사냥꾼'],
  ['노련한 보물사냥꾼','노련한 보물사냥꾼'],
  ['대단한 보물사냥꾼','대단한 보물사냥꾼'],
  ['완벽한 보물사냥꾼','완벽한 보물사냥꾼'],
  // 각성자 (클래스)
  ['노련한 각성자','노련한 각성자'],
  ['대단한 각성자','대단한 각성자'],
  ['완벽한 각성자','완벽한 각성자'],
  // 동반자 (펫)
  ['노련한 동반자','노련한 동반자'],
  ['대단한 동반자','대단한 동반자'],
  ['완벽한 동반자','완벽한 동반자'],
];

function matchItem(rawName) {
  if (!rawName) return null;
  const s = String(rawName);
  for (const [keyword, simName] of SIMULATOR_ITEMS) {
    if (s.includes(keyword)) return simName;
  }
  return null;
}

function isGarbagePkg(name) {
  if (!name) return true;
  const n = String(name).trim();
  return n === '패키지 명' || n.startsWith('PackageBox_') || n === '천사의 미소';
}

/**
 * File 객체에서 패키지 배열 파싱
 * @returns Promise<{ id, name, price, items }[]>
 */
export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets['입력'];
        if (!ws) {
          reject(new Error("'입력' 시트를 찾을 수 없습니다. 올바른 BM기획서 파일인지 확인하세요."));
          return;
        }

        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

        // 헤더 자동 감지: "패키지 명", "아이템", "가격" 등의 텍스트로 열 위치 결정
        let colPkg = -1, colItem = -1, colQty = -1, colPrice = -1, colLimit = -1;
        let headerRow = -1;
        for (let r = 0; r < Math.min(5, rows.length); r++) {
          const row = rows[r] || [];
          for (let c = 0; c < row.length; c++) {
            const v = String(row[c] || '');
            if (v.includes('패키지 명') || v === '패키지명') colPkg = c;
            if (v === '가격') colPrice = c;
            if (v === '구매 제한' || v === '구매제한') colLimit = c;
          }
          if (colPkg >= 0) { headerRow = r; break; }
        }
        // "아이템"과 "수량"은 보통 헤더 다음 행에 있음
        if (headerRow >= 0 && headerRow + 1 < rows.length) {
          const subRow = rows[headerRow + 1] || [];
          for (let c = 0; c < subRow.length; c++) {
            const v = String(subRow[c] || '');
            if (v === '아이템') colItem = c;
            if (v === '수량') colQty = c;
          }
        }
        // 폴백: 감지 실패 시 기존 하드코딩 값 사용
        if (colPkg < 0) colPkg = 4;
        if (colItem < 0) colItem = colPkg + 2;
        if (colQty < 0) colQty = colItem + 1;
        if (colPrice < 0) colPrice = colPkg + 7;
        if (colLimit < 0) colLimit = colPkg + 5;

        const dataStartRow = (headerRow >= 0) ? headerRow + 2 : 3;
        const packages = [];
        let currentPkg = null;
        const ts = Date.now();

        for (let i = dataStartRow; i < rows.length; i++) {
          const row = rows[i];
          const pkgName  = row[colPkg];
          const price    = row[colPrice];
          const itemRaw  = row[colItem];
          const qty      = row[colQty];
          const limit    = row[colLimit];

          if (pkgName != null) {
            if (!isGarbagePkg(pkgName)) {
              currentPkg = {
                id: `pkg_xl_${ts}_${i}`,
                name: String(pkgName).trim(),
                price: price ?? null,
                purchaseLimit: limit ? String(limit).trim() : null,
                items: [],
                rawItems: [],
              };
              packages.push(currentPkg);
            } else {
              currentPkg = null;
            }
          }

          if (currentPkg && itemRaw != null) {
            const rawName = String(itemRaw).trim();
            const q = parseInt(qty) || 0;
            // 모든 아이템을 rawItems에 저장 (구성품 표시용)
            if (rawName && q > 0) {
              currentPkg.rawItems.push({ name: rawName, quantity: q });
            }
            // 시뮬레이터 아이템만 items에 저장
            const simName = matchItem(itemRaw);
            if (simName && qty != null) {
              const existing = currentPkg.items.find(it => it.name === simName);
              if (existing) {
                existing.quantity += q;
              } else {
                currentPkg.items.push({ name: simName, quantity: q });
              }
            }
          }
        }

        resolve(packages.filter(p => p.items.length > 0));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
    reader.readAsArrayBuffer(file);
  });
}

// ============================================================
// 매출지표 Excel 파서
// ============================================================

/**
 * 매출지표 Excel 파싱
 * @returns Promise<{ periodStart, periodEnd, periodLabel, items: Map<name, {revenue, buyers, purchases, quantity}> }>
 */
export function parseSalesExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) { reject(new Error('시트를 찾을 수 없습니다.')); return; }

        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

        // 조회 기간 추출: 상위 행에서 날짜 패턴 찾기 (SheetJS 열 오프셋 무관)
        let periodStart = null, periodEnd = null, periodLabel = '';
        for (let r = 0; r < Math.min(8, rows.length); r++) {
          const row = rows[r];
          if (!row) continue;
          for (const cell of row) {
            if (!cell) continue;
            const m = String(cell).match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
            if (m) {
              periodStart = m[1];
              periodEnd = m[2];
              periodLabel = `${m[1]} ~ ${m[2]}`;
              break;
            }
          }
          if (periodStart) break;
        }

        // 헤더 행 자동 감지: "매출아이템명" 컬럼 위치 찾기
        let headerRow = -1, colItem = -1, colRevenue = -1, colBuyers = -1, colPurchases = -1, colQuantity = -1;
        for (let r = 0; r < Math.min(15, rows.length); r++) {
          const row = rows[r];
          if (!row) continue;
          for (let c = 0; c < row.length; c++) {
            const v = String(row[c] || '');
            if (v.includes('매출아이템명')) {
              headerRow = r;
              colItem = c;
              // 헤더 행에서 나머지 컬럼 위치 찾기
              for (let cc = 0; cc < row.length; cc++) {
                const h = String(row[cc] || '');
                if (h.includes('개인매출')) colRevenue = cc;
                else if (h.includes('구매유저')) colBuyers = cc;
                else if (h.includes('구매횟수')) colPurchases = cc;
                else if (h.includes('구매수량')) colQuantity = cc;
              }
              break;
            }
          }
          if (headerRow >= 0) break;
        }

        // 헤더를 못 찾으면 기존 오프셋 시도 (컬럼 수에 따라 추정)
        if (headerRow < 0) {
          headerRow = 8;
          // SheetJS가 빈 A열을 건너뛸 수 있으므로 열 수로 판단
          const sampleRow = rows[9] || rows[8] || [];
          const offset = sampleRow.length <= 7 ? -1 : 0; // 7열이면 A열 누락
          colItem = 2 + offset;
          colRevenue = 4 + offset;
          colBuyers = 5 + offset;
          colPurchases = 6 + offset;
          colQuantity = 7 + offset;
        }

        const items = new Map();
        for (let i = headerRow + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          const itemName = row[colItem];
          if (!itemName) continue;
          const name = String(itemName).trim();
          const revenue   = parseFloat(row[colRevenue]) || 0;
          const buyers    = parseFloat(row[colBuyers]) || 0;
          const purchases = parseFloat(row[colPurchases]) || 0;
          const quantity  = parseFloat(row[colQuantity]) || 0;

          if (items.has(name)) {
            const prev = items.get(name);
            prev.revenue += revenue;
            prev.buyers = Math.max(prev.buyers, buyers);
            prev.purchases += purchases;
            prev.quantity += quantity;
          } else {
            items.set(name, { revenue, buyers, purchases, quantity });
          }
        }

        resolve({ periodStart, periodEnd, periodLabel, items });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 파일명에서 날짜 레이블 추출
 * "0311BM.xlsx" -> { dateKey: "0311", label: "3월 11일 기획서" }
 */
export function extractDateLabel(filename) {
  const match = filename.match(/^(\d{2})(\d{2})/);
  if (match) {
    const mm = parseInt(match[1]);
    const dd = parseInt(match[2]);
    return { dateKey: match[1] + match[2], label: `${mm}월 ${dd}일 기획서` };
  }
  const base = filename.replace(/\.xlsx?$/i, '');
  return { dateKey: 'etc_' + Date.now(), label: base };
}
