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
  return Object.keys(probs).findLast(g => probs[g] > 0);
}

// ============================================================
// 인벤토리 초기화
// ============================================================
export function createInventory() {
  const gradeCount = () => Object.fromEntries(GRADES.map(g => [g, 0]));

  return {
    클래스: gradeCount(),
    펫: gradeCount(),
    투혼: {
      xpPool: 0,
      enhanced: {},
      gradeCount: gradeCount(),
      produced: {},  // 합성으로 생성된 등급별 누적 개수
    },
    카드: {
      gradeCount: gradeCount(),
    },
    awakening: {
      클래스: { 영웅: 0, 고대: 0, 전설: 0 },
      펫:    { 영웅: 0, 고대: 0, 전설: 0 },
    },
    awakeningItems: {
      클래스: { '노련한 각성자': 0, '대단한 각성자': 0, '완벽한 각성자': 0 },
      펫:    { '노련한 동반자': 0, '대단한 동반자': 0, '완벽한 동반자': 0 },
    },
    treasureXP: 0,
  };
}

// ============================================================
// 소환 1회 처리
// ============================================================
export function drawOnce(system, ticketType, probs) {
  return randomGrade(probs);
}

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
// plcMax가 주어지면: 상위 등급이 PLC 80% 이상이면 해당 합성 차단 (각성 우선)
// ============================================================
const PLC_THRESHOLD = 0.8;

