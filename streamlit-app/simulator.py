"""
simulator.py - Monte Carlo 시뮬레이션 엔진
JavaScript simulator.js의 Python 포팅
"""
import random
import copy
from constants import (
    GRADES, TICKET_PROBS, CHALLENGE_TICKET_PROBS, GUARANTEED_TICKET_GRADES,
    SYNTH_RULES, CLASS_IMMORTAL_RECIPE, SOUL_MATERIAL_XP, SOUL_ENHANCE_XP,
    SOUL_IMMORTAL_RECIPE, CARD_EVOLVE_NEED, CLASS_AWAKENING, PET_AWAKENING,
    SIMULATION_RUNS, PLC_THRESHOLD, TREASURE_HUNTER_XP,
    TICKET_NAME_MAP, TREASURE_NAME_MAP, AWAKENING_CLASS_MAP, AWAKENING_PET_MAP,
)


def random_grade(probs):
    """확률 기반 랜덤 등급 선택"""
    r = random.random()
    cumul = 0.0
    last_grade = None
    for grade, prob in probs.items():
        if prob <= 0:
            continue
        last_grade = grade
        cumul += prob
        if r < cumul:
            return grade
    return last_grade


def create_inventory():
    """빈 인벤토리 생성"""
    grade_count = lambda: {g: 0 for g in GRADES}
    return {
        '클래스': grade_count(),
        '펫': grade_count(),
        '투혼': {
            'xpPool': 0,
            'enhanced': {},
            'gradeCount': grade_count(),
            'produced': {},
        },
        '카드': {
            'gradeCount': grade_count(),
        },
        'awakening': {
            '클래스': {'영웅': 0, '고대': 0, '전설': 0},
            '펫': {'영웅': 0, '고대': 0, '전설': 0},
        },
        'awakeningItems': {
            '클래스': {'노련한 각성자': 0, '대단한 각성자': 0, '완벽한 각성자': 0},
            '펫': {'노련한 동반자': 0, '대단한 동반자': 0, '완벽한 동반자': 0},
        },
        'treasureXP': 0,
    }


def create_inventory_from_spec(spec):
    """유저 스펙 → 시뮬레이터 인벤토리 변환"""
    inv = create_inventory()
    for grade in ['영웅', '고대', '전설', '불멸']:
        inv['클래스'][grade] = spec.get('클래스', {}).get(grade, 0)
        inv['펫'][grade] = spec.get('펫', {}).get(grade, 0)
    for grade in ['영웅', '고대', '전설']:
        inv['투혼']['gradeCount'][grade] = spec.get('투혼', {}).get(grade, 0)
    inv['투혼']['enhanced']['불멸'] = spec.get('투혼', {}).get('불멸', 0)
    inv['카드']['gradeCount']['전설'] = spec.get('카드', {}).get('전설', 0)
    inv['카드']['gradeCount']['고대'] = spec.get('카드', {}).get('고대', 0)
    for grade in ['영웅', '고대', '전설']:
        inv['awakening']['클래스'][grade] = spec.get('클래스', {}).get(f'{grade}각성', 0)
        inv['awakening']['펫'][grade] = spec.get('펫', {}).get(f'{grade}각성', 0)
    return inv


def add_to_inventory(inv, system, grade):
    if system == '클래스':
        inv['클래스'][grade] = inv['클래스'].get(grade, 0) + 1
    elif system == '펫':
        inv['펫'][grade] = inv['펫'].get(grade, 0) + 1
    elif system == '투혼':
        inv['투혼']['gradeCount'][grade] = inv['투혼']['gradeCount'].get(grade, 0) + 1
    elif system == '카드':
        inv['카드']['gradeCount'][grade] = inv['카드']['gradeCount'].get(grade, 0) + 1


