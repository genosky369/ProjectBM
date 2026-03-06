// ============================================================
// simulator.js
// 핵심 시뮬레이션 엔진. 순수 함수로만 구성.
// UI/React 의존성 없음. 데이터 변환 로직 없음.
// ============================================================

import {
  GRADES,
  GRADE_INDEX,
  TICKET_PROBS,
  CHALLENGE_TICKET_PROBS,
  GUARANTEED_TICKET_GRADES,
  SYNTH_RULES,
  CLASS_IMMORTAL_RECIPE,
  SOUL_MATERIAL_XP,
  SOUL_ENHANCE_XP,
  SOUL_IMMORTAL_RECIPE,
  CARD_EVOLVE_NEED,
  CLASS_AWAKENING,
  PET_AWAKENING,
  SIMULATION_RUNS,
} from '../data/constants';

// ============================================================
// 유틸: 확률 기반 랜덤 등급 선택
// ============================================================
function randomGrade(probs) {
  const r = Math.random();
  let cumul = 0;
  for (const [grade, prob] of Object.entries(probs)) {
    if (prob <= 0) continue;
    cumul += prob;
    if (r < cumul) return grade;
  }
  // 부동소수점 오차 방어
  return Object.keys(probs).findLast(g => probs[g] > 0);
}

// ============================================================
// 인벤토리 초기화
// ============================================================
export function createInventory() {
  // 클래스/펫: { 등급: 개수 }
  // 투혼/카드: { 등급: { count: 개수, enhanceXP: 현재 누적XP } } - 단순화
  // 각성 포인트: { 클래스: { 영웅: 0, 고대: 0, 전설: 0 }, 펫: { ... } }
  // 보물사냥꾼 XP 풀, 각성 아이템 수량

  const gradeCount = () => Object.fromEntries(GRADES.map(g => [g, 0]));

  return {
    클래스: gradeCount(),
    펫: gradeCount(),
    투혼: {  // 등급별 { 전체 XP 풀, 완성된 개수 }로 관리
      xpPool: 0,         // 재료로 사용 가능한 총 XP
      enhanced: {},      // { '전설_5강': 2 } 형태로 완성 추적 - 단순화
      gradeCount: gradeCount(), // 합성 전 등급별 보유 수
    },
    카드: {
      gradeCount: gradeCount(),
    },
    awakening: {
      클래스: { 영웅: 0, 고대: 0, 전설: 0 }, // 각성 포인트
      펫:    { 영웅: 0, 고대: 0, 전설: 0 },
    },
    awakeningItems: {
      클래스: { '노련한 각성자': 0, '대단한 각성자': 0, '완벽한 각성자': 0 },
      펫:    { '노련한 동반자': 0, '대단한 동반자': 0, '완벽한 동반자': 0 },
    },
    treasureXP: 0, // 보물사냥꾼 총 XP
  };
}

// ============================================================
// 소환 1회 처리
// ============================================================
export function drawOnce(system, ticketType, probs) {
  return randomGrade(probs);
}

// 소환권 1장 사용 (pulls 횟수만큼 추첨)
export function useTicket(inv, system, ticketType, pulls) {
  let probs;

  if (ticketType in (CHALLENGE_TICKET_PROBS[system] || {})) {
    probs = CHALLENGE_TICKET_PROBS[system][ticketType];
  } else if (ticketType in GUARANTEED_TICKET_GRADES) {
    const grade = GUARANTEED_TICKET_GRADES[ticketType];
    for (let i = 0; i < pulls; i++) {
      addToInventory(inv, system, grade);
    }
    return;
  } else {
    probs = TICKET_PROBS[system]?.[ticketType];
    if (!probs) return;
  }

  for (let i = 0; i < pulls; i++) {
    const grade = randomGrade(probs);
    addToInventory(inv, system, grade);
  }
}

function addToInventory(inv, system, grade) {
  if (system === '클래스') {
    inv.클래스[grade] = (inv.클래스[grade] || 0) + 1;
  } else if (system === '펫') {
    inv.펫[grade] = (inv.펫[grade] || 0) + 1;
  } else if (system === '투혼') {
    inv.투혼.gradeCount[grade] = (inv.투혼.gradeCount[grade] || 0) + 1;
  } else if (system === '카드') {
    inv.카드.gradeCount[grade] = (inv.카드.gradeCount[grade] || 0) + 1;
  }
}

// ============================================================
// 합성 처리 (클래스/펫)
// ============================================================
export function applySynthesis(inv, system, rules, pityState) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of rules) {
      const { from, to, need, prob, returnOnFail, pity } = rule;
      const src = system === '클래스' ? inv.클래스 : inv.펫;

      while ((src[from] || 0) >= need) {
        const key = `${from}->${to}`;
        pityState[key] = pityState[key] || 0;

        const success =
          (pity > 0 && pityState[key] >= pity) || Math.random() < prob;

        src[from] -= need;

        if (success) {
          src[to] = (src[to] || 0) + 1;
          pityState[key] = 0;
          changed = true;
        } else {
          src[from] += returnOnFail;
          pityState[key]++;
        }
      }
    }
  }
}

