// ============================================================
// expectedValue.js
// 고대 환산 기댓값 계산 유틸리티
// 패키지 아이템 → 시스템별 고대 등가 환산
// ============================================================

import {
  TICKET_PROBS, CHALLENGE_TICKET_PROBS, GUARANTEED_TICKET_GRADES,
  SYNTH_RULES, CLASS_IMMORTAL_RECIPE, TREASURE_HUNTER_XP, SOUL_MATERIAL_XP,
} from '../data/constants';

// E[시도 횟수] (천장 포함)
function expectedAttempts(prob, pity) {
  if (prob >= 1) return 1;
  if (pity > 0) return (1 - Math.pow(1 - prob, pity)) / prob;
  return 1 / prob;
}

// from 등급 몇 개로 to 등급 1개를 만드는 기댓값
function synthExpectedCost(rule) {
  const { need, prob, returnOnFail, pity } = rule;
  const E = expectedAttempts(prob, pity);
  return need + (E - 1) * (need - returnOnFail);
}

/**
 * 시스템별 각 등급의 고대 환산값 계산
 * 고대 = 1.0 기준
 * 낮은 등급: < 1.0 (영웅 0.05 = 영웅 20개 ≈ 고대 1개)
 * 높은 등급: > 1.0 (전설 14.03 = 고대 14개 ≈ 전설 1개)
 */
export function computeGodaeValues(system) {
  const values = { '고대': 1.0 };
  const rules = SYNTH_RULES[system] || [];

  // cost 테이블
  const costOf = {};
  for (const rule of rules) {
    costOf[`${rule.from}→${rule.to}`] = synthExpectedCost(rule);
  }

  // 하위 등급: 고대에서 아래로
  for (let pass = 0; pass < 6; pass++) {
    for (const rule of rules) {
      if (values[rule.to] !== undefined && values[rule.from] === undefined) {
        values[rule.from] = values[rule.to] / costOf[`${rule.from}→${rule.to}`];
      }
    }
  }

  // 상위 등급: 고대에서 위로
  for (let pass = 0; pass < 3; pass++) {
    for (const rule of rules) {
      if (values[rule.from] !== undefined && values[rule.to] === undefined) {
        values[rule.to] = costOf[`${rule.from}→${rule.to}`] * values[rule.from];
      }
    }
  }

  // 클래스 불멸: 레시피 기반 (영웅 50 + 고대 16 + 전설 4)
  if (system === '클래스' && !values['불멸']) {
    values['불멸'] =
      (CLASS_IMMORTAL_RECIPE.영웅 || 0) * (values['영웅'] || 0) +
      (CLASS_IMMORTAL_RECIPE.고대 || 0) * 1 +
      (CLASS_IMMORTAL_RECIPE.전설 || 0) * (values['전설'] || 0);
  }

  return values;
}

// 소환권 1회 사용시 등급별 기대 드랍 수
function expectedDrops(system, ticketType, pulls) {
  if (ticketType in GUARANTEED_TICKET_GRADES) {
    return { [GUARANTEED_TICKET_GRADES[ticketType]]: pulls };
  }
  let probs;
  if (CHALLENGE_TICKET_PROBS[system]?.[ticketType]) {
    probs = CHALLENGE_TICKET_PROBS[system][ticketType];
  } else {
    probs = TICKET_PROBS[system]?.[ticketType];
  }
  if (!probs) return {};
  const result = {};
  for (const [grade, prob] of Object.entries(probs)) {
    if (prob > 0) result[grade] = pulls * prob;
  }
  return result;
}

// 캐싱
let _cachedGdv = null;
function getGodaeValues() {
  if (!_cachedGdv) {
    _cachedGdv = {};
    for (const sys of ['클래스', '펫', '투혼', '카드']) {
      _cachedGdv[sys] = computeGodaeValues(sys);
    }
  }
  return _cachedGdv;
}

/**
 * ticketItems (parsePackageItems 결과) → 시스템별 고대 환산 합계
 * returns: { 클래스: N, 펫: N, 투혼: N, 카드: N }
 */
export function calcGodaeEquivalent(ticketItems) {
  const result = { 클래스: 0, 펫: 0, 투혼: 0, 카드: 0 };
  const gdv = getGodaeValues();

  for (const item of ticketItems) {
    const { system, ticketType, pulls, quantity } = item;

    // 보물사냥꾼 → 투혼 XP → 고대 환산
    if (ticketType === 'treasure') {
      const xp = (TREASURE_HUNTER_XP[system] || 0) * quantity;
      result.투혼 += xp * (gdv.투혼['고대'] || 0) / (SOUL_MATERIAL_XP['고대'] || 200000);
      continue;
    }
    // 각성 아이템은 환산에서 제외 (별도 표기)
    if (ticketType === 'awakening_class' || ticketType === 'awakening_pet') continue;
    if (!system) continue;

    const drops = expectedDrops(system, ticketType, pulls);
    for (const [grade, count] of Object.entries(drops)) {
      result[system] += count * quantity * (gdv[system][grade] || 0);
    }
  }
  return result;
}

/**
 * 상세 드랍 기댓값: 시스템별 등급별 기대 수량
 * returns: { 클래스: { 영웅: N, 고대: N, ... }, ... }
 */
export function calcDetailedDrops(ticketItems) {
  const result = { 클래스: {}, 펫: {}, 투혼: {}, 카드: {} };

  for (const item of ticketItems) {
    const { system, ticketType, pulls, quantity } = item;
    if (!system || ticketType === 'treasure' || ticketType?.startsWith('awakening_')) continue;

    const drops = expectedDrops(system, ticketType, pulls);
    for (const [grade, count] of Object.entries(drops)) {
      result[system][grade] = (result[system][grade] || 0) + count * quantity;
    }
  }
  return result;
}
