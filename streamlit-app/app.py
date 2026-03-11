"""
app.py - 캐릭터 성장 시뮬레이터 (Streamlit)
BM 기획자용 캐릭터 성장 시뮬레이션 및 상품 분석 도구
"""
import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import re
import os
import math

from constants import (
    GRADES, SYSTEMS, DEFAULT_PLC_MAX, DEFAULT_USER_SPEC,
    SIMULATION_RUNS, SYNTH_RULES, CLASS_IMMORTAL_RECIPE,
    TICKET_PROBS, CHALLENGE_TICKET_PROBS, GUARANTEED_TICKET_GRADES,
    TREASURE_HUNTER_XP, SOUL_MATERIAL_XP,
)
from simulator import (
    run_simulation, create_inventory_from_spec, parse_package_items,
)
from excel_parser import parse_bm_excel, parse_sales_excel, extract_date_label

# ============================================================
# 페이지 설정
# ============================================================
st.set_page_config(
    page_title="캐릭터 성장 시뮬레이터",
    page_icon="⚔️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ============================================================
# 고대 환산 유틸리티
# ============================================================
def expected_attempts(prob, pity):
    if prob >= 1:
        return 1
    if pity > 0:
        return (1 - (1 - prob) ** pity) / prob
    return 1 / prob


def synth_expected_cost(rule):
    need, prob, return_on_fail, pity = rule['need'], rule['prob'], rule['returnOnFail'], rule['pity']
    e = expected_attempts(prob, pity)
    return need + (e - 1) * (need - return_on_fail)


def compute_godae_values(system):
    values = {'고대': 1.0}
    rules = SYNTH_RULES.get(system, [])
    cost_of = {}
    for rule in rules:
        cost_of[f"{rule['from']}→{rule['to']}"] = synth_expected_cost(rule)

    for _ in range(6):
        for rule in rules:
            key = f"{rule['from']}→{rule['to']}"
            if rule['to'] in values and rule['from'] not in values:
                values[rule['from']] = values[rule['to']] / cost_of[key]

    for _ in range(3):
        for rule in rules:
            key = f"{rule['from']}→{rule['to']}"
            if rule['from'] in values and rule['to'] not in values:
                values[rule['to']] = cost_of[key] * values[rule['from']]

    if system == '클래스' and '불멸' not in values:
        values['불멸'] = (
            CLASS_IMMORTAL_RECIPE.get('영웅', 0) * values.get('영웅', 0) +
            CLASS_IMMORTAL_RECIPE.get('고대', 0) * 1 +
            CLASS_IMMORTAL_RECIPE.get('전설', 0) * values.get('전설', 0)
        )
    return values


_cached_gdv = None
def get_godae_values():
    global _cached_gdv
    if _cached_gdv is None:
        _cached_gdv = {sys: compute_godae_values(sys) for sys in SYSTEMS}
    return _cached_gdv


def expected_drops(system, ticket_type, pulls):
    if ticket_type in GUARANTEED_TICKET_GRADES:
        return {GUARANTEED_TICKET_GRADES[ticket_type]: pulls}
    probs = None
    if system in CHALLENGE_TICKET_PROBS and ticket_type in CHALLENGE_TICKET_PROBS.get(system, {}):
        probs = CHALLENGE_TICKET_PROBS[system][ticket_type]
    elif system in TICKET_PROBS and ticket_type in TICKET_PROBS.get(system, {}):
        probs = TICKET_PROBS[system][ticket_type]
    if not probs:
        return {}
    return {grade: pulls * prob for grade, prob in probs.items() if prob > 0}


def calc_godae_equivalent(ticket_items):
    result = {'클래스': 0, '펫': 0, '투혼': 0, '카드': 0}
    gdv = get_godae_values()
    for item in ticket_items:
        system, ticket_type, pulls, quantity = item['system'], item['ticketType'], item['pulls'], item['quantity']
        if ticket_type == 'treasure':
            xp = TREASURE_HUNTER_XP.get(system, 0) * quantity
            result['투혼'] += xp * gdv['투혼'].get('고대', 0) / SOUL_MATERIAL_XP.get('고대', 200000)
            continue
        if ticket_type in ('awakening_class', 'awakening_pet'):
            continue
        if not system:
            continue
        drops = expected_drops(system, ticket_type, pulls)
        for grade, count in drops.items():
            result[system] += count * quantity * gdv.get(system, {}).get(grade, 0)
    return result


# ============================================================
# 세션 상태 초기화
# ============================================================
if 'plc_max' not in st.session_state:
    import copy
    st.session_state.plc_max = copy.deepcopy(DEFAULT_PLC_MAX)

if 'user_spec' not in st.session_state:
    import copy
    st.session_state.user_spec = copy.deepcopy(DEFAULT_USER_SPEC)

if 'bm_groups' not in st.session_state:
    st.session_state.bm_groups = []

if 'sales_data' not in st.session_state:
    st.session_state.sales_data = {}

if 'sim_result' not in st.session_state:
    st.session_state.sim_result = None


def group_packages_by_date(packages):
    groups = {}
    for pkg in packages:
        m = re.match(r'^\[(\d{4})\]', pkg['name'])
        key = m.group(1) if m else '기타'
        if key not in groups:
            mm = key[:2] if key != '기타' else ''
            dd = key[2:4] if key != '기타' else ''
            label = f'{int(mm)}월 {int(dd)}일 기획서' if key != '기타' else '기타 패키지'
            groups[key] = {'dateKey': key, 'label': label, 'packages': []}
        groups[key]['packages'].append(pkg)
    return list(groups.values())


def normalize_name(name):
    name = re.sub(r'^\[\d{4}\]\s*', '', name)
    name = re.sub(r'\s*\(.*?\)\s*$', '', name)
    return name.strip()


def get_rate(value, max_val):
    if not max_val:
        return 0
    return min(100, round(value / max_val * 1000) / 10)


def fmt_num(v):
    if v >= 0.01:
        return f'{v:.2f}'
    elif v > 0:
        return f'{v:.4f}'
    return '0'


def fmt_won(v):
    if v:
        return f'{int(round(v)):,}'
    return '-'


# ============================================================
# 사이드바
# ============================================================
with st.sidebar:
    st.title("⚔️ 캐릭터 성장 시뮬레이터")

    tab_sidebar = st.radio("설정", ["유저 스펙", "기획서 업로드", "PLC 설정"], horizontal=True)

    if tab_sidebar == "유저 스펙":
        st.subheader("현재 보유 스펙")
        spec = st.session_state.user_spec

        for sys_name in ['클래스', '펫']:
            st.markdown(f"**{sys_name}**")
            cols = st.columns(4)
            for i, grade in enumerate(['영웅', '고대', '전설', '불멸']):
                with cols[i]:
                    spec[sys_name][grade] = st.number_input(
                        grade, min_value=0, value=spec[sys_name].get(grade, 0),
                        key=f'spec_{sys_name}_{grade}', label_visibility="visible"
                    )
            cols2 = st.columns(3)
            for i, grade in enumerate(['영웅각성', '고대각성', '전설각성']):
                with cols2[i]:
                    spec[sys_name][grade] = st.number_input(
                        grade, min_value=0, value=spec[sys_name].get(grade, 0),
                        key=f'spec_{sys_name}_{grade}', label_visibility="visible"
                    )

        st.markdown("**투혼**")
        cols = st.columns(4)
        for i, grade in enumerate(['영웅', '고대', '전설', '불멸']):
            with cols[i]:
                spec['투혼'][grade] = st.number_input(
                    grade, min_value=0, value=spec['투혼'].get(grade, 0),
                    key=f'spec_투혼_{grade}', label_visibility="visible"
                )

        st.markdown("**카드**")
        cols = st.columns(2)
        for i, grade in enumerate(['고대', '전설']):
            with cols[i]:
                spec['카드'][grade] = st.number_input(
                    grade, min_value=0, value=spec['카드'].get(grade, 0),
                    key=f'spec_카드_{grade}', label_visibility="visible"
                )

    elif tab_sidebar == "기획서 업로드":
        st.subheader("BM 기획서 업로드")
        bm_files = st.file_uploader(
            "BM기획서 Excel (.xlsx)", type=['xlsx'], accept_multiple_files=True,
            key='bm_uploader'
        )
        if bm_files:
            for f in bm_files:
                date_key, label = extract_date_label(f.name)
                # 중복 체크
                existing = [g for g in st.session_state.bm_groups if g['dateKey'] == date_key]
                if not existing:
                    pkgs = parse_bm_excel(f.read(), f.name)
                    if pkgs:
                        st.session_state.bm_groups.append({
                            'dateKey': date_key, 'label': label, 'packages': pkgs,
                        })
                        st.success(f"✅ {label}: {len(pkgs)}개 패키지 로드")
                    else:
                        st.warning(f"⚠️ {f.name}: 패키지를 찾을 수 없음")

        # 자동 로드: BM기획서 폴더
        bm_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'BM기획서')
        if os.path.exists(bm_dir) and not st.session_state.bm_groups:
            auto_files = sorted([f for f in os.listdir(bm_dir) if re.match(r'^\d{4}BM\.xlsx$', f, re.IGNORECASE)])
            if auto_files:
                with st.spinner('BM기획서 자동 로드 중...'):
                    for fname in auto_files:
                        date_key, label = extract_date_label(fname)
                        filepath = os.path.join(bm_dir, fname)
                        with open(filepath, 'rb') as fh:
                            pkgs = parse_bm_excel(fh.read(), fname)
                        if pkgs:
                            st.session_state.bm_groups.append({
                                'dateKey': date_key, 'label': label, 'packages': pkgs,
                            })
                st.rerun()

        # 현재 로드된 기획서 목록
        if st.session_state.bm_groups:
            st.markdown("---")
            st.markdown("**로드된 기획서**")
            for g in sorted(st.session_state.bm_groups, key=lambda x: x['dateKey'], reverse=True):
                st.markdown(f"- {g['label']} ({len(g['packages'])}개 패키지)")

            if st.button("🗑️ 전체 초기화", key='clear_bm'):
                st.session_state.bm_groups = []
                st.session_state.sim_result = None
                st.rerun()

        # 매출지표 업로드
        st.markdown("---")
        st.subheader("매출지표 업로드")
        sales_files = st.file_uploader(
            "매출지표 Excel (.xlsx)", type=['xlsx'], accept_multiple_files=True,
            key='sales_uploader'
        )
        if sales_files:
            for f in sales_files:
                date_key, _ = extract_date_label(f.name)
                if date_key not in st.session_state.sales_data:
                    result = parse_sales_excel(f.read())
                    if result:
                        st.session_state.sales_data[date_key] = result
                        st.success(f"✅ 매출지표 로드: {len(result['items'])}개 아이템")

        # 자동 로드: 매출지표 폴더
        sales_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), '매출지표')
        if os.path.exists(sales_dir) and not st.session_state.sales_data:
            auto_sales = sorted([f for f in os.listdir(sales_dir) if re.match(r'^\d{4}BM\.xlsx$', f, re.IGNORECASE)])
            if auto_sales:
                for fname in auto_sales:
                    date_key, _ = extract_date_label(fname)
                    filepath = os.path.join(sales_dir, fname)
                    with open(filepath, 'rb') as fh:
                        result = parse_sales_excel(fh.read())
                    if result:
                        st.session_state.sales_data[date_key] = result
                if st.session_state.sales_data:
                    st.rerun()

    elif tab_sidebar == "PLC 설정":
        st.subheader("PLC 라이브 최대치")
        plc = st.session_state.plc_max

        for sys_name in SYSTEMS:
            st.markdown(f"**{sys_name}**")
            keys = list(plc[sys_name].keys())
            cols = st.columns(min(len(keys), 4))
            for i, grade in enumerate(keys):
                with cols[i % min(len(keys), 4)]:
                    plc[sys_name][grade] = st.number_input(
                        grade, min_value=0, value=plc[sys_name].get(grade, 0),
                        key=f'plc_{sys_name}_{grade}', label_visibility="visible"
                    )

    # 시뮬레이션 실행 버튼
    st.markdown("---")
    total_pkgs = sum(len(g['packages']) for g in st.session_state.bm_groups)
    st.caption(f"{len(st.session_state.bm_groups)}개 기획서 · {total_pkgs}개 패키지")

    if st.button("▶️ 시뮬레이션 실행", type="primary", disabled=total_pkgs == 0, use_container_width=True):
        with st.spinner(f'Monte Carlo {SIMULATION_RUNS}회 시뮬레이션 중...'):
            pkgs_for_sim = []
            for g in st.session_state.bm_groups:
                all_items = []
                for p in g['packages']:
                    if p['items']:
                        all_items.extend(parse_package_items(p['items']))
                if all_items:
                    pkgs_for_sim.append({'date': g['label'], 'ticketItems': all_items})

            if pkgs_for_sim:
                start_inv = create_inventory_from_spec(st.session_state.user_spec)
                result = run_simulation(pkgs_for_sim, start_inv, st.session_state.plc_max)
                st.session_state.sim_result = result
                st.success("시뮬레이션 완료!")
                st.rerun()