// ============================================================
// 클래스 불멸 승급 처리
// ============================================================
export function applyClassImmortalUpgrade(inv) {
  while (true) {
    const canUpgrade =
      (inv.클래스['영웅'] || 0) >= CLASS_IMMORTAL_RECIPE.영웅 &&
      (inv.클래스['고대'] || 0) >= CLASS_IMMORTAL_RECIPE.고대 &&
      (inv.클래스['전설'] || 0) >= CLASS_IMMORTAL_RECIPE.전설;

    if (!canUpgrade) break;

    inv.클래스['영웅'] -= CLASS_IMMORTAL_RECIPE.영웅;
    inv.클래스['고대'] -= CLASS_IMMORTAL_RECIPE.고대;
    inv.클래스['전설'] -= CLASS_IMMORTAL_RECIPE.전설;
    inv.클래스['불멸'] = (inv.클래스['불멸'] || 0) + 1;
  }
}

// ============================================================
// 투혼 강화 처리
// 전략: 소환된 투혼을 XP로 변환하여 풀에 쌓고,
//       최고 등급부터 강화 시도 (5강 목표)
// ============================================================
export function applySoulEnhancement(inv) {
  // 1. 합성을 먼저 (전설 최대화)
  // 투혼 합성은 별도 synthRules에서 처리 (applySynthesis에서 투혼도 처리 가능하도록 구조 통일 필요)
  // 여기서는 합성 후 남은 투혼을 XP로 변환

  // 2. 전설 투혼들을 5강화 하여 열화불멸로 변환
  // 간소화: 전설 투혼 개수를 XP 단위로 환산 후 5강 달성 여부 계산
  const gradeCount = inv.투혼.gradeCount;

  // 전설 투혼 5강 완성에 필요한 총 XP
  const totalXpFor5 = SOUL_ENHANCE_XP['전설'].reduce((a, b) => a + b, 0); // 15,000,000

  // XP 풀에 합산 (재료로 사용할 투혼 전부)
  let xpPool = inv.treasureXP;
  for (const grade of GRADES) {
    const cnt = gradeCount[grade] || 0;
    if (cnt > 0 && SOUL_MATERIAL_XP[grade]) {
      xpPool += cnt * SOUL_MATERIAL_XP[grade];
      gradeCount[grade] = 0;
    }
  }
  inv.treasureXP = 0;

  // 전설 5강 몇 개 만들 수 있는지 계산
  // (단순화: XP풀 / 전설5강 필요XP)
  const legendCount5 = Math.floor(xpPool / totalXpFor5);
  const remainXp = xpPool % totalXpFor5;

  // 열화불멸로 변환 (전설5강 2개 = 열화불멸 1개)
  const yeolhwaCount = Math.floor(legendCount5 / SOUL_IMMORTAL_RECIPE.전설5강_to_열화불멸);
  const remainLegend5 = legendCount5 % SOUL_IMMORTAL_RECIPE.전설5강_to_열화불멸;

  // 열화불멸 5강에 필요한 XP
  const totalXpForYeolhwa5 = SOUL_ENHANCE_XP['열화불멸'].reduce((a, b) => a + b, 0);

  // 열화불멸 → 불멸 변환
  const immortalCount = Math.floor(yeolhwaCount); // 열화불멸 5강 1개 = 불멸 1개
  // 실제로는 열화불멸도 XP가 필요하지만 여기서는 XP풀로 이미 계산됨

  // 결과를 inv에 반영
  if (!inv.투혼.enhanced) inv.투혼.enhanced = {};
  inv.투혼.enhanced['불멸'] = (inv.투혼.enhanced['불멸'] || 0) + immortalCount;
  inv.투혼.enhanced['열화불멸_5강'] = (inv.투혼.enhanced['열화불멸_5강'] || 0) +
    (yeolhwaCount - immortalCount);
  inv.투혼.enhanced['전설_5강_잔여'] = remainLegend5;
  inv.투혼.enhanced['전설_진행중_xp'] = remainXp;
}

