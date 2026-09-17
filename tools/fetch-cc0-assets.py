#!/usr/bin/env python3
"""CC0 素材の取得（Poly Haven モデル / ambientCG PBR 素材）。
selection.json（scratchpad で作成した候補一覧）を読み、assets/cc0/ に保存して manifest.json を書く。
既にサイズが一致するファイルはスキップ（再実行で再開できる）。"""
import json, os, sys, time, urllib.request, zipfile, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEL = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'assets', 'cc0', 'selection.json')
OUT = os.path.join(ROOT, 'assets', 'cc0')
HERO = {'Carpet016','Carpet004','OfficeCeiling001','OfficeCeiling002','Wallpaper001A','PaintedPlaster017','Plaster001','Tiles107','Tiles141','Concrete048','Wood049','Metal027'}
UA = {'User-Agent': 'pro_Liminal/1.0 (CC0 asset fetch)'}

def fetch(url, dest, expect=None):
    if os.path.exists(dest) and (expect is None or os.path.getsize(dest) == expect):
        return 'skip'
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r, open(dest + '.part', 'wb') as f:
                while True:
                    b = r.read(1 << 20)
                    if not b: break
                    f.write(b)
            os.replace(dest + '.part', dest)
            return 'ok'
        except Exception as e:
            err = e; time.sleep(2 + attempt * 3)
    raise RuntimeError(f'{url}: {err}')

sel = json.load(open(SEL))
MANIFEST_PATH = os.path.join(OUT, 'manifest.json')
manifest = json.load(open(MANIFEST_PATH)) if os.path.exists(MANIFEST_PATH) else {'license': 'CC0-1.0', 'sources': {'polyhaven': 'https://polyhaven.com/license', 'ambientcg': 'https://ambientcg.com/license'}, 'models': {}, 'materials': {}}
manifest['fetchedAt'] = datetime.datetime.now().isoformat(timespec='seconds')
manifest.setdefault('models', {}); manifest.setdefault('materials', {}); manifest.setdefault('textures', {})
fetched_now = []  # この実行で新規に取得したもの（記録用）
total = 0
for mid, v in (sel['models'].items() if '--models' in sys.argv else []):  # モデルは --models 指定時のみ（v1.3 で小物モデルは不採用）
    res = '1k' if '1k' in v else '2k'
    files = []
    for url in v[res]['urls']:
        # URL 末尾の相対パス（.../<id>/<id>_1k.gltf, .../<id>/textures/x.jpg, .../<id>/<id>.bin）
        rel = url.split(f'/{mid}/', 1)[1]
        dest = os.path.join(OUT, 'models', mid, rel)
        st = fetch(url, dest); files.append(rel); total += os.path.getsize(dest)
        print(f'[model] {mid}/{rel} {st}', flush=True)
    gltf = next(f for f in files if f.endswith('.gltf'))
    manifest['models'][mid] = {'group': v['group'], 'resolution': res, 'gltf': f'models/{mid}/{gltf}', 'files': files, 'source': f'https://polyhaven.com/a/{mid}', 'license': 'CC0-1.0'}
for aid, v in sel['materials'].items():
    res = '2K-JPG' if aid in HERO else '1K-JPG'
    e = v[res]; dest = os.path.join(OUT, 'materials', aid, e['file'])
    st = fetch(e['url'], dest, e['size']); total += os.path.getsize(dest)
    if st == 'ok': fetched_now.append(('material', aid, res, os.path.getsize(dest), f'https://ambientcg.com/a/{aid}'))
    print(f'[material] {aid} {res} {st}', flush=True)
    folder = os.path.join(OUT, 'materials', aid)
    with zipfile.ZipFile(dest) as z:
        names = [n for n in z.namelist() if n.lower().endswith(('.jpg', '.png'))]
        for n in names:
            target = os.path.join(folder, os.path.basename(n))
            if not os.path.exists(target):
                with z.open(n) as src, open(target, 'wb') as f: f.write(src.read())
    maps = {}
    for n in sorted(os.listdir(folder)):
        for key in ('Color', 'NormalGL', 'Roughness', 'AmbientOcclusion', 'Displacement', 'Metalness', 'Opacity'):
            if n.endswith(f'_{key}.jpg') or n.endswith(f'_{key}.png'): maps[key] = f'materials/{aid}/{n}'
    manifest['materials'][aid] = {'group': v['group'], 'resolution': res[:2], 'maps': maps, 'zip': f'materials/{aid}/{e["file"]}', 'source': f'https://ambientcg.com/a/{aid}', 'license': 'CC0-1.0'}
# Poly Haven のテクスチャセット（1K JPG: Diffuse / nor_gl / Rough / AO / Displacement / arm）
for tid, v in sel.get('phTextures', {}).items():
    maps = {}
    size_sum = 0
    for mapname, e in v.get('maps', {}).items():
        fname = e['url'].split('/')[-1]
        dest = os.path.join(OUT, 'textures', tid, fname)
        st = fetch(e['url'], dest, e['size']); size_sum += os.path.getsize(dest); total += os.path.getsize(dest)
        key = {'Diffuse': 'Color', 'nor_gl': 'NormalGL', 'Rough': 'Roughness', 'AO': 'AmbientOcclusion', 'Displacement': 'Displacement', 'arm': 'ARM'}.get(mapname, mapname)
        maps[key] = f'textures/{tid}/{fname}'
        print(f'[texture] {tid}/{fname} {st}', flush=True)
        if st == 'ok' and mapname == 'Diffuse': fetched_now.append(('texture', tid, '1k', None, f'https://polyhaven.com/a/{tid}'))
    manifest['textures'][tid] = {'group': v.get('group', ''), 'resolution': '1k', 'maps': maps, 'source': f'https://polyhaven.com/a/{tid}', 'license': 'CC0-1.0', 'bytes': size_sum}
manifest['totalBytes'] = total
json.dump(manifest, open(MANIFEST_PATH, 'w'), indent=1, ensure_ascii=False)
if fetched_now:
    log_path = os.path.join(ROOT, 'docs', f'cc0-fetch-log-{datetime.date.today().isoformat()}.md')
    with open(log_path, 'a') as f:
        f.write(f"\n## {manifest['fetchedAt']} 取得（選定ファイル: {os.path.basename(SEL)}）\n\n| 種別 | ID | 解像度 | 出典 |\n|---|---|---|---|\n")
        for kind, aid, res, _, src in fetched_now: f.write(f'| {kind} | {aid} | {res} | {src} |\n')
    print(f'fetched now: {len(fetched_now)} items -> {log_path}')
print(f'DONE total {total/1e6:.0f} MB, models {len(manifest["models"])}, materials {len(manifest["materials"])}, textures {len(manifest["textures"])}')
