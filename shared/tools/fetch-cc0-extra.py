#!/usr/bin/env python3
"""CC0 素材の追加取得（第15回: 仮置きモデルの置き換え・夜景の写真化・住宅街の外壁）。

    python3 tools/fetch-cc0-extra.py            # 取得（既にサイズが一致するファイルはスキップ。再実行で再開）

取得先と保存先（いずれも CC0-1.0。manifest.json の models / hdris / materials に出典を記録）:
- Poly Haven モデル（glTF 1K）→ assets/cc0/models/<id>/
- Poly Haven HDRI の写真版（tonemapped JPG）→ assets/cc0/hdris/<id>.jpg
- ambientCG 素材（1K-JPG の zip を展開）→ assets/cc0/materials/<id>/
公開物（public/cc0/）へは tools/build-cc0-models.mjs / build-night-views.mjs / build-cc0-materials.mjs が変換して書き出す。
"""
import datetime, json, os, sys, time, urllib.request, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'cc0')
UA = {'User-Agent': 'pro_Liminal/1.0 (CC0 asset fetch)'}

MODELS = {
    'covered_car': 'vehicles',
    'SchoolChair_01': 'seating',
    'plastic_monobloc_chair_01': 'seating',
    'metal_stool_01': 'seating',
    'modern_arm_chair_01': 'seating',
    'sofa_02': 'seating',
    'Television_01': 'electronics',
    'television_02': 'electronics',
}
HDRIS = ['shanghai_bund', 'modern_buildings_night', 'neuer_zollhof']
MATERIALS = ['WoodSiding008', 'WoodSiding013', 'CorrugatedSteel005']


def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.load(r)


def fetch(url, dest, expect=None):
    if os.path.exists(dest) and (expect is None or os.path.getsize(dest) == expect):
        return 'skip'
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    err = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r, open(dest + '.part', 'wb') as f:
                while True:
                    b = r.read(1 << 20)
                    if not b:
                        break
                    f.write(b)
            os.replace(dest + '.part', dest)
            return 'ok'
        except Exception as e:  # noqa: BLE001
            err = e
            time.sleep(2 + attempt * 3)
    raise RuntimeError(f'{url}: {err}')


path = os.path.join(OUT, 'manifest.json')
manifest = json.load(open(path)) if os.path.exists(path) else {'license': 'CC0-1.0', 'models': {}, 'materials': {}}
manifest.setdefault('models', {}); manifest.setdefault('materials', {}); manifest.setdefault('hdris', {})
manifest.setdefault('sources', {}).update({'polyhaven': 'https://polyhaven.com/license', 'ambientcg': 'https://ambientcg.com/license'})
total = 0

for mid, group in MODELS.items():
    info = get_json(f'https://api.polyhaven.com/info/{mid}')
    g = get_json(f'https://api.polyhaven.com/files/{mid}')['gltf']['1k']['gltf']
    files = []
    entries = [(g['url'], g['size'])] + [(v['url'], v['size']) for v in g['include'].values()]
    for url, size in entries:
        rel = url.split(f'/{mid}/', 1)[1] if f'/{mid}/' in url else os.path.basename(url)
        # glTF の相対参照（textures/..., <id>.bin）どおりに置く
        if url == g['url']:
            rel = os.path.basename(url)
        else:
            rel = next(k for k, v in g['include'].items() if v['url'] == url)
        dest = os.path.join(OUT, 'models', mid, rel)
        st = fetch(url, dest, size)
        files.append(rel); total += os.path.getsize(dest)
        print(f'[model] {mid}/{rel} {st}', flush=True)
    manifest['models'][mid] = {
        'group': group, 'resolution': '1k', 'gltf': f'models/{mid}/{os.path.basename(g["url"])}', 'files': files,
        'triangles': info.get('polycount'), 'dimensionsMm': info.get('dimensions'),
        'source': f'https://polyhaven.com/a/{mid}', 'license': 'CC0-1.0',
    }

for hid in HDRIS:
    t = get_json(f'https://api.polyhaven.com/files/{hid}')['tonemapped']
    dest = os.path.join(OUT, 'hdris', f'{hid}.jpg')
    st = fetch(t['url'], dest, t['size']); total += os.path.getsize(dest)
    print(f'[hdri] {hid} {st}', flush=True)
    manifest['hdris'][hid] = {'file': f'hdris/{hid}.jpg', 'kind': 'tonemapped', 'source': f'https://polyhaven.com/a/{hid}', 'license': 'CC0-1.0'}

for aid in MATERIALS:
    d = get_json(f'https://ambientcg.com/api/v2/full_json?id={aid}&include=downloadData')['foundAssets'][0]
    dl = next(f for c in d['downloadFolders']['default']['downloadFiletypeCategories'].values() for f in c['downloads'] if f['attribute'] == '1K-JPG')
    folder = os.path.join(OUT, 'materials', aid)
    dest = os.path.join(folder, dl['fileName'])
    st = fetch(dl['downloadLink'], dest, dl['size']); total += os.path.getsize(dest)
    print(f'[material] {aid} {st}', flush=True)
    maps = {}
    with zipfile.ZipFile(dest) as z:
        for n in z.namelist():
            if not n.lower().endswith(('.jpg', '.png')):
                continue
            target = os.path.join(folder, os.path.basename(n))
            if not os.path.exists(target):
                with z.open(n) as s, open(target, 'wb') as f:
                    f.write(s.read())
            for key in ['Color', 'NormalGL', 'Roughness', 'AmbientOcclusion', 'Displacement', 'Metalness', 'Opacity']:
                if f'_{key}.' in os.path.basename(n):
                    maps[key] = f'materials/{aid}/{os.path.basename(n)}'
    manifest['materials'][aid] = {'resolution': '1K', 'maps': maps, 'source': f'https://ambientcg.com/a/{aid}', 'license': 'CC0-1.0'}

manifest['fetchedAt'] = datetime.datetime.now().isoformat(timespec='seconds')
json.dump(manifest, open(path, 'w'), indent=1, ensure_ascii=False)
print(f'\n{total / 1e6:.1f} MB → {OUT}')