// ============================================================
// 카드 강화 처리
// 동일 등급 카드를 소모하여 레벨업 (낮은 등급부터 높은 등급으로 올린 후 소모)
// ============================================================
export function applyCardEnhancement(inv) {
  // 각 등급의 카드를 최대한 높은 레벨로 강화
  // 강화된 카드들로 더 높은 등급 카드의 레벨업을 지원
  // (구조 단순화: 등급별 총 카드 수에서 최대 레벨 카드 수를 계산)

  if (!inv.카드.enhanced) inv.카드.enhanced = {};
  const gc = inv.카드.gradeCount;

  for (const grade of ['일반', '고급', '희귀', '영웅', '고대', '전설']) {
    const needs = CARD_EVOLVE_NEED[grade]; // [0→1, 1→2, 2→3, 3→4, 4→5]
    let available = gc[grade] || 0;
    let level = 0;

    // 최대 5강까지 올릴 수 있는 레벨 계산
    for (let lv = 0; lv < 5; lv++) {
      if (available >= needs[lv]) {
        available -= needs[lv];
        level = lv + 1;
      } else {
        break;
      }
    }

    inv.카드.enhanced[grade] = {
      maxLevel: level,
      remaining: available,
    };
    // 소모된 카드는 제거 (강화에 사용됨)
    gc[grade] = available;
  }
}

// ============================================================
// 각성 처리
// ============================================================
export function applyAwakening(inv) {
  // 클래스 각성
  for (const [grade, steps] of Object.entries(CLASS_AWAKENING)) {
    const classCount = inv.클래스[grade] || 0;
    const items = inv.awakeningItems.클래스;

    for (let step = 0; step < steps.length; step++) {
      const { need, itemKey, pointGain } = steps[step];
      const currentPoint = inv.awakening.클래스[grade] || 0;
      // 이미 이 단계 포인트 달성했는지 확인
      const pointNeeded = steps.slice(0, step + 1).reduce((a, s) => a + s.pointGain, 0);
      if (currentPoint >= pointNeeded) continue;

      // 동일 등급 클래스로 각성 시도
      while ((inv.클래스[grade] || 0) >= need) {
        inv.클래스[grade] -= need;
        inv.awakening.클래스[grade] = (inv.awakening.클래스[grade] || 0) + pointGain;
        break;
      }
      // 아이템으로 각성 시도 (클래스가 부족할 때)
      while ((items[itemKey] || 0) >= need) {
        items[itemKey] -= need;
        inv.awakening.클래스[grade] = (inv.awakening.클래스[grade] || 0) + pointGain;
        break;
      }
    }
  }

  // 펫 각성 (동일 패턴)
  for (const [grade, steps] of Object.entries(PET_AWAKENING)) {
    const items = inv.awakeningItems.펫;

    for (let step = 0; step < steps.length; step++) {
      const { need, itemKey, pointGain } = steps[step];
      const currentPoint = inv.awakening.펫[grade] || 0;
      const pointNeeded = steps.slice(0, step + 1).reduce((a, s) => a + s.pointGain, 0);
      if (currentPoint >= pointNeeded) continue;

      while ((inv.펫[grade] || 0) >= need) {
        inv.펫[grade] -= need;
        inv.awakening.펫[grade] = (inv.awakening.펫[grade] || 0) + pointGain;
        break;
      }
      while ((items[itemKey] || 0) >= need) {
        items[itemKey] -= need;
        inv.awakening.펫[grade] = (inv.awakening.펫[grade] || 0) + pointGain;
        break;
      }
    }
  }
}

// ============================================================
// 패키지 1개 처리 (소환권 목록 → 인벤토리 반영)
// ============================================================
import { TICKET_NAME_MAP, TREASURE_HUNTER_XP } from '../data/constants';

export function applyPackage(inv, ticketItems, pityState) {
  for (const { system, ticketType, pulls, quantity } of ticketItems) {
    if (ticketType === 'treasure') {
      // 보물 사냥꾼 XP 추가
      inv.treasureXP += (TREASURE_HUNTER_XP[system] || 0) * quantity;
      continue;
    }
    if (ticketType === 'awakening_class') {
      inv.awakeningItems.클래스[system] =
        (inv.awakeningItems.클래스[system] || 0) + quantity;
      continue;
    }
    if (ticketType === 'awakening_pet') {
      inv.awakeningItems.펫[system] =
        (inv.awakeningItems.펫[system] || 0) + quantity;
      continue;
    }

    for (let i = 0; i < quantity; i++) {
      useTicket(inv, system, ticketType, pulls);
    }
  }

  // 합성 적용
  const classPity = pityState.클래스;
  const petPity = pityState.펫;
  applySynthesis(inv, '클래스', SYNTH_RULES.클래스, classPity);
  applyClassImmortalUpgrade(inv);
  applySynthesis(inv, '펫', SYNTH_RULES.펫, petPity);

  // 투혼 합성 + 강화
  applySynthesisForSoul(inv, pityState.투혼);
  applySoulEnhancement(inv);

  // 카드 합성 + 강화
  applySynthesisForCard(inv, pityState.카드);
  applyCardEnhancement(inv);

  // 각성
  applyAwakening(inv);
}