# ============================================================
# 메인 영역
# ============================================================
if not st.session_state.bm_groups:
    st.info("👈 사이드바에서 BM기획서를 업로드하세요. BM기획서 폴더가 있으면 자동으로 로드됩니다.")
    st.stop()

# 탭 구성
tab_names = ["상품 분석"]
if st.session_state.sim_result:
    tab_names = ["클래스", "펫", "투혼", "카드", "전체 표", "상품 분석"]

tabs = st.tabs(tab_names)

# ============================================================
# 시뮬레이션 결과 탭 (클래스/펫/투혼/카드)
# ============================================================
SYSTEM_METRICS = {
    '클래스': [
        ('불멸', '불멸', '#dc2626'), ('전설', '전설', '#f97316'), ('고대', '고대', '#eab308'),
        ('전설각성', '전설 각성', '#e11d48'), ('고대각성', '고대 각성', '#d97706'), ('영웅각성', '영웅 각성', '#65a30d'),
    ],
    '펫': [
        ('불멸', '불멸', '#dc2626'), ('전설', '전설', '#f97316'), ('고대', '고대', '#eab308'),
        ('전설각성', '전설 각성', '#e11d48'), ('고대각성', '고대 각성', '#d97706'), ('영웅각성', '영웅 각성', '#65a30d'),
    ],
    '투혼': [
        ('불멸', '불멸', '#dc2626'), ('전설', '전설', '#f97316'), ('고대', '고대', '#eab308'),
    ],
    '카드': [
        ('전설', '전설', '#0891b2'), ('고대', '고대', '#7c3aed'),
    ],
}

