// ============================================================
// constants.js
// 모든 게임 수치가 여기에 집중됩니다.
// 확률, 재료 수량, 등급명 등 변경이 필요하면 이 파일만 수정하세요.
// ============================================================

// 등급 체계 (인덱스 순서 중요: 낮은 등급 → 높은 등급)
export const GRADES = ['일반', '고급', '희귀', '영웅', '고대', '전설', '불멸'];
export const GRADE_INDEX = Object.fromEntries(GRADES.map((g, i) => [g, i]));

// 시스템 종류
export const SYSTEMS = ['클래스', '펫', '투혼', '카드'];

// ============================================================
// 소환 확률 (11회 소환권: 1회 사용 = 11번 추첨)
// ============================================================
export const TICKET_PROBS = {
  클래스: {
    찬란한: { 일반: 0.70635, 고급: 0.27600, 희귀: 0.01600, 영웅: 0.00150, 고대: 0.00015, 전설: 0 },
    신비로운: { 일반: 0, 고급: 0.97835, 희귀: 0.02000, 영웅: 0.00150, 고대: 0.00015, 전설: 0 },
    눈부신: { 일반: 0, 고급: 0, 희귀: 0.98900, 영웅: 0.01000, 고대: 0.00100, 전설: 0 },
    영롱한: { 일반: 0, 고급: 0, 희귀: 0.90000, 영웅: 0.09000, 고대: 0.01000, 전설: 0 },
  },
  펫: {
    찬란한: { 일반: 0.70635, 고급: 0.27600, 희귀: 0.01600, 영웅: 0.00150, 고대: 0.00015, 전설: 0 },
    신비로운: { 일반: 0, 고급: 0.97835, 희귀: 0.02000, 영웅: 0.00150, 고대: 0.00015, 전설: 0 },
    눈부신: { 일반: 0, 고급: 0, 희귀: 0.98900, 영웅: 0.01000, 고대: 0.00100, 전설: 0 },
    영롱한: { 일반: 0, 고급: 0, 희귀: 0.90000, 영웅: 0.09000, 고대: 0.01000, 전설: 0 },
  },
  투혼: {
    찬란한: { 일반: 0.66220, 고급: 0.30635, 희귀: 0.02908, 영웅: 0.00217, 고대: 0.00020, 전설: 0 },
    신비로운: { 일반: 0, 고급: 0.92943, 희귀: 0.06802, 영웅: 0.00235, 고대: 0.00020, 전설: 0 },
    눈부신: { 일반: 0, 고급: 0, 희귀: 0.94450, 영웅: 0.05416, 고대: 0.00135, 전설: 0 },
    영롱한: { 일반: 0, 고급: 0, 희귀: 0.90000, 영웅: 0.09000, 고대: 0.01000, 전설: 0 },
  },
  카드: {
    찬란한: { 일반: 0.66220, 고급: 0.30635, 희귀: 0.02908, 영웅: 0.00217, 고대: 0.00020, 전설: 0 },
    신비로운: { 일반: 0, 고급: 0.92943, 희귀: 0.06802, 영웅: 0.00235, 고대: 0.00020, 전설: 0 },
    눈부신: { 일반: 0, 고급: 0, 희귀: 0.94450, 영웅: 0.05416, 고대: 0.00135, 전설: 0 },
    // 카드는 영롱한 없음
  },
};

// 도전 소환권 확률 (1회 = 1번 추첨)
export const CHALLENGE_TICKET_PROBS = {
  클래스: {
    영웅도전: { 희귀: 0.95, 영웅: 0.05 },
    고대도전: { 영웅: 0.86, 고대: 0.14 }, // 클래스만 86/14 (나머지는 88/12)
    전설도전: { 고대: 0.90, 전설: 0.10 },
  },
  펫: {
    영웅도전: { 희귀: 0.95, 영웅: 0.05 },
    고대도전: { 영웅: 0.88, 고대: 0.12 },
    전설도전: { 고대: 0.90, 전설: 0.10 },
  },
  투혼: {
    영웅도전: { 희귀: 0.95, 영웅: 0.05 },
    고대도전: { 영웅: 0.88, 고대: 0.12 },
    전설도전: { 고대: 0.90, 전설: 0.10 },
  },
  카드: {
    영웅도전: { 희귀: 0.95, 영웅: 0.05 },
    고대도전: { 영웅: 0.88, 고대: 0.12 },
    전설도전: { 고대: 0.90, 전설: 0.10 },
  },
};

// 확정 소환권 (1회 = 특정 등급 100%)
export const GUARANTEED_TICKET_GRADES = {
  영웅확정: '영웅',
  고대확정: '고대',
  전설확정: '전설',
};