function applySynthesisForSoul(inv, pityState) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of SYNTH_RULES.투혼) {
      const gc = inv.투혼.gradeCount;
      const { from, to, need, prob, returnOnFail, pity } = rule;
      while ((gc[from] || 0) >= need) {
        const key = `${from}->${to}`;
        pityState[key] = pityState[key] || 0;
        const success = (pity > 0 && pityState[key] >= pity) || Math.random() < prob;
        gc[from] -= need;
        if (success) {
          gc[to] = (gc[to] || 0) + 1;
          pityState[key] = 0;
          changed = true;
        } else {
          gc[from] += returnOnFail;
          pityState[key]++;
        }
      }
    }
  }
}

function applySynthesisForCard(inv, pityState) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of SYNTH_RULES.카드) {
      const gc = inv.카드.gradeCount;
      const { from, to, need, prob, returnOnFail, pity } = rule;
      while ((gc[from] || 0) >= need) {
        const key = `${from}->${to}`;
        pityState[key] = pityState[key] || 0;
        const success = (pity > 0 && pityState[key] >= pity) || Math.random() < prob;
        gc[from] -= need;
        if (success) {
          gc[to] = (gc[to] || 0) + 1;
          pityState[key] = 0;
          changed = true;
        } else {
          gc[from] += returnOnFail;
          pityState[key]++;
        }
      }
    }
  }
}

// ============================================================
// 스냅샷: 현재 인벤토리에서 주요 지표 추출
// ============================================================
export function takeSnapshot(inv) {
  return {
    클래스: {
      불멸: inv.클래스['불멸'] || 0,
      전설: inv.클래스['전설'] || 0,
      고대: inv.클래스['고대'] || 0,
      영웅: inv.클래스['영웅'] || 0,
      각성: { ...inv.awakening.클래스 },
    },
    펫: {
      불멸: inv.펫['불멸'] || 0,
      전설: inv.펫['전설'] || 0,
      고대: inv.펫['고대'] || 0,
      영웅: inv.펫['영웅'] || 0,
      각성: { ...inv.awakening.펫 },
    },
    투혼: {
      불멸: inv.투혼.enhanced?.['불멸'] || 0,
      열화불멸: inv.투혼.enhanced?.['열화불멸_5강'] || 0,
      전설5강잔여: inv.투혼.enhanced?.['전설_5강_잔여'] || 0,
    },
    카드: {
      전설레벨: inv.카드.enhanced?.['전설']?.maxLevel || 0,
      고대레벨: inv.카드.enhanced?.['고대']?.maxLevel || 0,
    },
  };
}

// ============================================================
// 메인 시뮬레이션 실행
// packages: [{ date, ticketItems: [{system,ticketType,pulls,quantity}] }]
// startInv: 초기 인벤토리 상태 (시작 현황)
// returns: [{ date, snapshot }] 시간순 스냅샷 배열
// ============================================================
export function runSimulation(packages, startInventory) {
  // Monte Carlo: SIMULATION_RUNS번 반복 후 평균
  const allRuns = [];

  for (let run = 0; run < SIMULATION_RUNS; run++) {
    const inv = deepCloneInventory(startInventory);
    const pityState = {
      클래스: {},
      펫: {},
      투혼: {},
      카드: {},
    };
    const snapshots = [];

    for (const pkg of packages) {
      applyPackage(inv, pkg.ticketItems, pityState);
      snapshots.push({ date: pkg.date, snapshot: takeSnapshot(inv) });
    }

    allRuns.push(snapshots);
  }

  // 날짜별 평균 계산
  return averageSnapshots(allRuns);
}

function deepCloneInventory(inv) {
  return JSON.parse(JSON.stringify(inv));
}

function averageSnapshots(allRuns) {
  if (allRuns.length === 0) return [];
  const n = allRuns.length;
  const len = allRuns[0].length;

  return allRuns[0].map((_, i) => {
    const date = allRuns[0][i].date;
    const avg = {};

    // 평균 계산 (재귀적으로)
    for (const system of ['클래스', '펫', '투혼', '카드']) {
      avg[system] = {};
      const keys = Object.keys(allRuns[0][i].snapshot[system]);
      for (const key of keys) {
        if (typeof allRuns[0][i].snapshot[system][key] === 'object') {
          avg[system][key] = {};
          for (const subKey of Object.keys(allRuns[0][i].snapshot[system][key])) {
            avg[system][key][subKey] =
              allRuns.reduce((s, run) => s + (run[i].snapshot[system][key][subKey] || 0), 0) / n;
          }
        } else {
          avg[system][key] =
            allRuns.reduce((s, run) => s + (run[i].snapshot[system][key] || 0), 0) / n;
        }
      }
    }

    return { date, snapshot: avg };
  });
}