def use_ticket(inv, system, ticket_type, pulls):
    """소환권 사용"""
    if system in CHALLENGE_TICKET_PROBS and ticket_type in CHALLENGE_TICKET_PROBS[system]:
        probs = CHALLENGE_TICKET_PROBS[system][ticket_type]
    elif ticket_type in GUARANTEED_TICKET_GRADES:
        grade = GUARANTEED_TICKET_GRADES[ticket_type]
        for _ in range(pulls):
            add_to_inventory(inv, system, grade)
        return
    elif system in TICKET_PROBS and ticket_type in TICKET_PROBS.get(system, {}):
        probs = TICKET_PROBS[system][ticket_type]
    else:
        return

    for _ in range(pulls):
        grade = random_grade(probs)
        add_to_inventory(inv, system, grade)


def apply_synthesis(inv, system, rules, pity_state, plc_max=None):
    """합성 처리 (클래스/펫) - PLC 80% 차단"""
    sys_plc = (plc_max or {}).get(system, {})
    changed = True
    while changed:
        changed = False
        for rule in rules:
            frm, to = rule['from'], rule['to']
            need, prob = rule['need'], rule['prob']
            return_on_fail, pity = rule['returnOnFail'], rule['pity']
            src = inv['클래스'] if system == '클래스' else inv['펫']

            to_plc = sys_plc.get(to, 0)
            if to_plc > 0 and src.get(to, 0) >= to_plc * PLC_THRESHOLD:
                continue

            while src.get(frm, 0) >= need:
                key = f'{frm}->{to}'
                pity_state[key] = pity_state.get(key, 0)

                success = (pity > 0 and pity_state[key] >= pity) or random.random() < prob
                src[frm] -= need

                if success:
                    src[to] = src.get(to, 0) + 1
                    if to_plc > 0 and src.get(to, 0) >= to_plc * PLC_THRESHOLD:
                        changed = True
                        pity_state[key] = 0
                        break
                    pity_state[key] = 0
                    changed = True
                else:
                    src[frm] += return_on_fail
                    pity_state[key] += 1


def apply_class_immortal_upgrade(inv):
    """클래스 불멸 승급"""
    while True:
        can = (
            inv['클래스'].get('영웅', 0) >= CLASS_IMMORTAL_RECIPE['영웅'] and
            inv['클래스'].get('고대', 0) >= CLASS_IMMORTAL_RECIPE['고대'] and
            inv['클래스'].get('전설', 0) >= CLASS_IMMORTAL_RECIPE['전설']
        )
        if not can:
            break
        inv['클래스']['영웅'] -= CLASS_IMMORTAL_RECIPE['영웅']
        inv['클래스']['고대'] -= CLASS_IMMORTAL_RECIPE['고대']
        inv['클래스']['전설'] -= CLASS_IMMORTAL_RECIPE['전설']
        inv['클래스']['불멸'] = inv['클래스'].get('불멸', 0) + 1


def apply_soul_enhancement(inv):
    """투혼 강화"""
    gc = inv['투혼']['gradeCount']
    total_xp_for_5 = sum(SOUL_ENHANCE_XP['전설'])

    xp_pool = inv['treasureXP']
    for grade in GRADES:
        cnt = gc.get(grade, 0)
        if cnt > 0 and grade in SOUL_MATERIAL_XP:
            xp_pool += cnt * SOUL_MATERIAL_XP[grade]
            gc[grade] = 0
    inv['treasureXP'] = 0

    legend_count_5 = xp_pool // total_xp_for_5
    remain_xp = xp_pool % total_xp_for_5

    yeolhwa_count = legend_count_5 // SOUL_IMMORTAL_RECIPE['전설5강_to_열화불멸']
    remain_legend_5 = legend_count_5 % SOUL_IMMORTAL_RECIPE['전설5강_to_열화불멸']

    immortal_count = yeolhwa_count

    enhanced = inv['투혼'].setdefault('enhanced', {})
    enhanced['불멸'] = enhanced.get('불멸', 0) + immortal_count
    enhanced['열화불멸_5강'] = enhanced.get('열화불멸_5강', 0) + (yeolhwa_count - immortal_count)
    enhanced['전설_5강_잔여'] = remain_legend_5
    enhanced['전설_5강_총'] = legend_count_5
    enhanced['전설_진행중_xp'] = remain_xp
    enhanced['총_xp'] = xp_pool


