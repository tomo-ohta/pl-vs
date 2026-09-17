#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""設計表（liminal_procedural_generation_design.xlsx）から data/*.json を生成する。

標準ライブラリのみで動く（openpyxl 不要）。
  python3 tools/xlsx_to_json.py <path/to/design.xlsx> [out_dir=data]

生成物:
  data/rooms.json      有効 RoomDefinition（01_部屋120。v1.3: 「状態」列が「オミット」で始まる行は rooms から除外し
                       omitted[] に移す。E10 / M05 / M06 / M10 / M15 / M20 → 有効 112）
  data/templates.json  41 テンプレート + 12 Generator クラス（02_基礎テンプレート, 02_Generator一覧。status 付き）
  data/modifiers.json  46 Modifier（03_異常モディファイア。usedBy はオミット部屋を除く。status / notes 付き）
  data/rules.json      レア度・接続ルール、性能予算、Portal 型、配置・地図ルール、操作仕様（07, 06, 04, 11, 10）

統合担当向け: 呼び出し方
  python3 tools/xlsx_to_json.py ~/Desktop/liminal_procedural_generation_design.xlsx data
  rooms.json の形: { version, source, rooms: RoomDefinition[], omitted: (RoomDefinition & {status, omitReason})[] }
  既存の読み手（src/data/index.ts）は .rooms だけを見るので後方互換。
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

VERSION = '1.3'

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
RNS = 'http://schemas.openxmlformats.org/package/2006/relationships'


def cell_value(c, shared):
    t = c.get('t')
    v = c.find('m:v', NS)
    if t == 's' and v is not None:
        return shared[int(v.text)]
    if t == 'inlineStr':
        return ''.join(x.text or '' for x in c.iter('{%s}t' % NS['m']))
    if v is None:
        return None
    if t == 'b':
        return v.text == '1'
    try:
        f = float(v.text)
        return int(f) if f.is_integer() else f
    except ValueError:
        return v.text


def read_workbook(path):
    z = zipfile.ZipFile(path)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        root = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in root.findall('m:si', NS):
            shared.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    relmap = {r.get('Id'): r.get('Target') for r in rels.findall('{%s}Relationship' % RNS)}
    sheets = {}
    for sh in wb.find('m:sheets', NS):
        name = sh.get('name')
        target = relmap[sh.get('{%s}id' % NS['r'])].lstrip('/')
        target = target if target.startswith('xl/') else 'xl/' + target
        ws = ET.fromstring(z.read(target))
        rows = []
        for row in ws.iter('{%s}row' % NS['m']):
            cells = {}
            for c in row.findall('m:c', NS):
                col = re.match(r'[A-Z]+', c.get('r')).group(0)
                val = cell_value(c, shared)
                if val is not None and str(val).strip() != '':
                    cells[col] = val
            if cells:
                rows.append(cells)
        sheets[name] = rows
    return sheets


def col_idx(col):
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n


def table(rows, header_row=0):
    """先頭行をヘッダとして dict の list に変換"""
    hdr = rows[header_row]
    cols = sorted(hdr.keys(), key=col_idx)
    out = []
    for r in rows[header_row + 1:]:
        d = {hdr[c]: r.get(c) for c in cols}
        if any(v is not None for v in d.values()):
            out.append(d)
    return out


def split_list(s):
    if s is None or str(s).strip() in ('', 'なし', '—'):
        return []
    # 「M08（v1.3 オミット: M20）」のような括弧注記は捨てる
    s = re.sub(r'（[^）]*）|\([^)]*\)', '', str(s))
    if s.strip() in ('', 'なし', '—'):
        return []
    return [x.strip() for x in s.split(',') if x.strip()]


def pick(d, *prefixes):
    """ヘッダ名が版によって変わる列（「使用部屋 (v1.1)」→「使用部屋 (v1.3)」等）を前方一致で取る"""
    for k, v in d.items():
        if k and any(str(k).startswith(p) for p in prefixes):
            return v
    return None


OMIT_PREFIX = 'オミット'