// ============================================================
// 합성 규칙 (클래스 / 펫)
// (현재등급, 상위등급, 필요개수, 성공확률, 실패반환개수, 천장횟수)
// ============================================================
export const SYNTH_RULES = {
  클래스: [
    { from: '일반', to: '고급',  need: 4, prob: 0.25, returnOnFail: 1, pity: 0 },
    { from: '고급', to: '희귀',  need: 4, prob: 0.20, returnOnFail: 1, pity: 0 },
    { from: '희귀', to: '영웅',  need: 4, prob: 0.18, returnOnFail: 1, pity: 20 },
    { from: '영웅', to: '고대',  need: 4, prob: 0.14, returnOnFail: 1, pity: 15 },
    { from: '고대', to: '전설',  need: 3, prob: 0.10, returnOnFail: 1, pity: 10 },
    // 전설 → 불멸은 합성 불가 (승급식)
  ],
  펫: [
    { from: '일반', to: '고급',  need: 4, prob: 0.25, returnOnFail: 1, pity: 0 },
    { from: '고급', to: '희귀',  need: 4, prob: 0.20, returnOnFail: 1, pity: 0 },
    { from: '희귀', to: '영웅',  need: 4, prob: 0.14, returnOnFail: 1, pity: 20 },
    { from: '영웅', to: '고대',  need: 4, prob: 0.12, returnOnFail: 1, pity: 15 },
    { from: '고대', to: '전설',  need: 3, prob: 0.10, returnOnFail: 1, pity: 10 },
    { from: '전설', to: '불멸',  need: 3, prob: 0.10, returnOnFail: 1, pity: 5 },
  ],
  투혼: [
    { from: '일반', to: '고급',  need: 4, prob: 0.25, returnOnFail: 1, pity: 0 },
    { from: '고급', to: '희귀',  need: 4, prob: 0.20, returnOnFail: 1, pity: 0 },
    { from: '희귀', to: '영웅',  need: 4, prob: 0.14, returnOnFail: 1, pity: 20 },
    { from: '영웅', to: '고대',  need: 4, prob: 0.12, returnOnFail: 1, pity: 15 },
    { from: '고대', to: '전설',  need: 4, prob: 0.10, returnOnFail: 1, pity: 10 },
    // 전설 이상은 강화+승급식으로만
  ],
  카드: [
    { from: '일반', to: '고급',  need: 4, prob: 0.33, returnOnFail: 1, pity: 0 },
    { from: '고급', to: '희귀',  need: 4, prob: 0.28, returnOnFail: 1, pity: 0 },
    { from: '희귀', to: '영웅',  need: 3, prob: 0.23, returnOnFail: 1, pity: 15 },
    { from: '영웅', to: '고대',  need: 3, prob: 0.16, returnOnFail: 1, pity: 10 },
    { from: '고대', to: '전설',  need: 3, prob: 0.12, returnOnFail: 1, pity: 8 },
    // 전설이 카드 최대 (현재)
  ],
};

// 클래스 불멸 승급식 재료 (기운류 제외)
export const CLASS_IMMORTAL_RECIPE = {
  영웅: 50,
  고대: 16,
  전설: 4,
};

// ============================================================
// 투혼 강화 시스템 (경험치 기반)
// ============================================================

// 소환으로 획득한 투혼의 재료 XP
export const SOUL_MATERIAL_XP = {
  일반: 10,
  고급: 100,
  희귀: 3000,
  영웅: 50000,
  고대: 200000,
  전설: 1000000,
};

// 등급별, 단계별 강화 필요 XP [0→1, 1→2, 2→3, 3→4, 4→5]
export const SOUL_ENHANCE_XP = {
  일반:    [20,        40,        80,        160,        320],
  고급:    [200,       400,       800,       1600,       3200],
  희귀:    [3000,      6000,      9000,      12000,      15000],
  영웅:    [50000,     100000,    150000,    200000,     250000],
  고대:    [200000,    400000,    600000,    800000,     1000000],
  전설:    [1000000,   2000000,   3000000,   4000000,    5000000],
  열화불멸:[1000000,   2000000,   3000000,   4000000,    5000000],
};

// 보물 사냥꾼 아이템 XP
export const TREASURE_HUNTER_XP = {
  '미숙한 보물사냥꾼': 20,
  '숙달된 보물사냥꾼': 200,
  '능숙한 보물사냥꾼': 6000,
  '노련한 보물사냥꾼': 100000,
  '대단한 보물사냥꾼': 400000,
  '완벽한 보물사냥꾼': 2000000,
};