def apply_card_enhancement(inv):
    """카드 강화"""
    enhanced = inv['카드'].setdefault('enhanced', {})
    gc = inv['카드']['gradeCount']

    for grade in ['일반', '고급', '희귀', '영웅', '고대', '전설']:
        needs = CARD_EVOLVE_NEED.get(grade, [0]*5)
        available = gc.get(grade, 0)
        level = 0
        for lv in range(5):
            if available >= needs[lv]:
                available -= needs[lv]
                level = lv + 1
            else:
                break
        enhanced[grade] = {'maxLevel': level, 'remaining': available}
        gc[grade] = available


def apply_awakening(inv, plc_max=None):
    """각성 처리 (클래스/펫) - PLC 80% 게이트"""
    # 클래스
    class_plc = (plc_max or {}).get('클래스', {})
    for grade, steps in CLASS_AWAKENING.items():
        grade_target = class_plc.get(grade, 0)
        if grade_target > 0 and inv['클래스'].get(grade, 0) < grade_target * PLC_THRESHOLD:
            continue
        items = inv['awakeningItems']['클래스']
        for step_idx, step in enumerate(steps):
            need, item_key, point_gain = step['need'], step['itemKey'], step['pointGain']
            point_needed = sum(s['pointGain'] for s in steps[:step_idx + 1])
            if inv['awakening']['클래스'].get(grade, 0) >= point_needed:
                continue
            if items.get(item_key, 0) >= need:
                items[item_key] -= need
                inv['awakening']['클래스'][grade] = inv['awakening']['클래스'].get(grade, 0) + point_gain
                continue
            if inv['클래스'].get(grade, 0) >= need:
                inv['클래스'][grade] -= need
                inv['awakening']['클래스'][grade] = inv['awakening']['클래스'].get(grade, 0) + point_gain

    # 펫
    pet_plc = (plc_max or {}).get('펫', {})
    for grade, steps in PET_AWAKENING.items():
        grade_target = pet_plc.get(grade, 0)
        if grade_target > 0 and inv['펫'].get(grade, 0) < grade_target * PLC_THRESHOLD:
            continue
        items = inv['awakeningItems']['펫']
        for step_idx, step in enumerate(steps):
            need, item_key, point_gain = step['need'], step['itemKey'], step['pointGain']
            point_needed = sum(s['pointGain'] for s in steps[:step_idx + 1])
            if inv['awakening']['펫'].get(grade, 0) >= point_needed:
                continue
            if items.get(item_key, 0) >= need:
                items[item_key] -= need
                inv['awakening']['펫'][grade] = inv['awakening']['펫'].get(grade, 0) + point_gain
                continue
            if inv['펫'].get(grade, 0) >= need:
                inv['펫'][grade] -= need
                inv['awakening']['펫'][grade] = inv['awakening']['펫'].get(grade, 0) + point_gain


def apply_synthesis_for_soul(inv, pity_state, plc_max=None):
    """투혼 합성 - PLC 80% 차단"""
    produced = inv['투혼'].setdefault('produced', {})
    sys_plc = (plc_max or {}).get('투혼', {})
    changed = True
    while changed:
        changed = False
        for rule in SYNTH_RULES['투혼']:
            gc = inv['투혼']['gradeCount']
            frm, to = rule['from'], rule['to']
            need, prob = rule['need'], rule['prob']
            return_on_fail, pity = rule['returnOnFail'], rule['pity']

            to_plc = sys_plc.get(to, 0)
            if plc_max and to_plc > 0 and gc.get(to, 0) >= to_plc * PLC_THRESHOLD:
                continue

            while gc.get(frm, 0) >= need:
                key = f'{frm}->{to}'
                pity_state[key] = pity_state.get(key, 0)
                success = (pity > 0 and pity_state[key] >= pity) or random.random() < prob
                gc[frm] -= need
                if success:
                    gc[to] = gc.get(to, 0) + 1
                    produced[to] = produced.get(to, 0) + 1
                    pity_state[key] = 0
                    changed = True
                    if plc_max and to_plc > 0 and gc.get(to, 0) >= to_plc * PLC_THRESHOLD:
                        break
                else:
                    gc[frm] += return_on_fail
                    pity_state[key] += 1