def is_omitted_row(d):
    """01 シート「状態」列がオミットで始まる、または実装メモの先頭が「v1.3 オミット」/「オミット」"""
    st = d.get('状態')
    if st is not None and str(st).strip().startswith(OMIT_PREFIX):
        return True
    note = d.get('実装メモ')
    return note is not None and re.match(r'^(v\d+\.\d+\s*)?オミット', str(note).strip()) is not None


def blocks(rows):
    """新規シート（09〜11）の「見出し行 → ヘッダ行 → 本文行」ブロックを辞書化"""
    result = {}
    i = 0
    while i < len(rows):
        r = rows[i]
        if list(r.keys()) == ['A'] and i + 1 < len(rows) and len(rows[i + 1]) >= 2:
            title = r['A']
            hdr = rows[i + 1]
            cols = sorted(hdr.keys(), key=col_idx)
            i += 2
            items = []
            while i < len(rows) and not (list(rows[i].keys()) == ['A'] and i + 1 < len(rows) and len(rows[i + 1]) >= 2 and rows[i + 1].get('A') != rows[i].get('A')):
                items.append({hdr[c]: rows[i].get(c) for c in cols})
                i += 1
            result[title] = items
        else:
            i += 1
    return result


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = Path(sys.argv[1])
    out_dir = Path(sys.argv[2] if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / 'data')
    out_dir.mkdir(parents=True, exist_ok=True)
    sheets = read_workbook(src)

    # ---------------- rooms
    rooms = []
    omitted = []
    for d in table(sheets['01_部屋120']):
        room = {
            'id': d['ID'],
            'rarity': d['レア度'],
            'weight': d['出現重み'],
            'name': d['ステージ名'],
            'category': d['空間カテゴリ'],
            'baseTemplate': d['基礎テンプレート'],
            'generator': d['実装Generator'],
            'lightingPreset': d['照明'],
            'audioPreset': d['環境音'],
            'primaryPortal': d['主Portal型'],
            'minExits': d['出口Min'],
            'maxExits': d['出口Max'],
            'connectionRule': d['接続ルール'],
            'mapShape': d['マップ上の形'],
            'dangerTag': d['危険度(参考・効果なし)'],
            'effectLabel': d['特殊効果'],
            'modifiers': [{'id': m} for m in split_list(d['ModifierIDs'])],
            'layoutHints': split_list(d['レイアウト指示']),
            'recipe': d['生成レシピ'],
            'notes': None if d['実装メモ'] in (None, 'なし') else d['実装メモ'],
        }
        if is_omitted_row(d):
            # v1.3 オミット部屋: 生成対象から外す。ID は欠番として保持し、参照用に omitted[] へ残す
            room['status'] = 'omitted'
            room['omitReason'] = room['notes']
            omitted.append(room)
        else:
            rooms.append(room)
    # 09 シート等には Modifier の params が無いので、params は tools/modifier_params.json があれば併合する
    params_path = Path(__file__).resolve().parent / 'modifier_params.json'
    if params_path.exists():
        params = json.loads(params_path.read_text(encoding='utf-8'))
        for room in rooms + omitted:
            for m in room['modifiers']:
                p = params.get(room['id'], {}).get(m['id'])
                if p:
                    m['params'] = p

    # ---------------- templates / generators
    templates = []
    for d in table(sheets['02_基礎テンプレート']):
        templates.append({
            'id': d['TemplateID'],
            'generator': d['Generatorクラス'],
            'kind': 'base' if d['種別'] == '基礎' else 'derived',
            'baseTemplate': None if d['派生元'] in (None, '—') else d['派生元'],
            'phase': d['実装Phase'],
            'use': d['用途'],
            'modules': d['推奨モジュール'],
            'dimensions': d['標準寸法'],
            'portalSockets': d['Portalソケット'],
            'parameters': d['生成パラメータ'],
            'mobileNotes': d['モバイル注意'],
            'status': pick(d, '状態'),
        })
    generators = []
    for d in table(sheets['02_Generator一覧']):
        generators.append({
            'id': d['Generatorクラス'],
            'phase': d['実装Phase'],
            'status': pick(d, '状態'),
            'description': d['説明'],
            'templates': [t.replace('(派生)', '') for t in split_list(d['対応テンプレート（基礎 / 派生）'])],
        })

    # ---------------- modifiers
    modifiers = []
    for d in table(sheets['03_異常モディファイア']):
        used_by = split_list(pick(d, '使用部屋'))
        status = pick(d, '状態')
        modifiers.append({
            'id': d['Modifier'],
            'target': d['対象'],
            'parameters': d['パラメータ'],
            'implementation': d['実装方式'],
            'cost': d['負荷'],
            'usedBy': used_by,
            'notes': pick(d, '備考'),
            # 状態が「保留」で始まる（例: 「v1.3 保留（使用部屋なし）」）、または使用部屋なしは deferred。
            # 「実装対象（... backside 保留）」のような部分保留は deferred にしない
            'status': status or ('deferred' if not used_by else 'active'),
            'deferred': bool(status and re.match(r'^(v\d+\.\d+\s*)?保留', str(status).strip())) or not used_by,
        })

    # ---------------- rules
    rules = {
        'rarityRules': table(sheets['07_レア度・接続ルール']),
        'performanceBudget': table(sheets['06_WebGLスマホ予算']),
        'generationSteps': table(sheets['04_生成アルゴリズム']),
    }
    b11 = blocks(sheets['11_地図・配置仕様'])
    for title, items in b11.items():
        if title.startswith('Portal 型一覧'):
            rules['portalTypes'] = [{'id': x['ID'], 'use': x['用途']} for x in items]
        elif title.startswith('レイアウト指示'):
            rules['layoutHintVocab'] = [{'id': x['ID'], 'meaning': x['意味']} for x in items]
        elif title.startswith('空間配置'):
            rules['placementRules'] = [x['ルール'] for x in items]
        elif title.startswith('地図'):
            rules['mapRules'] = [x['ルール'] for x in items]
    b10 = blocks(sheets['10_操作仕様'])
    rules['controls'] = {k: v for k, v in b10.items()}

    # ---------------- consistency checks
    tid = {t['id'] for t in templates}
    mid = {m['id'] for m in modifiers}
    hint_vocab = {h['id'] for h in rules.get('layoutHintVocab', [])}
    portal_ids = {p['id'] for p in rules.get('portalTypes', [])}
    problems = []
    for r in rooms + omitted:
        if r['baseTemplate'] not in tid:
            problems.append(f"{r['id']}: template {r['baseTemplate']} undefined")
        for m in r['modifiers']:
            if m['id'] not in mid:
                problems.append(f"{r['id']}: modifier {m['id']} undefined")
        for h in r['layoutHints']:
            if h not in hint_vocab:
                problems.append(f"{r['id']}: hint {h} undefined")
        if r['primaryPortal'] not in portal_ids:
            problems.append(f"{r['id']}: portal {r['primaryPortal']} undefined")
    if problems:
        print('\n'.join(problems))
        sys.exit(2)

    # usedBy に有効部屋以外（オミット・欠番）が残っていないか
    active_ids = {r['id'] for r in rooms}
    for m in modifiers:
        bad = [x for x in m['usedBy'] if x not in active_ids]
        if bad:
            problems.append(f"modifier {m['id']}: usedBy references non-active rooms {bad}")
    if problems:
        print('\n'.join(problems))
        sys.exit(2)

    version = VERSION
    (out_dir / 'rooms.json').write_text(json.dumps({'version': version, 'source': src.name, 'rooms': rooms, 'omitted': omitted}, ensure_ascii=False, indent=2), encoding='utf-8')
    (out_dir / 'templates.json').write_text(json.dumps({'version': version, 'generators': generators, 'templates': templates}, ensure_ascii=False, indent=2), encoding='utf-8')
    (out_dir / 'modifiers.json').write_text(json.dumps({'version': version, 'modifiers': modifiers}, ensure_ascii=False, indent=2), encoding='utf-8')
    (out_dir / 'rules.json').write_text(json.dumps({'version': version, **rules}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'rooms={len(rooms)} omitted={[r["id"] for r in omitted]} templates={len(templates)} generators={len(generators)} '
          f'modifiers={len(modifiers)} deferred={[m["id"] for m in modifiers if m["deferred"]]} -> {out_dir}')


if __name__ == '__main__':
    main()