// 투혼 불멸 승급 경로
// 전설 5강 × 2 → 열화불멸 (0강)
// 열화불멸 5강 → 불멸 1개
export const SOUL_IMMORTAL_RECIPE = {
  전설5강_to_열화불멸: 2, // 전설 5강 몇 개 필요
};

// ============================================================
// 카드 강화 시스템 (동일 등급 카드 소모)
// CARD_EVOLVE_NEED[등급][단계] = 다음 단계로 가기 위해 필요한 같은 등급 카드 수
// ============================================================
export const CARD_EVOLVE_NEED = {
  일반: [7,  14, 21, 28, 35],
  고급: [4,  8,  12, 16, 20],
  희귀: [2,  4,  6,  8,  10],
  영웅: [1,  2,  3,  4,  5],
  고대: [1,  1,  2,  2,  3],
  전설: [1,  1,  2,  2,  3],
};

// ============================================================
// 각성 시스템 (클래스 / 펫)
// ============================================================

// 클래스 각성 (영웅/고대/전설만, 최대 2단계)
// 각성자 아이템: 노련한/대단한/완벽한 각성자
export const CLASS_AWAKENING = {
  영웅: [
    { need: 5, itemKey: '노련한 각성자', pointGain: 1 }, // 0→1
    { need: 5, itemKey: '노련한 각성자', pointGain: 2 }, // 1→2
  ],
  고대: [
    { need: 4, itemKey: '대단한 각성자', pointGain: 1 },
    { need: 4, itemKey: '대단한 각성자', pointGain: 2 },
  ],
  전설: [
    { need: 2, itemKey: '완벽한 각성자', pointGain: 1 },
    { need: 2, itemKey: '완벽한 각성자', pointGain: 2 },
  ],
  // 불멸: 각성 없음
};

// 펫 각성 (영웅/고대/전설만, 최대 3단계)
// 동반자 아이템: 노련한/대단한/완벽한 동반자
export const PET_AWAKENING = {
  영웅: [
    { need: 5, itemKey: '노련한 동반자', pointGain: 1 }, // 0→1
    { need: 5, itemKey: '노련한 동반자', pointGain: 2 }, // 1→2
    { need: 5, itemKey: '노련한 동반자', pointGain: 2 }, // 2→3
  ],
  고대: [
    { need: 4, itemKey: '대단한 동반자', pointGain: 1 },
    { need: 4, itemKey: '대단한 동반자', pointGain: 2 },
    { need: 4, itemKey: '대단한 동반자', pointGain: 2 },
  ],
  전설: [
    { need: 2, itemKey: '완벽한 동반자', pointGain: 1 },
    { need: 2, itemKey: '완벽한 동반자', pointGain: 2 },
    { need: 2, itemKey: '완벽한 동반자', pointGain: 2 },
  ],
  // 불멸: 각성 없음
};