def apply_synthesis_for_card(inv, pity_state, plc_max=None):
    """카드 합성 - PLC 80% 차단"""
    sys_plc = (plc_max or {}).get('카드', {})
    changed = True
    while changed:
        changed = False
        for rule in SYNTH_RULES['카드']:
            gc = inv['카드']['gradeCount']
            frm, to = rule['from'], rule['to']
            need, prob = rule['need'], rule['prob']
            return_on_fail, pity = rule['returnOnFail'], rule['pity']

            to_plc = sys_plc.get(to, 0)
            if plc_max and to_plc > 0 and gc.get(to, 0) >= to_plc * PLC_THRESHOLD:
                continue

            while gc.get(frm, 0) >= need:
                key = f'{frm}->{to}'
                pity_state[key] = pity_state.get(key, 0)
                success = (pity > 0 and pity_state[key] >= pity) or random.random() < prob
                gc[frm] -= need
                if success:
                    gc[to] = gc.get(to, 0) + 1
                    pity_state[key] = 0
                    changed = True
                    if plc_max and to_plc > 0 and gc.get(to, 0) >= to_plc * PLC_THRESHOLD:
                        break
                else:
                    gc[frm] += return_on_fail
                    pity_state[key] += 1


def parse_item(name, quantity):
    """아이템 이름 → ticketItem 변환"""
    # 보물사냥꾼 체크
    for pattern, xp_key in TREASURE_NAME_MAP:
        if pattern in name:
            return {'system': xp_key, 'ticketType': 'treasure', 'pulls': 0, 'quantity': quantity}

    # 각성 아이템 (클래스)
    for pattern, item_key in AWAKENING_CLASS_MAP:
        if pattern in name:
            return {'system': item_key, 'ticketType': 'awakening_class', 'pulls': 0, 'quantity': quantity}

    # 각성 아이템 (펫)
    for pattern, item_key in AWAKENING_PET_MAP:
        if pattern in name:
            return {'system': item_key, 'ticketType': 'awakening_pet', 'pulls': 0, 'quantity': quantity}

    # 일반 소환권
    for pattern, system, ticket_type, pulls in TICKET_NAME_MAP:
        if pattern in name:
            return {'system': system, 'ticketType': ticket_type, 'pulls': pulls, 'quantity': quantity}

    return None


def parse_package_items(items):
    """패키지 아이템 목록 → ticketItems 배열"""
    result = []
    for item in items:
        parsed = parse_item(item['name'], item.get('quantity', 0))
        if parsed:
            result.append(parsed)
    return result


def apply_package(inv, ticket_items, pity_state, plc_max=None):
    """패키지 1개 적용"""
    for item in ticket_items:
        system = item['system']
        ticket_type = item['ticketType']
        quantity = item['quantity']

        if ticket_type == 'treasure':
            inv['treasureXP'] += (TREASURE_HUNTER_XP.get(system, 0)) * quantity
            continue
        if ticket_type == 'awakening_class':
            inv['awakeningItems']['클래스'][system] = inv['awakeningItems']['클래스'].get(system, 0) + quantity
            continue
        if ticket_type == 'awakening_pet':
            inv['awakeningItems']['펫'][system] = inv['awakeningItems']['펫'].get(system, 0) + quantity
            continue

        pulls = item['pulls']
        for _ in range(quantity):
            use_ticket(inv, system, ticket_type, pulls)

    # 클래스/펫: 합성(PLC) → 각성 → 잔여 합성
    apply_synthesis(inv, '클래스', SYNTH_RULES['클래스'], pity_state['클래스'], plc_max)
    apply_awakening(inv, plc_max)
    apply_synthesis(inv, '클래스', SYNTH_RULES['클래스'], pity_state['클래스'])

    apply_synthesis(inv, '펫', SYNTH_RULES['펫'], pity_state['펫'], plc_max)
    apply_awakening(inv, plc_max)
    apply_synthesis(inv, '펫', SYNTH_RULES['펫'], pity_state['펫'])

    # 투혼: 합성(PLC) → 성장 → 잔여 합성
    apply_synthesis_for_soul(inv, pity_state['투혼'], plc_max)
    apply_soul_enhancement(inv)
    apply_synthesis_for_soul(inv, pity_state['투혼'])

    # 카드: 합성(PLC) → 성장 → 잔여 합성
    apply_synthesis_for_card(inv, pity_state['카드'], plc_max)
    inv['카드']['preEnhance'] = dict(inv['카드']['gradeCount'])
    apply_card_enhancement(inv)
    apply_synthesis_for_card(inv, pity_state['카드'])


