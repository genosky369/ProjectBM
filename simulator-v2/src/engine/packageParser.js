// ============================================================
// packageParser.js
// 패키지 아이템 이름 문자열 → 시뮬레이터 ticketItems 변환
// 새 아이템 추가 시: constants.js의 TICKET_NAME_MAP만 수정
// ============================================================

import { TICKET_NAME_MAP, TREASURE_HUNTER_XP } from '../data/constants';

/**
 * 아이템 이름 1개를 ticketItem 형식으로 변환
 */
export function parseItem(item) {
  for (const entry of TICKET_NAME_MAP) {
    if (!entry.pattern.test(item.name)) continue;

    const qty = item.quantity || 0;

    if (entry.type === 'treasure') {
      return { system: entry.xpKey, ticketType: 'treasure', pulls: 0, quantity: qty };
    }
    if (entry.type === 'awakening_class') {
      return { system: entry.itemKey, ticketType: 'awakening_class', pulls: 0, quantity: qty };
    }
    if (entry.type === 'awakening_pet') {
      return { system: entry.itemKey, ticketType: 'awakening_pet', pulls: 0, quantity: qty };
    }

    return { system: entry.system, ticketType: entry.type, pulls: entry.pulls, quantity: qty };
  }
  return null;
}

/**
 * 패키지 아이템 목록 전체를 ticketItems 배열로 변환
 */
export function parsePackageItems(items) {
  return items.flatMap(item => {
    const parsed = parseItem(item);
    return parsed ? [parsed] : [];
  });
}