export function applySynthesis(inv, system, rules, pityState, plcMax) {
  const sysPlc = plcMax?.[system] || {};
  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of rules) {
      const { from, to, need, prob, returnOnFail, pity } = rule;
      const src = system === '클래스' ? inv.클래스 : inv.펫;

      // PLC 차단: 상위 등급(to)이 PLC 80% 이상이면 이 합성 건너뛰기
      const toPlc = sysPlc[to] || 0;
      if (toPlc > 0 && (src[to] || 0) >= toPlc * PLC_THRESHOLD) {
        continue;
      }

      while ((src[from] || 0) >= need) {
        const key = `${from}->${to}`;
        pityState[key] = pityState[key] || 0;

        const success =
          (pity > 0 && pityState[key] >= pity) || Math.random() < prob;

        src[from] -= need;

        if (success) {
          src[to] = (src[to] || 0) + 1;
          // 합성 후 상위 등급이 PLC 80%에 도달하면 중단
          if (toPlc > 0 && (src[to] || 0) >= toPlc * PLC_THRESHOLD) {
            changed = true;
            pityState[key] = 0;
            break;
          }
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
// ============================================================
export function applySoulEnhancement(inv) {
  const gradeCount = inv.투혼.gradeCount;
  const totalXpFor5 = SOUL_ENHANCE_XP['전설'].reduce((a, b) => a + b, 0);

  let xpPool = inv.treasureXP;
  for (const grade of GRADES) {
    const cnt = gradeCount[grade] || 0;
    if (cnt > 0 && SOUL_MATERIAL_XP[grade]) {
      xpPool += cnt * SOUL_MATERIAL_XP[grade];
      gradeCount[grade] = 0;
    }
  }
  inv.treasureXP = 0;

  const legendCount5 = Math.floor(xpPool / totalXpFor5);
  const remainXp = xpPool % totalXpFor5;

  const yeolhwaCount = Math.floor(legendCount5 / SOUL_IMMORTAL_RECIPE.전설5강_to_열화불멸);
  const remainLegend5 = legendCount5 % SOUL_IMMORTAL_RECIPE.전설5강_to_열화불멸;

  const immortalCount = Math.floor(yeolhwaCount);

  if (!inv.투혼.enhanced) inv.투혼.enhanced = {};
  inv.투혼.enhanced['불멸'] = (inv.투혼.enhanced['불멸'] || 0) + immortalCount;
  inv.투혼.enhanced['열화불멸_5강'] = (inv.투혼.enhanced['열화불멸_5강'] || 0) +
    (yeolhwaCount - immortalCount);
  inv.투혼.enhanced['전설_5강_잔여'] = remainLegend5;
  inv.투혼.enhanced['전설_5강_총'] = legendCount5;
  inv.투혼.enhanced['전설_진행중_xp'] = remainXp;
  inv.투혼.enhanced['총_xp'] = xpPool;
}

// ============================================================
// 카드 강화 처리
// ============================================================
export function applyCardEnhancement(inv) {
  if (!inv.카드.enhanced) inv.카드.enhanced = {};
  const gc = inv.카드.gradeCount;

  for (const grade of ['일반', '고급', '희귀', '영웅', '고대', '전설']) {
    const needs = CARD_EVOLVE_NEED[grade];
    let available = gc[grade] || 0;
    let level = 0;

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
    gc[grade] = available;
  }
}

// ============================================================
// 각성 처리 (클래스/펫)
// 해당 등급의 PLC 80% 이상 달성해야 각성 시작
// 각성 전용 아이템 우선 소비, 부족 시 보유 카드 소비
// ============================================================
export function applyAwakening(inv, plcMax) {
  const classPlc = plcMax?.클래스 || {};
  for (const [grade, steps] of Object.entries(CLASS_AWAKENING)) {
    // 해당 등급 PLC 80% 미달이면 각성 안 함
    const gradeTarget = classPlc[grade] || 0;
    if (gradeTarget > 0 && (inv.클래스[grade] || 0) < gradeTarget * PLC_THRESHOLD) continue;

    const items = inv.awakeningItems.클래스;
    for (let step = 0; step < steps.length; step++) {
      const { need, itemKey, pointGain } = steps[step];
      const pointNeeded = steps.slice(0, step + 1).reduce((a, s) => a + s.pointGain, 0);
      if ((inv.awakening.클래스[grade] || 0) >= pointNeeded) continue;

      // 각성 전용 아이템 우선
      if ((items[itemKey] || 0) >= need) {
        items[itemKey] -= need;
        inv.awakening.클래스[grade] = (inv.awakening.클래스[grade] || 0) + pointGain;
        continue;
      }
      // 부족 시 보유 카드 소비
      if ((inv.클래스[grade] || 0) >= need) {
        inv.클래스[grade] -= need;
        inv.awakening.클래스[grade] = (inv.awakening.클래스[grade] || 0) + pointGain;
      }
    }
  }

  const petPlc = plcMax?.펫 || {};
  for (const [grade, steps] of Object.entries(PET_AWAKENING)) {
    // 해당 등급 PLC 80% 미달이면 각성 안 함
    const gradeTarget = petPlc[grade] || 0;
    if (gradeTarget > 0 && (inv.펫[grade] || 0) < gradeTarget * PLC_THRESHOLD) continue;

    const items = inv.awakeningItems.펫;
    for (let step = 0; step < steps.length; step++) {
      const { need, itemKey, pointGain } = steps[step];
      const pointNeeded = steps.slice(0, step + 1).reduce((a, s) => a + s.pointGain, 0);
      if ((inv.awakening.펫[grade] || 0) >= pointNeeded) continue;

      // 각성 전용 아이템 우선
      if ((items[itemKey] || 0) >= need) {
        items[itemKey] -= need;
        inv.awakening.펫[grade] = (inv.awakening.펫[grade] || 0) + pointGain;
        continue;
      }
      // 부족 시 보유 카드 소비
      if ((inv.펫[grade] || 0) >= need) {
        inv.펫[grade] -= need;
        inv.awakening.펫[grade] = (inv.awakening.펫[grade] || 0) + pointGain;
      }
    }
  }
}

// ============================================================
// 패키지 1개 처리
// ============================================================
import { TICKET_NAME_MAP, TREASURE_HUNTER_XP } from '../data/constants';

export function applyPackage(inv, ticketItems, pityState, plcMax) {
  for (const { system, ticketType, pulls, quantity } of ticketItems) {
    if (ticketType === 'treasure') {
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

  // 클래스/펫: 합성(PLC 80% 차단) → 각성 → 잔여 합성
  applySynthesis(inv, '클래스', SYNTH_RULES.클래스, pityState.클래스, plcMax);
  applyAwakening(inv, plcMax);
  // 각성 완료 후 잔여 재료로 다시 합성 시도 (PLC 차단 없이)
  applySynthesis(inv, '클래스', SYNTH_RULES.클래스, pityState.클래스);

  applySynthesis(inv, '펫', SYNTH_RULES.펫, pityState.펫, plcMax);
  applyAwakening(inv, plcMax);
  applySynthesis(inv, '펫', SYNTH_RULES.펫, pityState.펫);

  // 투혼: 합성(PLC 80% 차단) → 성장 → 잔여 합성
  applySynthesisForSoul(inv, pityState.투혼, plcMax);
  applySoulEnhancement(inv);
  applySynthesisForSoul(inv, pityState.투혼);

  // 카드: 합성(PLC 80% 차단) → 성장 → 잔여 합성
  applySynthesisForCard(inv, pityState.카드, plcMax);
  inv.카드.preEnhance = { ...inv.카드.gradeCount };
  applyCardEnhancement(inv);
  applySynthesisForCard(inv, pityState.카드);
}

function applySynthesisForSoul(inv, pityState, plcMax) {
  if (!inv.투혼.produced) inv.투혼.produced = {};
  const sysPlc = plcMax?.투혼 || {};
  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of SYNTH_RULES.투혼) {
      const gc = inv.투혼.gradeCount;
      const { from, to, need, prob, returnOnFail, pity } = rule;

      // PLC 차단: 상위 등급(to)이 PLC 80% 이상이면 합성 건너뛰기
      const toPlc = sysPlc[to] || 0;
      if (plcMax && toPlc > 0 && (gc[to] || 0) >= toPlc * PLC_THRESHOLD) {
        continue;
      }

      while ((gc[from] || 0) >= need) {
        const key = `${from}->${to}`;
        pityState[key] = pityState[key] || 0;
        const success = (pity > 0 && pityState[key] >= pity) || Math.random() < prob;
        gc[from] -= need;
        if (success) {
          gc[to] = (gc[to] || 0) + 1;
          inv.투혼.produced[to] = (inv.투혼.produced[to] || 0) + 1;
          pityState[key] = 0;
          changed = true;
          if (plcMax && toPlc > 0 && (gc[to] || 0) >= toPlc * PLC_THRESHOLD) break;
        } else {
          gc[from] += returnOnFail;
          pityState[key]++;
        }
      }
    }
  }
}

function applySynthesisForCard(inv, pityState, plcMax) {
  const sysPlc = plcMax?.카드 || {};
  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of SYNTH_RULES.카드) {
      const gc = inv.카드.gradeCount;
      const { from, to, need, prob, returnOnFail, pity } = rule;

      // PLC 차단: 상위 등급(to)이 PLC 80% 이상이면 합성 건너뛰기
      const toPlc = sysPlc[to] || 0;
      if (plcMax && toPlc > 0 && (gc[to] || 0) >= toPlc * PLC_THRESHOLD) {
        continue;
      }

      while ((gc[from] || 0) >= need) {
        const key = `${from}->${to}`;
        pityState[key] = pityState[key] || 0;
        const success = (pity > 0 && pityState[key] >= pity) || Math.random() < prob;
        gc[from] -= need;
        if (success) {
          gc[to] = (gc[to] || 0) + 1;
          pityState[key] = 0;
          changed = true;
          if (plcMax && toPlc > 0 && (gc[to] || 0) >= toPlc * PLC_THRESHOLD) break;
        } else {
          gc[from] += returnOnFail;
          pityState[key]++;
        }
      }
    }
  }
}

// ============================================================
// 스냅샷
// ============================================================
export function takeSnapshot(inv) {
  // 투혼: 고대/전설 수량은 합성 생산량 기준
  const soulProduced = inv.투혼.produced || {};
  const soulEnhanced = inv.투혼.enhanced || {};
  // 전설5강 총 생산량 (강화 경로에서 계산된 것)
  const legendTotal = soulEnhanced['전설_5강_총'] || 0;

  return {
    클래스: {
      불멸: inv.클래스['불멸'] || 0,
      전설: inv.클래스['전설'] || 0,
      고대: inv.클래스['고대'] || 0,
      영웅: inv.클래스['영웅'] || 0,
      영웅각성: inv.awakening.클래스['영웅'] || 0,
      고대각성: inv.awakening.클래스['고대'] || 0,
      전설각성: inv.awakening.클래스['전설'] || 0,
    },
    펫: {
      불멸: inv.펫['불멸'] || 0,
      전설: inv.펫['전설'] || 0,
      고대: inv.펫['고대'] || 0,
      영웅: inv.펫['영웅'] || 0,
      영웅각성: inv.awakening.펫['영웅'] || 0,
      고대각성: inv.awakening.펫['고대'] || 0,
      전설각성: inv.awakening.펫['전설'] || 0,
    },
    투혼: {
      불멸: soulEnhanced['불멸'] || 0,
      전설: legendTotal,
      고대: soulProduced['고대'] || 0,
    },
    카드: {
      전설: inv.카드.preEnhance?.['전설'] || 0,
      고대: inv.카드.preEnhance?.['고대'] || 0,
      영웅: inv.카드.preEnhance?.['영웅'] || 0,
    },
  };
}

// ============================================================
// 메인 시뮬레이션 실행
// ============================================================
export function runSimulation(packages, startInventory, plcMax) {
  const allRuns = [];

  for (let run = 0; run < SIMULATION_RUNS; run++) {
    const inv = deepCloneInventory(startInventory);
    const pityState = { 클래스: {}, 펫: {}, 투혼: {}, 카드: {} };
    const snapshots = [];

    for (const pkg of packages) {
      applyPackage(inv, pkg.ticketItems, pityState, plcMax);
      snapshots.push({ date: pkg.date, snapshot: takeSnapshot(inv) });
    }

    allRuns.push(snapshots);
  }

  return averageSnapshots(allRuns);
}

function deepCloneInventory(inv) {
  return JSON.parse(JSON.stringify(inv));
}

function averageSnapshots(allRuns) {
  if (allRuns.length === 0) return [];
  const n = allRuns.length;

  return allRuns[0].map((_, i) => {
    const date = allRuns[0][i].date;
    const avg = {};

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