def take_snapshot(inv):
    """현재 인벤토리 스냅샷"""
    soul_produced = inv['투혼'].get('produced', {})
    soul_enhanced = inv['투혼'].get('enhanced', {})
    legend_total = soul_enhanced.get('전설_5강_총', 0)

    return {
        '클래스': {
            '불멸': inv['클래스'].get('불멸', 0),
            '전설': inv['클래스'].get('전설', 0),
            '고대': inv['클래스'].get('고대', 0),
            '영웅': inv['클래스'].get('영웅', 0),
            '영웅각성': inv['awakening']['클래스'].get('영웅', 0),
            '고대각성': inv['awakening']['클래스'].get('고대', 0),
            '전설각성': inv['awakening']['클래스'].get('전설', 0),
        },
        '펫': {
            '불멸': inv['펫'].get('불멸', 0),
            '전설': inv['펫'].get('전설', 0),
            '고대': inv['펫'].get('고대', 0),
            '영웅': inv['펫'].get('영웅', 0),
            '영웅각성': inv['awakening']['펫'].get('영웅', 0),
            '고대각성': inv['awakening']['펫'].get('고대', 0),
            '전설각성': inv['awakening']['펫'].get('전설', 0),
        },
        '투혼': {
            '불멸': soul_enhanced.get('불멸', 0),
            '전설': legend_total,
            '고대': soul_produced.get('고대', 0),
        },
        '카드': {
            '전설': inv['카드'].get('preEnhance', {}).get('전설', 0),
            '고대': inv['카드'].get('preEnhance', {}).get('고대', 0),
            '영웅': inv['카드'].get('preEnhance', {}).get('영웅', 0),
        },
    }


def run_simulation(packages, start_inventory, plc_max, num_runs=None):
    """Monte Carlo 시뮬레이션 실행"""
    if num_runs is None:
        num_runs = SIMULATION_RUNS

    all_runs = []
    for _ in range(num_runs):
        inv = copy.deepcopy(start_inventory)
        pity_state = {'클래스': {}, '펫': {}, '투혼': {}, '카드': {}}
        snapshots = []

        for pkg in packages:
            apply_package(inv, pkg['ticketItems'], pity_state, plc_max)
            snapshots.append({'date': pkg['date'], 'snapshot': take_snapshot(inv)})

        all_runs.append(snapshots)

    return average_snapshots(all_runs)


def average_snapshots(all_runs):
    """모든 실행 결과 평균"""
    if not all_runs:
        return []
    n = len(all_runs)

    result = []
    for i in range(len(all_runs[0])):
        date = all_runs[0][i]['date']
        avg = {}

        for system in ['클래스', '펫', '투혼', '카드']:
            avg[system] = {}
            keys = all_runs[0][i]['snapshot'][system].keys()
            for key in keys:
                total = sum(run[i]['snapshot'][system].get(key, 0) for run in all_runs)
                avg[system][key] = total / n

        result.append({'date': date, 'snapshot': avg})

    return result