// ============================================================
// 소환권 이름 → 시스템/티켓 타입 매핑
// 패키지 데이터에서 아이템 이름을 파싱할 때 사용
// ============================================================
export const TICKET_NAME_MAP = [
  // [정규식 패턴, system, ticketType, pulls]
  // 11회 소환권
  { pattern: /찬란한 클래스 11회/,   system: '클래스', type: '찬란한',  pulls: 11 },
  { pattern: /신비로운 클래스 11회/,  system: '클래스', type: '신비로운', pulls: 11 },
  { pattern: /눈부신 클래스 11회/,   system: '클래스', type: '눈부신',  pulls: 11 },
  { pattern: /영롱한 클래스 11회/,   system: '클래스', type: '영롱한',  pulls: 11 },
  { pattern: /찬란한 펫 11회/,       system: '펫',    type: '찬란한',  pulls: 11 },
  { pattern: /신비로운 펫 11회/,      system: '펫',    type: '신비로운', pulls: 11 },
  { pattern: /눈부신 펫 11회/,       system: '펫',    type: '눈부신',  pulls: 11 },
  { pattern: /영롱한 펫 11회/,       system: '펫',    type: '영롱한',  pulls: 11 },
  { pattern: /찬란한 투혼 11회/,     system: '투혼',  type: '찬란한',  pulls: 11 },
  { pattern: /신비로운 투혼 11회/,    system: '투혼',  type: '신비로운', pulls: 11 },
  { pattern: /눈부신 투혼 11회/,     system: '투혼',  type: '눈부신',  pulls: 11 },
  { pattern: /영롱한 투혼 11회/,     system: '투혼',  type: '영롱한',  pulls: 11 },
  { pattern: /찬란한 카드 11회/,     system: '카드',  type: '찬란한',  pulls: 11 },
  { pattern: /신비로운 카드 11회/,    system: '카드',  type: '신비로운', pulls: 11 },
  { pattern: /눈부신 카드 11회/,     system: '카드',  type: '눈부신',  pulls: 11 },
  // 도전 소환권
  { pattern: /영웅 클래스 도전/,     system: '클래스', type: '영웅도전', pulls: 1 },
  { pattern: /고대 클래스 도전/,     system: '클래스', type: '고대도전', pulls: 1 },
  { pattern: /전설 클래스 도전/,     system: '클래스', type: '전설도전', pulls: 1 },
  { pattern: /영웅 펫 도전/,         system: '펫',    type: '영웅도전', pulls: 1 },
  { pattern: /고대 펫 도전/,         system: '펫',    type: '고대도전', pulls: 1 },
  { pattern: /전설 펫 도전/,         system: '펫',    type: '전설도전', pulls: 1 },
  { pattern: /영웅 투혼 도전/,       system: '투혼',  type: '영웅도전', pulls: 1 },
  { pattern: /고대 투혼 도전/,       system: '투혼',  type: '고대도전', pulls: 1 },
  { pattern: /전설 투혼 도전/,       system: '투혼',  type: '전설도전', pulls: 1 },
  { pattern: /영웅 카드 도전/,       system: '카드',  type: '영웅도전', pulls: 1 },
  { pattern: /고대 카드 도전/,       system: '카드',  type: '고대도전', pulls: 1 },
  { pattern: /전설 카드 도전/,       system: '카드',  type: '전설도전', pulls: 1 },
  // 확정 소환권
  { pattern: /영웅 클래스 확정/,     system: '클래스', type: '영웅확정', pulls: 1 },
  { pattern: /고대 클래스 확정/,     system: '클래스', type: '고대확정', pulls: 1 },
  { pattern: /전설 클래스 확정/,     system: '클래스', type: '전설확정', pulls: 1 },
  { pattern: /영웅 펫 확정/,         system: '펫',    type: '영웅확정', pulls: 1 },
  { pattern: /고대 펫 확정/,         system: '펫',    type: '고대확정', pulls: 1 },
  { pattern: /전설 펫 확정/,         system: '펫',    type: '전설확정', pulls: 1 },
  { pattern: /영웅 투혼 확정/,       system: '투혼',  type: '영웅확정', pulls: 1 },
  { pattern: /고대 투혼 확정/,       system: '투혼',  type: '고대확정', pulls: 1 },
  { pattern: /전설 투혼 확정/,       system: '투혼',  type: '전설확정', pulls: 1 },
  { pattern: /영웅 카드 확정/,       system: '카드',  type: '영웅확정', pulls: 1 },
  { pattern: /고대 카드 확정/,       system: '카드',  type: '고대확정', pulls: 1 },
  { pattern: /전설 카드 확정/,       system: '카드',  type: '전설확정', pulls: 1 },
  // 보물 사냥꾼
  { pattern: /미숙한 보물사냥꾼/,    system: null, type: 'treasure', xpKey: '미숙한 보물사냥꾼' },
  { pattern: /숙달된 보물사냥꾼/,    system: null, type: 'treasure', xpKey: '숙달된 보물사냥꾼' },
  { pattern: /능숙한 보물사냥꾼/,    system: null, type: 'treasure', xpKey: '능숙한 보물사냥꾼' },
  { pattern: /노련한 보물사냥꾼/,    system: null, type: 'treasure', xpKey: '노련한 보물사냥꾼' },
  { pattern: /대단한 보물사냥꾼/,    system: null, type: 'treasure', xpKey: '대단한 보물사냥꾼' },
  { pattern: /완벽한 보물사냥꾼/,    system: null, type: 'treasure', xpKey: '완벽한 보물사냥꾼' },
  // 각성 아이템 (클래스)
  { pattern: /노련한 각성자/,        system: null, type: 'awakening_class', itemKey: '노련한 각성자' },
  { pattern: /대단한 각성자/,        system: null, type: 'awakening_class', itemKey: '대단한 각성자' },
  { pattern: /완벽한 각성자/,        system: null, type: 'awakening_class', itemKey: '완벽한 각성자' },
  // 각성 아이템 (펫)
  { pattern: /노련한 동반자/,        system: null, type: 'awakening_pet', itemKey: '노련한 동반자' },
  { pattern: /대단한 동반자/,        system: null, type: 'awakening_pet', itemKey: '대단한 동반자' },
  { pattern: /완벽한 동반자/,        system: null, type: 'awakening_pet', itemKey: '완벽한 동반자' },
];

// 몬테카를로 시뮬레이션 반복 횟수 (많을수록 정확, 느림)
export const SIMULATION_RUNS = 500;
