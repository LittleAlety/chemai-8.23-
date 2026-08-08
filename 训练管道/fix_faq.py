#!/usr/bin/env python
"""Comprehensive fix script for faq_unified.json (consolidated FAQ)."""
import json
import re

FAQ_PATH = r'..\data\faq_unified.json'
OUT_PATH = r'..\data\faq_unified_fixed.json'

with open(FAQ_PATH, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Serialize each entry to text, apply fixes, then re-serialize
data = json.loads(content)

fix_count = 0

for i, entry in enumerate(data):
    title = entry.get('title', entry.get('q', ''))

    # Get all text fields
    fields = ['answer', 'detail', 'q']
    modified = False

    for field in fields:
        if field not in entry:
            continue
        text = entry[field]
        if not text:
            continue
        old_text = text

        # ============================================================
        # FIX 1: Drying temperature 50°C → 110°C
        # ============================================================
        # Replace "50℃" in drying/heating contexts
        text = re.sub(r'50℃', '110℃', text)
        text = re.sub(r'50°C', '110°C', text)
        text = re.sub(r'50度', '110度', text)
        text = re.sub(r'50 ?°C', '110°C', text)

        # Fix "烘干上限50℃" style patterns
        text = text.replace('烘干上限110℃', '烘干上限110℃')  # already done above
        text = text.replace('≤50℃', '≤110℃')
        text = text.replace('≤50°C', '≤110°C')
        text = text.replace('不超过50°C', '不超过110°C')
        text = text.replace('不超过50℃', '不超过110℃')

        # Fix drying time: 20分钟 → 1-2小时 in drying context
        text = re.sub(r'(烘干|烘箱|烘干|干燥).*?20\s*分钟',
                      lambda m: m.group(0).replace('20分钟', '1-2小时')
                                 .replace('20 分钟', '1-2小时'), text)
        text = re.sub(r'(烘干|烘箱|烘干|干燥).*?20\s*min',
                      lambda m: m.group(0).replace('20 min', '1-2 h'), text)

        # More specific: "110℃烘干20分钟" → "110℃烘干1-2小时"
        text = re.sub(r'110℃.*?20\s*分钟',
                      lambda m: m.group(0).replace('20分钟', '1-2小时').replace('20 分钟', '1-2小时'), text)
        text = re.sub(r'110℃.*?20\s*min(?!\ )',
                      lambda m: m.group(0).replace('20 min', '1-2 h'), text)

        # "超50℃失结晶水" → "超113℃失结晶水"
        text = text.replace('超50℃失结晶水', '超113℃失结晶水')
        text = text.replace('超110℃失结晶水', '超113℃失结晶水')

        # ============================================================
        # FIX 2: 165°C → 230-250°C (thermal decomposition)
        # ============================================================
        text = re.sub(r'约\s*165\s*°C.*草酸根.*氧化分解',
                      '约230-250°C：开始发生草酸根的氧化分解', text)
        text = re.sub(r'约\s*165\s*℃.*草酸根.*氧化分解',
                      '约230-250℃：开始发生草酸根的氧化分解', text)

        # ============================================================
        # FIX 3: FeO → Fe₂O₃ (thermal decomposition product)
        # ============================================================
        # In thermal decomposition equations
        text = re.sub(r'FeO\s*\+\s*K₂CO₃', 'Fe₂O₃ + K₂CO₃', text)
        text = re.sub(r'FeO\s*\+\s*K_2CO_3', 'Fe₂O₃ + K₂CO₃', text)
        # "最终产物为FeO" → "最终产物为Fe₂O₃"
        text = re.sub(r'(最终.*?)FeO([^₂])', r'\1Fe₂O₃\2', text)
        # Specifically fix "产物为氧化铁" mentions that might say FeO
        text = re.sub(r'(产物为)FeO\b', r'\1Fe₂O₃', text)

        # ============================================================
        # FIX 4: 600-700 nm d-d跃迁 → LMCT at ~530 nm
        # ============================================================
        # Fix "600—700 nm橙红光（d-d跃迁）" → "~530 nm紫红色光（LMCT跃迁）"
        text = re.sub(r'600[—–-]700\s*nm\s*橙红.*?d-d\s*跃迁',
                      '~530 nm紫红色光（LMCT跃迁）', text)
        text = re.sub(r'600[—–-]700\s*nm\s*的?橙红光.*?d-d\s*跃迁',
                      '~530 nm紫红色光（LMCT跃迁）', text)
        text = re.sub(r'600[—–-]700\s*nm\s*橙红光的d-d跃迁吸收',
                      '~530 nm紫红色光的LMCT跃迁吸收', text)

        # Fix "吸收600—700 nm橙红光后反射" → "吸收~530 nm紫红色光后反射"
        # But only in the context of [Fe(C2O4)3]3- color explanation
        text = re.sub(r'吸收600[—–-]700\s*nm橙红光.*反射.*互补色.*绿',
                      '吸收~530 nm紫红色光（LMCT跃迁）后反射其互补色绿光', text)

        # Fix "配离子主要吸收橙红色区域的光（波长600—700 nm）"
        text = re.sub(r'配离子.*?吸收.*?橙红.*?600[—–-]700\s*nm',
                      '配离子主要吸收紫红色光（~530 nm，LMCT跃迁）', text)

        # Fix entries that say the absorption is d-d跃迁 at 600-700
        text = re.sub(r'd-d跃迁[：:]\s*t₂g\s*→\s*e_g.*吸收橙红.*600[—–-]700',
                      'LMCT跃迁：草酸根π→Fe³⁺ d，吸收~530 nm紫红色光', text)

        # Fix "主要吸收600—700 nm橙红光（d-d跃迁）"
        text = re.sub(r'主要吸收600[—–-]700\s*nm\s*橙红.*d-d\s*跃迁',
                      '主要吸收~530 nm紫红色光（LMCT跃迁）', text)

        # ============================================================
        # FIX 5: 30% H₂O₂ → 6% (for the safety entry that says 30%)
        # ============================================================
        # Fix only entry 483 safety: "H₂O₂（30%）" in context of "有强氧化性"
        # But DON'T change entries that correctly say ">30%为强氧化剂"
        text = re.sub(r'H₂O₂（30%）有强氧化性', 'H₂O₂（实验用6%）有强氧化性', text)
        text = re.sub(r'H₂O₂（30%）腐蚀', 'H₂O₂（实验用6%）腐蚀', text)

        # ============================================================
        # FIX 6: Ethanol volume 0.4倍 → 1-2倍
        # ============================================================
        text = re.sub(r'0\.4倍母液体积', '1-2倍母液体积', text)
        text = re.sub(r'约40%体积比', '约1-2倍体积比', text)
        text = re.sub(r'约0\.4', '约1-2', text)

        # ============================================================
        # FIX 7: Step sequence - ensure correct
        # ============================================================
        # Entry 55 完整操作流程: already has 6 steps but step naming could be better
        # Ensure the sequence is: 称量溶解→沉淀→氧化→配位→结晶→收集干燥
        # The current Entry 55 looks mostly correct, just fix the drying part

        # ============================================================
        # FIX 8: Heating steps count - fix entries claiming only 2 heating steps
        # ============================================================
        # If there's an entry saying "2处" heating, fix to "3处"
        if '2处' in text and '加热' in text:
            # Be careful - only fix if it's about heating step count
            if '加热的步骤有' in text or '需要加热的步骤' in text:
                text = text.replace('2处', '3处')
                text = re.sub(r'2\s*处', '3处', text)

        if old_text != text:
            entry[field] = text
            modified = True

    if modified:
        fix_count += 1
        # print(f'Fixed entry {i}: {title}')

# Now do specific entry-level fixes that need more context

# Entry 173: Complete rewrite of "烘箱温度为何50度"
for i, entry in enumerate(data):
    title = entry.get('title', '')
    if title == '烘箱温度为何50度':
        entry['title'] = '烘箱温度为何110度'
        entry['q'] = '烘箱温度为何110度'
        entry['answer'] = (
            '烘干温度110℃的原因：产物约113℃开始失去结晶水，110℃可有效去除表面吸附水和残留乙醇'
            '而不失去结晶水。严格控制110℃烘干1-2小时至恒重（两次称量差≤0.002 g）。'
            '温度超过113℃会使三水合物部分失水、甚至引发配离子分解，导致称量偏低且产品变质。'
        )
        entry['keys'] = ['烘箱', '110℃', '烘干温度', '为什么110度']
        if '50°C' in entry.get('detail', ''):
            entry['detail'] = entry['detail'].replace('50°C', '110°C').replace('50℃', '110℃')
        fix_count += 1
        print(f'Rewrote entry {i}: {title}')
        break

# Entry 50: Fix title and content "烘干温度时间"
for i, entry in enumerate(data):
    if entry.get('q') == '烘干温度时间':
        entry['answer'] = (
            '产物在110℃烘箱烘干1-2小时至恒重。110℃可有效去除表面吸附水和残留乙醇；'
            '温度超过113℃会使三水合物失去结晶水，导致产品变质、称量偏低。'
            '烘箱内也应避光；冷却至室温后再称量（热样品称量不准）。'
        )
        entry['keys'] = ['烘干', '干燥温度', '110度', '烘干多久', '温度和时间', '烘干温度', '时间分别是']
        fix_count += 1
        print(f'Fixed entry {i}: 烘干温度时间')
        break

# Entry 81: Ensure the correct entry stays correct (LMCT at ~530nm)
# This entry is already correct, just verify

# Entry 301: Fix "吸收波段"
for i, entry in enumerate(data):
    if entry.get('q') == '吸收波段':
        entry['answer'] = (
            '吸收波段为~530 nm的紫红色光（LMCT跃迁：草酸根π电子→Fe³⁺ d轨道），'
            '反射其互补色绿光，故呈翠绿色。d-d跃迁因自旋禁阻且Laporte禁阻强度极弱，'
            '被强LMCT带掩盖。'
        )
        entry['keys'] = ['吸收波段', '吸收波长', '吸收什么光', '多少纳米', '530', '波段', '可见光吸收']
        fix_count += 1
        print(f'Fixed entry {i}: 吸收波段')
        break

# Entry 176: Fix "吸光波长与颜色"
for i, entry in enumerate(data):
    if entry.get('q') == '吸光波长与颜色':
        entry['answer'] = (
            '[Fe(C₂O₄)₃]³⁻主要吸收~530 nm紫红色光（LMCT跃迁：草酸根π电子→Fe³⁺ d轨道），'
            '反射/透射其互补色故呈翠绿色。互补色关系：吸紫→黄绿、吸蓝→黄、吸绿→紫红、'
            '吸紫红→绿/翠绿、吸红→绿蓝。d-d跃迁因自旋禁阻强度很弱，被强LMCT带掩盖。'
        )
        fix_count += 1
        print(f'Fixed entry {i}: 吸光波长与颜色')
        break

# Entry 288: Fix "翠绿色来源"
for i, entry in enumerate(data):
    if entry.get('q') == '翠绿色来源':
        entry['answer'] = (
            '翠绿色来自[Fe(C₂O₄)₃]³⁻的LMCT跃迁（配体→金属电荷转移）：草酸根π电子向Fe³⁺ d轨道跃迁，'
            '吸收~530 nm紫红色光，反射互补色绿光。颜色是配位环境的"指纹"：游离水合Fe³⁺淡紫（水解显黄）、'
            'Fe(OH)₃红褐、FeC₂O₄黄、[Fe(C₂O₄)₃]³⁻翠绿——实验中凭颜色即可判断反应进程。'
        )
        fix_count += 1
        print(f'Fixed entry {i}: 翠绿色来源')
        break

# Entry 239: Fix "颜色异常的诊断流程" - has wrong d-d跃迁 info in detail
for i, entry in enumerate(data):
    if entry.get('q') == '颜色异常的诊断流程':
        detail = entry.get('detail', '')
        if detail:
            detail = detail.replace(
                '产物颜色的本质是d-d跃迁：\nE = hnu = frachc = _o\n[Fe(C_2O_4)_3]^3- 吸收橙红光（约600-700 nm），反射翠绿色光。',
                '产物颜色的本质是LMCT跃迁（配体→金属电荷转移）：草酸根π电子向Fe³⁺ d轨道跃迁，吸收~530 nm紫红色光，反射翠绿色光。d-d跃迁因自旋禁阻强度弱，被强LMCT带掩盖。'
            )
            entry['detail'] = detail
            fix_count += 1
            print(f'Fixed entry {i}: 颜色异常的诊断流程 (detail)')
        break

# Entry 218: Fix "光化学反应机理" detail - mentions d-d跃迁 at 600-700
for i, entry in enumerate(data):
    if entry.get('q') == '光化学反应机理（LMCT详细分析）':
        detail = entry.get('detail', '')
        if detail:
            detail = detail.replace(
                'Fe³⁺为3d⁵高自旋构型（t_2g^3e_g^2），在八面体场中d-d跃迁吸收橙红光（约600-700 nm），这是产物呈翠绿色的原因。',
                'Fe³⁺为3d⁵高自旋构型（t_2g^3e_g^2），翠绿色主要源自LMCT跃迁（草酸根π电子→Fe³⁺ d轨道，吸收~530 nm紫红色光），d-d跃迁因自旋禁阻强度弱被LMCT带掩盖。'
            )
            entry['detail'] = detail
            fix_count += 1
            print(f'Fixed entry {i}: 光化学反应机理 (detail)')
        break

# Entry 224: Fix "颜色解释（d-d跃迁）" - this entry is fundamentally about d-d but for this compound it's LMCT
for i, entry in enumerate(data):
    if entry.get('q') == '颜色解释（d-d跃迁）':
        answer = entry.get('answer', '')
        # This entry explains d-d跃迁 theory which is valid generally, but its analysis of [Fe(C2O4)3]3- is wrong
        answer = answer.replace(
            'd-d跃迁：t_2g e_g，吸收橙红光（~600-700 nm）',
            'LMCT跃迁：草酸根π电子→Fe³⁺ d轨道，吸收~530 nm紫红色光'
        )
        answer = answer.replace(
            '橙红光的互补色为翠绿色',
            '紫红色光的互补色为翠绿色'
        )
        # Fix the key claim about the compound
        if '[Fe(C_2O_4)_3]^3- 的颜色解释' in answer:
            # Fix to LMCT
            answer = re.sub(
                r'\[Fe\(C_2O_4\)_3\]\^3-.*?呈翠绿色。',
                '[Fe(C₂O₄)₃]³⁻ 的颜色解释\n实验观察：[Fe(C₂O₄)₃]³⁻ 配离子呈翠绿色。\n分析：\n1. Fe³⁺为3d⁵高自旋构型\n2. 翠绿色主要来自LMCT跃迁（配体→金属电荷转移）\n3. 草酸根π电子向Fe³⁺ d轨道跃迁，吸收~530 nm紫红色光\n4. 反射互补色绿光故呈翠绿色\n5. d-d跃迁因自旋禁阻且Laporte禁阻强度极弱，被强LMCT带掩盖\n',
                answer
            )
        entry['answer'] = answer
        fix_count += 1
        print(f'Fixed entry {i}: 颜色解释（d-d跃迁）')
        break

# Also fix detail of entry 224
for i, entry in enumerate(data):
    if entry.get('q') == '颜色解释（d-d跃迁）':
        detail = entry.get('detail', '')
        if detail and '吸收橙红光（~600-700 nm）' in detail:
            detail = detail.replace(
                '吸收橙红光（~600-700 nm）',
                '吸收~530 nm紫红色光（LMCT跃迁）'
            )
            detail = detail.replace('橙红光的互补色为翠绿色', '紫红色光的互补色为翠绿色')
            entry['detail'] = detail
            print(f'Fixed entry {i}: 颜色解释 detail')
        break

# Entry 6: Fix "外观颜色与晶系" - fix absorption wavelength
for i, entry in enumerate(data):
    if entry.get('q') == '外观颜色与晶系':
        entry['answer'] = entry['answer'].replace(
            '翠绿色源于配离子吸收600—700 nm橙红光后反射其互补色（绿光）。',
            '翠绿色源于配离子的LMCT跃迁（草酸根π电子→Fe³⁺ d轨道），吸收~530 nm紫红色光后反射其互补色绿光。d-d跃迁因自旋禁阻强度弱，被强LMCT带掩盖。'
        )
        fix_count += 1
        print(f'Fixed entry {i}: 外观颜色与晶系')
        break

# Entry 483: Fix H2O2 safety mention
for i, entry in enumerate(data):
    if entry.get('q') == '实验安全注意事项':
        answer = entry.get('answer', '')
        if 'H₂O₂（30%）' in answer:
            answer = answer.replace('H₂O₂（30%）有强氧化性', 'H₂O₂（实验用6%）有强氧化性')
            answer = answer.replace('H₂O₂（30%）腐蚀', 'H₂O₂（实验用6%）腐蚀')
            entry['answer'] = answer
            fix_count += 1
            print(f'Fixed entry {i}: 实验安全注意事项')
        break

# ============================================================
# Final pass: fix remaining "50℃烘20" patterns and "20分钟" in drying
# ============================================================
for i, entry in enumerate(data):
    for field in ['answer', 'detail', 'q']:
        if field not in entry or not entry[field]:
            continue
        text = entry[field]
        old = text

        # Any remaining "50℃" (shouldn't be in non-drying context based on our analysis)
        if '50℃' in text or '50°C' in text:
            text = text.replace('50℃', '110℃')
            text = text.replace('50°C', '110°C')

        # Any remaining "20分钟" near 110℃
        text = re.sub(r'(110℃[^。]*?)20\s*分钟', r'\g<1>1-2小时', text)
        text = re.sub(r'(110℃[^。]*?)20\s*min(?!\ )', r'\g<1>1-2 h', text)

        # Remaining "20 min" in drying context (not related to 110℃)
        text = re.sub(r'(烘干[^。]*?)20\s*min(?!\ )', r'\g<1>1-2 h', text)
        text = re.sub(r'(烘干[^。]*?)20\s*分钟', r'\g<1>1-2小时', text)

        # Fix final reference: "≤50℃" → "≤110℃"
        text = text.replace('≤50℃', '≤110℃')
        text = text.replace('≤50°C', '≤110°C')

        # Fix "烘干上限50℃" pattern that might have been missed
        text = re.sub(r'烘干.*?上限.*?50℃', '烘干上限110℃', text)
        text = re.sub(r'烘干.*?≤.*?50℃', '烘干温度≤110℃', text)

        # Fix "严禁超过" - ensure it references 113℃ for crystallization water loss
        text = re.sub(r'严禁超过.*?50℃', '严禁超过113℃（结晶水失水温度）', text)
        text = re.sub(r'严禁超过.*?110℃', '严禁超过113℃（结晶水失水温度）', text)

        if text != old:
            entry[field] = text
            fix_count += 0.1  # fractional count for batch fixes

# ============================================================
# Verification pass
# ============================================================
verify_issues = []
for i, entry in enumerate(data):
    text = json.dumps(entry, ensure_ascii=False)
    title = entry.get('title', entry.get('q', ''))

    if '50℃' in text or '50°C' in text:
        # Check if it's in a non-drying context
        if '50℃' in entry.get('answer', '') or '50°C' in entry.get('answer', ''):
            verify_issues.append(f'Entry {i} ({title}): still has 50℃/50°C')

    if '165' in text and ('℃' in text or '°C' in text) and '草酸根' in text:
        verify_issues.append(f'Entry {i} ({title}): still has 165℃ for decomposition')

    answer = entry.get('answer', '')
    if 'FeO' in answer and ('K₂CO₃' in answer or 'K_2CO_3' in answer):
        verify_issues.append(f'Entry {i} ({title}): still has FeO in thermal eqn')

    if '600—700' in answer and ('d-d' in answer or '橙红' in answer):
        verify_issues.append(f'Entry {i} ({title}): still has 600-700 nm + d-d/橙红')

# Save
with open(OUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'\nTotal entries modified: ~{int(fix_count)}')
print(f'Output saved to: {OUT_PATH}')
print(f'\nVerification issues remaining ({len(verify_issues)}):')
for issue in verify_issues:
    print(f'  WARNING: {issue}')