if st.session_state.sim_result:
    sim_result = st.session_state.sim_result
    plc = st.session_state.plc_max

    for tab_idx, sys_name in enumerate(['클래스', '펫', '투혼', '카드']):
        with tabs[tab_idx]:
            st.subheader(f"{sys_name} 달성률 추이")
            metrics = SYSTEM_METRICS[sys_name]

            fig = go.Figure()
            dates = [r['date'] for r in sim_result]

            for key, label, color in metrics:
                plc_path = sys_name
                plc_val = plc.get(plc_path, {}).get(key, 0)
                values = []
                raw_values = []
                for r in sim_result:
                    raw = r['snapshot'].get(sys_name, {}).get(key, 0)
                    raw_values.append(round(raw, 2))
                    rate = get_rate(raw, plc_val)
                    values.append(rate)

                dash = 'dash' if '각성' in key else 'solid'
                fig.add_trace(go.Scatter(
                    x=dates, y=values, name=f'{label} ({plc_val})',
                    line=dict(color=color, width=2.5, dash=dash),
                    hovertemplate=f'{label}: %{{y:.1f}}% (%{{customdata:.2f}}/{plc_val})<extra></extra>',
                    customdata=raw_values,
                ))

            fig.update_layout(
                yaxis_title='달성률 (%)',
                yaxis=dict(range=[0, 105]),
                legend=dict(orientation='h', yanchor='bottom', y=1.02, xanchor='right', x=1),
                height=500,
                template='plotly_dark',
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)',
            )
            fig.add_hline(y=100, line_dash='dot', line_color='rgba(255,255,255,0.3)')
            st.plotly_chart(fig, use_container_width=True)

            # 수치 표
            st.markdown("**날짜별 상세**")
            table_data = {'기획서': dates}
            for key, label, _ in metrics:
                plc_val = plc.get(sys_name, {}).get(key, 0)
                table_data[f'{label} (수량)'] = [
                    f"{r['snapshot'].get(sys_name, {}).get(key, 0):.2f}" for r in sim_result
                ]
                table_data[f'{label} (달성률)'] = [
                    f"{get_rate(r['snapshot'].get(sys_name, {}).get(key, 0), plc_val):.1f}%"
                    for r in sim_result
                ]
            st.dataframe(pd.DataFrame(table_data), use_container_width=True, hide_index=True)

    # 전체 표 탭
    with tabs[4]:
        st.subheader("전체 지표 표")
        table_rows = [
            ('클래스 불멸', '클래스', '불멸'), ('클래스 전설', '클래스', '전설'), ('클래스 고대', '클래스', '고대'),
            ('클래스 전설각성', '클래스', '전설각성'), ('클래스 고대각성', '클래스', '고대각성'), ('클래스 영웅각성', '클래스', '영웅각성'),
            None,
            ('펫 불멸', '펫', '불멸'), ('펫 전설', '펫', '전설'), ('펫 고대', '펫', '고대'),
            ('펫 전설각성', '펫', '전설각성'), ('펫 고대각성', '펫', '고대각성'), ('펫 영웅각성', '펫', '영웅각성'),
            None,
            ('투혼 불멸', '투혼', '불멸'), ('투혼 전설', '투혼', '전설'), ('투혼 고대', '투혼', '고대'),
            None,
            ('카드 전설', '카드', '전설'), ('카드 고대', '카드', '고대'),
        ]

        dates = [r['date'] for r in sim_result]
        rows_data = []
        for row_def in table_rows:
            if row_def is None:
                rows_data.append({'지표': '---', **{d: '' for d in dates}})
                continue
            label, sys_name, key = row_def
            plc_val = plc.get(sys_name, {}).get(key, 0)
            row = {'지표': label}
            for r in sim_result:
                raw = r['snapshot'].get(sys_name, {}).get(key, 0)
                rate = get_rate(raw, plc_val)
                row[r['date']] = f'{raw:.2f} ({rate:.0f}%)'
            rows_data.append(row)

        st.dataframe(pd.DataFrame(rows_data), use_container_width=True, hide_index=True)

# ============================================================
# 상품 분석 탭
# ============================================================
analysis_tab_idx = len(tab_names) - 1
with tabs[analysis_tab_idx]:
    st.subheader("상품 분석 (고대 환산)")
    st.caption("패키지 소환권의 기댓값을 고대 등가로 환산")

    sorted_groups = sorted(st.session_state.bm_groups, key=lambda x: x['dateKey'], reverse=True)

    # 전체 합계
    grand_total = {'클래스': 0, '펫': 0, '투혼': 0, '카드': 0}
    grand_price = 0
    grand_revenue = 0

    analysis_groups = []
    for group in sorted_groups:
        all_items = []
        for p in group['packages']:
            if p['items']:
                all_items.extend(parse_package_items(p['items']))
        godae = calc_godae_equivalent(all_items)
        total_price = sum(p.get('price', 0) or 0 for p in group['packages'])

        for sys in SYSTEMS:
            grand_total[sys] += godae[sys]
        grand_price += total_price

        # 매출 매칭
        sales = st.session_state.sales_data.get(group['dateKey'])
        has_sales = sales is not None
        total_revenue = 0

        pkg_details = []
        for pkg in group['packages']:
            items = parse_package_items(pkg['items']) if pkg['items'] else []
            pkg_godae = calc_godae_equivalent(items)
            base_name = normalize_name(pkg['name'])

            pkg_sales = None
            if has_sales:
                pkg_sales = sales['items'].get(base_name)
                if not pkg_sales:
                    for sn, sv in sales['items'].items():
                        if normalize_name(sn) == base_name:
                            pkg_sales = sv
                            break
                if pkg_sales:
                    total_revenue += pkg_sales.get('revenue', 0)

            pkg_details.append({
                'name': pkg['name'], 'price': pkg.get('price', 0) or 0,
                'limit': pkg.get('purchaseLimit', '-'),
                'godae': pkg_godae, 'sales': pkg_sales,
                'rawItems': pkg.get('rawItems', []),
            })

        if has_sales:
            grand_revenue += total_revenue

        analysis_groups.append({
            'label': group['label'], 'dateKey': group['dateKey'],
            'godae': godae, 'totalPrice': total_price,
            'pkgDetails': pkg_details, 'pkgCount': len(group['packages']),
            'hasSales': has_sales, 'totalRevenue': total_revenue,
            'salesPeriod': sales['periodLabel'] if has_sales else None,
        })

    # 전체 합계 표시
    cols = st.columns(len(SYSTEMS) + 1 + (1 if grand_revenue > 0 else 0))
    for i, sys in enumerate(SYSTEMS):
        with cols[i]:
            st.metric(f"{sys} (고대)", fmt_num(grand_total[sys]))
    with cols[len(SYSTEMS)]:
        st.metric("총 가격", f"{grand_price:,}원")
    if grand_revenue > 0:
        with cols[len(SYSTEMS) + 1]:
            st.metric("총 매출", f"{fmt_won(grand_revenue)}원")

    # 월간 비교
    monthly_map = {}
    for group in analysis_groups:
        dk = group['dateKey']
        if dk == '기타':
            continue
        mm = dk[:2]
        if mm not in monthly_map:
            monthly_map[mm] = {'클래스': 0, '펫': 0, '투혼': 0, '카드': 0, 'price': 0}
        for sys in SYSTEMS:
            monthly_map[mm][sys] += group['godae'][sys]
        monthly_map[mm]['price'] += group['totalPrice']

    if len(monthly_map) > 1:
        st.markdown("### 월간 비교")
        monthly_sorted = sorted(monthly_map.items(), key=lambda x: x[0], reverse=True)
        months = [f'{int(mm)}월' for mm, _ in monthly_sorted]

        fig = make_subplots(
            rows=1, cols=len(SYSTEMS) + 1,
            subplot_titles=[*SYSTEMS, '총 가격'],
        )
        colors = {'클래스': '#6366f1', '펫': '#22d3ee', '투혼': '#f97316', '카드': '#a855f7'}

        for i, sys in enumerate(SYSTEMS):
            vals = [v[sys] for _, v in monthly_sorted]
            fig.add_trace(go.Bar(
                x=months, y=vals, name=sys,
                marker_color=colors.get(sys, '#888'),
                text=[fmt_num(v) for v in vals], textposition='auto',
                showlegend=False,
            ), row=1, col=i + 1)

        price_vals = [v['price'] for _, v in monthly_sorted]
        fig.add_trace(go.Bar(
            x=months, y=price_vals, name='총 가격',
            marker_color='#10b981',
            text=[f'{int(v):,}' for v in price_vals], textposition='auto',
            showlegend=False,
        ), row=1, col=len(SYSTEMS) + 1)

        fig.update_layout(
            height=350, template='plotly_dark',
            paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
            margin=dict(t=40, b=20),
        )
        st.plotly_chart(fig, use_container_width=True)

    # 기획서별 상세
    for group in analysis_groups:
        with st.expander(
            f"📦 {group['label']} — {group['pkgCount']}개 패키지 · {group['totalPrice']:,}원"
            + (f" · 매출 {fmt_won(group['totalRevenue'])}원" if group['hasSales'] and group['totalRevenue'] else '')
            + (f" ({group['salesPeriod']})" if group['salesPeriod'] else ''),
            expanded=False,
        ):
            # 시스템별 고대 환산 요약
            gcols = st.columns(len(SYSTEMS))
            for i, sys in enumerate(SYSTEMS):
                with gcols[i]:
                    st.metric(sys, fmt_num(group['godae'][sys]))

            # 패키지 상세 테이블
            rows_data = []
            for pkg in group['pkgDetails']:
                row = {
                    '패키지': pkg['name'],
                    '가격': f"{int(pkg['price']):,}" if pkg['price'] else '-',
                    '구매제한': pkg['limit'] or '-',
                }
                for sys in SYSTEMS:
                    row[f'{sys} (고대)'] = fmt_num(pkg['godae'][sys])
                if group['hasSales']:
                    row['매출'] = fmt_won(pkg['sales']['revenue']) if pkg['sales'] else '-'
                    row['구매유저'] = str(int(pkg['sales']['buyers'])) if pkg['sales'] else '-'
                    row['구매횟수'] = str(int(pkg['sales']['purchases'])) if pkg['sales'] else '-'
                rows_data.append(row)

            # 소계
            subtotal = {
                '패키지': '소계',
                '가격': f"{int(group['totalPrice']):,}",
                '구매제한': '',
            }
            for sys in SYSTEMS:
                subtotal[f'{sys} (고대)'] = fmt_num(group['godae'][sys])
            if group['hasSales']:
                subtotal['매출'] = fmt_won(group['totalRevenue'])
                subtotal['구매유저'] = ''
                subtotal['구매횟수'] = ''
            rows_data.append(subtotal)

            st.dataframe(pd.DataFrame(rows_data), use_container_width=True, hide_index=True)
